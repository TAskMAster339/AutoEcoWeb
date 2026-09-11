from __future__ import annotations

import asyncio
import logging
import math
from collections import Counter, OrderedDict, defaultdict
from dataclasses import dataclass
from decimal import Decimal
from threading import Lock
from uuid import UUID
from weakref import WeakValueDictionary

from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_recall_fscore_support
from src.models.auto_tagging import AutoTaggingModelState
from src.models.user import User
from src.repositories.auto_tagging import AutoTagTrainingRow, AutoTaggingRepository
from src.schemas.auto_tagging import AutoTaggingStatusResponse

ALGORITHM_VERSION = "hybrid-v1"
MAX_TRAINING_EXAMPLES = 10_000
MIN_TRAINING_EXAMPLES = 50
MIN_MODEL_TRAINING_EXAMPLES = 30
MIN_VALIDATION_EXAMPLES = 20
MIN_EXAMPLES_PER_TAG = 5
TARGET_PRECISION = 0.90
_CACHE_SIZE = 32
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AutoTagInput:
    raw_name: str
    normalized_name: str
    raw_seller: str | None
    normalized_seller: str | None
    operation_type: int
    amount: Decimal


@dataclass(frozen=True)
class AutoTagPrediction:
    tag_id: UUID
    confidence: float


def _clean(value: str | None) -> str:
    return " ".join((value or "").casefold().split())


def _amount_bucket(amount: Decimal) -> str:
    value = max(float(amount), 0.0)
    if value < 1:
        return "0"
    return str(min(6, int(math.log10(value))))


def _text(row: AutoTagTrainingRow | AutoTagInput) -> str:
    kind = "income" if row.operation_type in (2, 3) else "expense"
    return (
        f"raw {_clean(row.raw_name)} canonical {_clean(row.normalized_name)} "
        f"operation {kind} amount {_amount_bucket(row.amount)}"
    )


def _product_key(row: AutoTagTrainingRow | AutoTagInput) -> str:
    return _clean(row.normalized_name) or _clean(row.raw_name)


def _seller_key(row: AutoTagTrainingRow | AutoTagInput) -> str:
    return _clean(row.normalized_seller) or _clean(row.raw_seller)


class _HybridModel:
    """Product-first classifier with an explicitly constrained seller fallback."""

    def __init__(self, rows: list[AutoTagTrainingRow]) -> None:
        self.tag_counts = Counter(row.tag_id for row in rows)
        self.vectorizer = HashingVectorizer(
            analyzer="char_wb",
            ngram_range=(3, 5),
            n_features=2**14,
            alternate_sign=False,
            norm="l2",
        )
        self.classifier: LogisticRegression | None = None
        if len(self.tag_counts) >= 2:
            matrix = self.vectorizer.transform([_text(row) for row in rows])
            self.classifier = LogisticRegression(
                class_weight="balanced",
                max_iter=250,
                random_state=42,
            ).fit(matrix, [str(row.tag_id) for row in rows])

        product_labels: dict[str, Counter[UUID]] = defaultdict(Counter)
        seller_labels: dict[str, Counter[UUID]] = defaultdict(Counter)
        for row in rows:
            product_labels[_product_key(row)][row.tag_id] += 1
            if seller := _seller_key(row):
                seller_labels[seller][row.tag_id] += 1
        self.product_history = self._stable_map(product_labels, minimum=3, ratio=0.90)
        self.seller_history = self._stable_map(seller_labels, minimum=20, ratio=0.95)
        self.thresholds: dict[UUID, float] = {}

    @staticmethod
    def _stable_map(
        values: dict[str, Counter[UUID]],
        *,
        minimum: int,
        ratio: float,
    ) -> dict[str, tuple[UUID, float]]:
        result: dict[str, tuple[UUID, float]] = {}
        for key, counts in values.items():
            label, count = counts.most_common(1)[0]
            total = sum(counts.values())
            confidence = count / total
            if total >= minimum and confidence >= ratio:
                result[key] = (label, confidence)
        return result

    def raw_predict(self, item: AutoTagInput | AutoTagTrainingRow) -> AutoTagPrediction | None:
        exact = self.product_history.get(_product_key(item))
        if exact is not None:
            return AutoTagPrediction(exact[0], exact[1])

        text_prediction: AutoTagPrediction | None = None
        if self.classifier is not None:
            probabilities = self.classifier.predict_proba(
                self.vectorizer.transform([_text(item)]),
            )[0]
            index = int(probabilities.argmax())
            text_prediction = AutoTagPrediction(
                UUID(str(self.classifier.classes_[index])),
                float(probabilities[index]),
            )

        seller = self.seller_history.get(_seller_key(item))
        if seller is not None:
            seller_prediction = AutoTagPrediction(seller[0], seller[1])
            if text_prediction is None or text_prediction.confidence < 0.55:
                return seller_prediction
            if text_prediction.tag_id == seller_prediction.tag_id:
                return AutoTagPrediction(
                    text_prediction.tag_id,
                    max(text_prediction.confidence, seller_prediction.confidence),
                )
        return text_prediction

    def predict(self, item: AutoTagInput) -> AutoTagPrediction | None:
        prediction = self.raw_predict(item)
        if prediction is None:
            return None
        threshold = self.thresholds.get(prediction.tag_id)
        if threshold is None or prediction.confidence < threshold:
            return None
        return prediction


