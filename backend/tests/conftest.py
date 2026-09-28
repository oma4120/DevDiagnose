import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Every router module reads settings at import time, and Settings now refuses to
# build without a real JWT_SECRET. Provide one before anything is imported.
os.environ.setdefault("JWT_SECRET", "test-secret-value-that-is-long-enough")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "devdiagnosetest")


@pytest.fixture(autouse=True)
def _no_demo_seed(monkeypatch):
    """Never load the demo dataset in tests."""
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "seed_demo_data", False, raising=False)
