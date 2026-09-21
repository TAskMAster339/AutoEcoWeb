import base64
import binascii
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX = "enc:v1:"
_WRAP_AAD = b"autoeco:proverkacheka:dek:v1"
_TOKEN_AAD = b"autoeco:proverkacheka:token:v1"


class EncryptionConfigurationError(RuntimeError):
    pass


class EncryptedValueError(ValueError):
    pass


def is_encrypted(value: str) -> bool:
    return value.startswith(_PREFIX)


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value.encode("ascii"))


class EnvelopeEncryption:
    """AES-GCM data encryption with a random DEK wrapped by a separate KEK."""

    def __init__(self, encoded_master_key: str | None) -> None:
        if not encoded_master_key:
            raise EncryptionConfigurationError(
                "PROVERKACHECKA_ENCRYPTION_KEY is not configured"
            )
        try:
            master_key = _decode(encoded_master_key)
        except (ValueError, binascii.Error) as exc:
            raise EncryptionConfigurationError(
                "PROVERKACHECKA_ENCRYPTION_KEY must be valid base64"
            ) from exc
        if len(master_key) != 32:  # noqa: PLR2004
            raise EncryptionConfigurationError(
                "PROVERKACHECKA_ENCRYPTION_KEY must decode to 32 bytes"
            )
        self._master = AESGCM(master_key)

    def encrypt(self, plaintext: str) -> str:
        if is_encrypted(plaintext):
            return plaintext
        dek = AESGCM.generate_key(bit_length=256)
        wrap_nonce = os.urandom(12)
        data_nonce = os.urandom(12)
        wrapped_dek = self._master.encrypt(wrap_nonce, dek, _WRAP_AAD)
        ciphertext = AESGCM(dek).encrypt(
            data_nonce,
            plaintext.encode("utf-8"),
            _TOKEN_AAD,
        )
        return ":".join(
            (
                "enc",
                "v1",
                _encode(wrap_nonce),
                _encode(wrapped_dek),
                _encode(data_nonce),
                _encode(ciphertext),
            )
        )

    def decrypt(self, value: str) -> str:
        if not is_encrypted(value):
            raise EncryptedValueError("Stored token is not encrypted")
        parts = value.split(":")
        if len(parts) != 6 or parts[:2] != ["enc", "v1"]:  # noqa: PLR2004
            raise EncryptedValueError("Unsupported encrypted token format")
        try:
            wrap_nonce, wrapped_dek, data_nonce, ciphertext = map(_decode, parts[2:])
            dek = self._master.decrypt(wrap_nonce, wrapped_dek, _WRAP_AAD)
            plaintext = AESGCM(dek).decrypt(data_nonce, ciphertext, _TOKEN_AAD)
            return plaintext.decode("utf-8")
        except (ValueError, binascii.Error, InvalidTag, UnicodeDecodeError) as exc:
            raise EncryptedValueError("Encrypted token authentication failed") from exc
