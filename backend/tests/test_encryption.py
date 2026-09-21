import base64

import pytest

from src.core.encryption import EncryptedValueError, EnvelopeEncryption


def _key() -> str:
    return base64.urlsafe_b64encode(b"k" * 32).decode("ascii")


def test_envelope_encryption_is_versioned_randomized_and_reversible():
    cipher = EnvelopeEncryption(_key())

    first = cipher.encrypt("external-secret")
    second = cipher.encrypt("external-secret")

    assert first.startswith("enc:v1:")
    assert first != second
    assert cipher.decrypt(first) == "external-secret"
    assert cipher.decrypt(second) == "external-secret"


def test_envelope_encryption_rejects_tampering():
    cipher = EnvelopeEncryption(_key())
    encrypted = cipher.encrypt("external-secret")
    tampered = encrypted[:-1] + ("A" if encrypted[-1] != "A" else "B")

    with pytest.raises(EncryptedValueError):
        cipher.decrypt(tampered)
