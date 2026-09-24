"""Core security helpers for password validation, hashing, and token checks.
Aligned with next-fastapi-starter and clean modular architecture.
"""
import hashlib
import hmac
import os
import re
from typing import List, Optional

def validate_password_rules(password: str, email: Optional[str] = None) -> List[str]:
    """Validate standard enterprise password complexity rules."""
    errors: List[str] = []
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if email and email.lower() in password.lower():
        errors.append("Password must not contain the user's email address.")
    if not any(char.isupper() for char in password):
        errors.append("Password must contain at least one uppercase letter.")
    if not any(char.islower() for char in password):
        errors.append("Password must contain at least one lowercase letter.")
    if not any(char.isdigit() for char in password):
        errors.append("Password must contain at least one digit.")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Password must contain at least one special character.")
    return errors

def hash_password(password: str) -> str:
    """Hash a password using salted PBKDF2-HMAC-SHA256."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    """Verify a plain password against the stored salted hash."""
    try:
        parts = hashed.split(":")
        if len(parts) != 2:
            return False
        salt = bytes.fromhex(parts[0])
        expected_key = bytes.fromhex(parts[1])
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return hmac.compare_digest(key, expected_key)
    except Exception:
        return False