@dataclass(frozen=True)
class _TrainingResult:
    model: _HybridModel | None
    status: str
    training_examples: int
    validation_examples: int
    distinct_tags: int
    supported_tags: int
    precision: float | None
    coverage: float | None
    macro_f1: float | None
    store_baseline_precision: float | None
    threshold: float | None
    per_tag_metrics: list[dict]


def _seller_baseline(
    train: list[AutoTagTrainingRow],
    validation: list[AutoTagTrainingRow],
) -> float | None:
    counts: dict[str, Counter[UUID]] = defaultdict(Counter)
    for row in train:
        if seller := _seller_key(row):
            counts[seller][row.tag_id] += 1
    checked = correct = 0
    for row in validation:
        seller = _seller_key(row)
        if not seller or seller not in counts:
            continue
        checked += 1
        correct += counts[seller].most_common(1)[0][0] == row.tag_id
    return correct / checked if checked else None


def _train(rows: list[AutoTagTrainingRow]) -> _TrainingResult:
    distinct = len({row.tag_id for row in rows})
    if len(rows) < MIN_TRAINING_EXAMPLES or distinct < 2:
        return _TrainingResult(
            None,
            "insufficient_data",
            len(rows),
            0,
            distinct,
            0,
            None,
            None,
            None,
            None,
            None,
            [],
        )

    validation_size = max(MIN_VALIDATION_EXAMPLES, math.ceil(len(rows) * 0.2))
    train = rows[:-validation_size]
    validation = rows[-validation_size:]
    if len(train) < MIN_MODEL_TRAINING_EXAMPLES:
        return _TrainingResult(
            None,
            "insufficient_data",
            len(rows),
            len(validation),
            distinct,
            0,
            None,
            None,
            None,
            None,
            None,
            [],
        )

    provisional = _HybridModel(train)
    raw_predictions = [provisional.raw_predict(row) for row in validation]
    thresholds: dict[UUID, float] = {}
    train_counts = Counter(row.tag_id for row in train)
    candidates = [round(0.60 + step * 0.05, 2) for step in range(8)]
    for tag_id, count in train_counts.items():
        if count < MIN_EXAMPLES_PER_TAG:
            continue
        matching = [
            (prediction, row)
            for prediction, row in zip(raw_predictions, validation, strict=True)
            if prediction is not None and prediction.tag_id == tag_id
        ]
        for threshold in candidates:
            accepted = [pair for pair in matching if pair[0].confidence >= threshold]
            if len(accepted) < 2:
                continue
            precision = sum(row.tag_id == tag_id for _, row in accepted) / len(accepted)
            if precision >= TARGET_PRECISION:
                thresholds[tag_id] = threshold
                break

    accepted_predictions: list[UUID | None] = []
    confidences: list[float] = []
    for prediction in raw_predictions:
        if (
            prediction is not None
            and prediction.tag_id in thresholds
            and prediction.confidence >= thresholds[prediction.tag_id]
        ):
            accepted_predictions.append(prediction.tag_id)
            confidences.append(prediction.confidence)
        else:
            accepted_predictions.append(None)

    accepted_indices = [i for i, value in enumerate(accepted_predictions) if value is not None]
    correct = sum(
        accepted_predictions[i] == validation[i].tag_id for i in accepted_indices
    )
    precision = correct / len(accepted_indices) if accepted_indices else None
    coverage = len(accepted_indices) / len(validation)
    ready = bool(
        len(accepted_indices) >= 5
        and precision is not None
        and precision >= TARGET_PRECISION
    )

    labels = sorted({str(row.tag_id) for row in validation})
    true_values = [str(row.tag_id) for row in validation]
    predicted_values = [str(value) if value is not None else "__abstain__" for value in accepted_predictions]
    macro_f1 = float(
        f1_score(true_values, predicted_values, labels=labels, average="macro", zero_division=0),
    )

    tag_names = {row.tag_id: row.tag_name for row in rows}
    all_counts = Counter(row.tag_id for row in rows)
    per_tag: list[dict] = []
    for tag_id in sorted(all_counts, key=lambda value: tag_names[value].casefold()):
        true_binary = [row.tag_id == tag_id for row in validation]
        predicted_binary = [value == tag_id for value in accepted_predictions]
        p, r, _, _ = precision_recall_fscore_support(
            true_binary,
            predicted_binary,
            average="binary",
            zero_division=0,
        )
        validation_count = sum(true_binary)
        per_tag.append(
            {
                "tag_id": str(tag_id),
                "tag_name": tag_names[tag_id],
                "training_examples": all_counts[tag_id],
                "validation_examples": validation_count,
                "precision": float(p) if any(predicted_binary) else None,
                "recall": float(r) if validation_count else None,
                "supported": ready and tag_id in thresholds,
            },
        )

    final_model = _HybridModel(rows) if ready else None
    if final_model is not None:
        final_model.thresholds = thresholds
    return _TrainingResult(
        final_model,
        "ready" if ready else "degraded",
        len(rows),
        len(validation),
        distinct,
        len(thresholds) if ready else 0,
        precision,
        coverage,
        macro_f1,
        _seller_baseline(train, validation),
        min(thresholds.values()) if thresholds else None,
        per_tag,
    )


