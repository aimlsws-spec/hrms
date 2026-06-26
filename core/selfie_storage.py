"""
selfie_storage.py — Encrypted local filesystem storage for WFH selfie images.

Security model:
  - Files stored in WFH_SELFIE_DIR (outside web root, never mounted as static).
  - Encrypted with AES-256-GCM before write; decrypted on-the-fly during stream.
  - Filenames are UUID v4 — no employee ID, date, or attendance ID in the name.
  - EXIF metadata stripped via Pillow before encryption.
  - The encryption key is loaded from the environment (SELFIE_ENCRYPTION_KEY).

This module has NO FastAPI imports — it is a pure utility imported by the API layer.
"""

import os
import io
import hashlib
import uuid
import logging
from pathlib import Path
from typing import Tuple

from PIL import Image

try:
    import piexif as _piexif
    _HAS_PIEXIF = True
except ImportError:
    _piexif = None         # type: ignore[assignment]
    _HAS_PIEXIF = False

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

log = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

# Directory where encrypted selfie files are written.
# Must NOT be inside the static files directory or web root.
_BASE_DIR = Path(os.getenv("WFH_SELFIE_DIR", "wfh_selfies"))

# 32-byte key for AES-256-GCM, hex-encoded in the environment variable.
# Generate once: python -c "import secrets; print(secrets.token_hex(32))"
_KEY_HEX  = os.getenv("SELFIE_ENCRYPTION_KEY", "")

# Retention period in months (read from DB config at startup; this is the fallback)
_RETENTION_MONTHS_DEFAULT = 12

# ── Startup ────────────────────────────────────────────────────────────────────

def ensure_storage_dir() -> None:
    """Create storage directory if it does not exist. Called at app startup."""
    _BASE_DIR.mkdir(parents=True, exist_ok=True)
    # Write a .gitignore to prevent accidental commits of encrypted files
    gi = _BASE_DIR / ".gitignore"
    if not gi.exists():
        gi.write_text("*\n!.gitignore\n", encoding="utf-8")
    log.info("Selfie storage directory ready: %s", _BASE_DIR.resolve())


