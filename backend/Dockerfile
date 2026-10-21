ARG PYTHON_IMAGE=python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c

FROM ${PYTHON_IMAGE} AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --require-hashes -r requirements.txt


FROM ${PYTHON_IMAGE} AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN groupadd --gid 10001 autoeco \
    && useradd --uid 10001 --gid autoeco --no-create-home --shell /usr/sbin/nologin autoeco

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=10001:10001 . .

USER 10001:10001

EXPOSE 80

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "80", "--no-proxy-headers"]