_model_cache: OrderedDict[tuple[UUID, int, str], _HybridModel] = OrderedDict()
_cache_lock = Lock()
_user_locks: WeakValueDictionary[UUID, asyncio.Lock] = WeakValueDictionary()
_user_locks_guard = Lock()


def _training_lock(user_id: UUID) -> asyncio.Lock:
    # Weak references keep concurrent training serialized without retaining one
    # lock forever for every account that has ever used the feature.
    with _user_locks_guard:
        lock = _user_locks.get(user_id)
        if lock is None:
            lock = asyncio.Lock()
            _user_locks[user_id] = lock
        return lock


class AutoTaggingService:
    def __init__(self, repo: AutoTaggingRepository) -> None:
        self._repo = repo

    async def bump_revision(self, user_id: UUID) -> None:
        await self._repo.bump_revision(user_id)

    async def status(self, user: User) -> AutoTaggingStatusResponse:
        state = await self._repo.get_state(user.id)
        rows = await self._repo.list_training_rows(
            user.id,
            limit=MAX_TRAINING_EXAMPLES,
        )
        status = "disabled" if not user.auto_tagging_enabled else "stale"
        if len(rows) < MIN_TRAINING_EXAMPLES or len({row.tag_id for row in rows}) < 2:
            status = "insufficient_data" if user.auto_tagging_enabled else "disabled"
        elif (
            state is not None
            and state.trained_revision == user.auto_tagging_training_revision
            and state.algorithm_version == ALGORITHM_VERSION
        ):
            status = state.status
        return self._response(user, state, status, rows)

    async def set_enabled(self, user: User, enabled: bool) -> AutoTaggingStatusResponse:
        user = await self._repo.set_enabled(user, enabled)
        if enabled:
            return await self.retrain(user)
        return await self.status(user)

    async def retrain(self, user: User) -> AutoTaggingStatusResponse:
        if not user.auto_tagging_enabled:
            return await self.status(user)
        lock = _training_lock(user.id)
        async with lock:
            rows = await self._repo.list_training_rows(
                user.id,
                limit=MAX_TRAINING_EXAMPLES,
            )
            try:
                result = await asyncio.to_thread(_train, rows)
                state = await self._repo.save_state(
                    user.id,
                    status=result.status,
                    algorithm_version=ALGORITHM_VERSION,
                    trained_revision=user.auto_tagging_training_revision,
                    trained_at=self._repo.utcnow(),
                    training_examples=result.training_examples,
                    validation_examples=result.validation_examples,
                    distinct_tags=result.distinct_tags,
                    supported_tags=result.supported_tags,
                    precision=result.precision,
                    coverage=result.coverage,
                    macro_f1=result.macro_f1,
                    store_baseline_precision=result.store_baseline_precision,
                    threshold=result.threshold,
                    per_tag_metrics=result.per_tag_metrics,
                )
                key = (user.id, user.auto_tagging_training_revision, ALGORITHM_VERSION)
                with _cache_lock:
                    stale_keys = [cached for cached in _model_cache if cached[0] == user.id]
                    for stale_key in stale_keys:
                        _model_cache.pop(stale_key, None)
                    if result.model is not None:
                        _model_cache[key] = result.model
                        while len(_model_cache) > _CACHE_SIZE:
                            _model_cache.popitem(last=False)
                return self._response(user, state, result.status, rows)
            except Exception:
                logger.exception("Auto-tagging training failed for user_id=%s", user.id)
                state = await self._repo.save_state(
                    user.id,
                    status="error",
                    algorithm_version=ALGORITHM_VERSION,
                    trained_revision=user.auto_tagging_training_revision,
                    trained_at=self._repo.utcnow(),
                    training_examples=len(rows),
                    validation_examples=0,
                    distinct_tags=len({row.tag_id for row in rows}),
                    supported_tags=0,
                    precision=None,
                    coverage=None,
                    macro_f1=None,
                    store_baseline_precision=None,
                    threshold=None,
                    per_tag_metrics=[],
                )
                return self._response(user, state, "error", rows)

    async def predict_many(
        self,
        user: User,
        items: list[AutoTagInput],
    ) -> list[AutoTagPrediction | None]:
        if not user.auto_tagging_enabled or not items:
            return [None] * len(items)
        key = (user.id, user.auto_tagging_training_revision, ALGORITHM_VERSION)
        with _cache_lock:
            model = _model_cache.get(key)
            if model is not None:
                _model_cache.move_to_end(key)
        if model is None:
            status = await self.retrain(user)
            if status.status != "ready":
                return [None] * len(items)
            with _cache_lock:
                model = _model_cache.get(key)
        if model is None:
            return [None] * len(items)
        try:
            return await asyncio.to_thread(
                lambda: [model.predict(item) for item in items],
            )
        except Exception:
            logger.exception("Auto-tagging prediction failed for user_id=%s", user.id)
            return [None] * len(items)

    @staticmethod
    def _response(
        user: User,
        state: AutoTaggingModelState | None,
        status: str,
        rows: list[AutoTagTrainingRow],
    ) -> AutoTaggingStatusResponse:
        tag_appearance = {
            str(row.tag_id): (row.tag_color, row.tag_icon)
            for row in rows
        }
        per_tag_metrics = []
        for metric in state.per_tag_metrics if state else []:
            tag_id = str(metric["tag_id"])
            color, icon = tag_appearance.get(tag_id, ("#6C5CE7", None))
            per_tag_metrics.append(
                {
                    **metric,
                    "tag_color": color,
                    "tag_icon": icon,
                },
            )

        return AutoTaggingStatusResponse(
            enabled=user.auto_tagging_enabled,
            status=status,
            current_revision=user.auto_tagging_training_revision,
            trained_revision=state.trained_revision if state else None,
            algorithm_version=ALGORITHM_VERSION,
            trained_at=state.trained_at if state else None,
            training_examples=len(rows),
            validation_examples=state.validation_examples if state else 0,
            distinct_tags=len({row.tag_id for row in rows}),
            supported_tags=state.supported_tags if state else 0,
            minimum_training_examples=MIN_TRAINING_EXAMPLES,
            minimum_examples_per_tag=MIN_EXAMPLES_PER_TAG,
            target_precision=TARGET_PRECISION,
            precision=state.precision if state else None,
            coverage=state.coverage if state else None,
            macro_f1=state.macro_f1 if state else None,
            store_baseline_precision=state.store_baseline_precision if state else None,
            threshold=state.threshold if state else None,
            per_tag_metrics=per_tag_metrics,
        )