def _get_key() -> bytes:
    if not _KEY_HEX or len(_KEY_HEX) != 64:
        raise RuntimeError(
            "SELFIE_ENCRYPTION_KEY environment variable must be set to a "
            "64-character hex string (32 bytes). "
            "Generate: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    return bytes.fromhex(_KEY_HEX)


# ── Image processing ───────────────────────────────────────────────────────────

def _validate_and_transcode(raw_bytes: bytes, max_kb: int = 2048) -> Tuple[bytes, int, int]:
    """
    Validate, strip EXIF, and re-encode as clean JPEG.

    Steps:
      1. Check file size bounds.
      2. Verify magic bytes (JPEG: FF D8 FF / PNG: 89 50 4E 47).
      3. Attempt full Pillow decode (rejects corrupt/crafted files).
      4. Check minimum dimensions.
      5. Strip all EXIF metadata including embedded thumbnail.
      6. Re-encode as JPEG at 85% quality.

    Returns: (jpeg_bytes, width_px, height_px)
    Raises: ValueError with human-readable reason on any validation failure.
    """
    # ── Size bounds ────────────────────────────────────────────────────────────
    size_bytes = len(raw_bytes)
    if size_bytes < 10_000:
        raise ValueError("Image is too small (minimum 10 KB).")
    if size_bytes > max_kb * 1024:
        raise ValueError(f"Image exceeds maximum size ({max_kb} KB).")

    # ── Magic bytes ────────────────────────────────────────────────────────────
    jpeg_magic = raw_bytes[:3] == b'\xff\xd8\xff'
    png_magic  = raw_bytes[:8] == b'\x89PNG\r\n\x1a\n'
    if not (jpeg_magic or png_magic):
        raise ValueError("File is not a valid JPEG or PNG image.")

    # ── Full decode via Pillow ─────────────────────────────────────────────────
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img.verify()                         # raises on corrupt data
        img = Image.open(io.BytesIO(raw_bytes))  # re-open: verify() closes stream
        img.load()                           # force full decode
    except Exception as exc:
        raise ValueError(f"Image could not be decoded: {exc}") from exc

    # ── Dimension check ────────────────────────────────────────────────────────
    width, height = img.size
    if width < 100 or height < 100:
        raise ValueError(f"Image dimensions too small ({width}×{height}px; minimum 100×100).")
    if width > 3840 or height > 2160:
        raise ValueError(f"Image dimensions too large ({width}×{height}px; maximum 3840×2160).")

    # ── Convert to RGB (handles RGBA/P/CMYK sources) ──────────────────────────
    if img.mode != "RGB":
        img = img.convert("RGB")

    # ── Strip EXIF completely — including embedded thumbnail ───────────────────
    # Pillow's save() with no exif kwarg drops all metadata.
    # piexif.remove() is an additional safety pass for JPEG inputs.
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    clean_jpeg = buf.getvalue()

    # Secondary EXIF removal pass via piexif (if available — Pillow already strips on save)
    if _HAS_PIEXIF:
        try:
            _piexif.remove(clean_jpeg)
        except Exception:
            pass  # no EXIF present — fine

    return clean_jpeg, width, height


# ── Encryption / decryption ────────────────────────────────────────────────────

def _encrypt(plaintext: bytes) -> bytes:
    """AES-256-GCM encrypt. Returns nonce (12 bytes) || ciphertext+tag."""
    key   = _get_key()
    aesgcm = AESGCM(key)
    nonce  = os.urandom(12)
    ct     = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ct


def _decrypt(blob: bytes) -> bytes:
    """AES-256-GCM decrypt. Expects nonce (12 bytes) || ciphertext+tag."""
    key    = _get_key()
    aesgcm = AESGCM(key)
    nonce  = blob[:12]
    ct     = blob[12:]
    return aesgcm.decrypt(nonce, ct, None)


# ── Public API ─────────────────────────────────────────────────────────────────

def save_selfie(raw_bytes: bytes, max_kb: int = 2048) -> dict:
    """
    Validate, transcode, encrypt, and write a selfie to disk.

    Returns a dict with storage metadata to be written to `attendance_selfies`:
      {
        storage_key:     str  (UUID v4),
        file_hash:       str  (SHA-256 hex of clean plaintext JPEG),
        mime_type:       str  ('image/jpeg'),
        file_size_bytes: int  (size of clean JPEG before encryption),
        width_px:        int,
        height_px:       int,
      }

    Raises ValueError on validation failure (caller should return HTTP 422).
    Raises OSError on filesystem or permission errors.
    Raises RuntimeError if encryption key is not configured.
    """
    # Ensure directory exists immediately before saving
    ensure_storage_dir()

    # 1. Validate + transcode (raises ValueError on bad input)
    clean_jpeg, width, height = _validate_and_transcode(raw_bytes, max_kb)

    # 2. Hash the clean plaintext (for integrity verification)
    file_hash = hashlib.sha256(clean_jpeg).hexdigest()

    # 3. Encrypt
    encrypted = _encrypt(clean_jpeg)

    # 4. Generate UUID filename — no employee/date info
    storage_key = str(uuid.uuid4())
    file_path   = _BASE_DIR / f"{storage_key}.enc"

    # 5. Write encrypted file (raises OSError if disk full/permissions)
    file_path.write_bytes(encrypted)
    log.info("Selfie written: %s (%d bytes encrypted)", storage_key, len(encrypted))

    return {
        "storage_key":     storage_key,
        "file_hash":       file_hash,
        "mime_type":       "image/jpeg",
        "file_size_bytes": len(clean_jpeg),
        "width_px":        width,
        "height_px":       height,
    }


def read_selfie(storage_key: str) -> bytes:
    """
    Decrypt and return selfie bytes for a given storage key.
    Returns clean JPEG bytes (never cached; always decrypted on-the-fly).
    Raises FileNotFoundError if file does not exist.
    Raises ValueError if storage_key format is invalid.
    """
    # Validate key format to prevent path traversal
    try:
        uuid.UUID(storage_key, version=4)
    except ValueError:
        raise ValueError(f"Invalid storage key format: {storage_key!r}")

    file_path = _BASE_DIR / f"{storage_key}.enc"
    if not file_path.exists():
        raise FileNotFoundError(f"Selfie file not found: {storage_key}")

    encrypted = file_path.read_bytes()
    return _decrypt(encrypted)


def delete_selfie(storage_key: str) -> bool:
    """
    Permanently delete the encrypted selfie file from disk.
    Returns True if deleted, False if file was already absent.
    Raises ValueError if storage_key format is invalid.
    """
    try:
        uuid.UUID(storage_key, version=4)
    except ValueError:
        raise ValueError(f"Invalid storage key format: {storage_key!r}")

    file_path = _BASE_DIR / f"{storage_key}.enc"
    if file_path.exists():
        file_path.unlink()
        log.info("Selfie deleted from disk: %s", storage_key)
        return True
    log.warning("Delete requested but file not found: %s", storage_key)
    return False
