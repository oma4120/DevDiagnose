import logging
from copy import deepcopy

from pymongo import MongoClient

from app.config import get_settings
from app.repositories.mongo import MongoStore, public_user
from app.seed import seed_data
from app.services import seeding

# Re-exported for callers that import the collection list from app.db.
from app.services.seeding import _COLLECTIONS  # noqa: F401

logger = logging.getLogger("devdiagnose.db")


class Store:
    """Facade over MongoDB, plus a shared seed routine."""

    def __init__(self, backend: MongoStore) -> None:
        self.backend = backend
        self.seeded = False
        self._seed_payload = seed_data()
        self._current_user = deepcopy(self._seed_payload["currentUser"])
        self._company = deepcopy(self._seed_payload["company"])

    def current_user(self) -> dict:
        return deepcopy(self._current_user)

    def company(self) -> dict:
        doc = self.backend.find_one("company", "company")
        if doc:
            return deepcopy(doc)
        return deepcopy(self._company)

    def save_company(self, updates: dict) -> dict:
        doc = self.backend.find_one("company", "company") or {"id": "company"}
        doc.update(updates)
        self.backend.replace("company", doc)
        self._company = deepcopy(doc)
        return deepcopy(doc)

    def seed_if_empty(self, force: bool = False) -> None:
        """Load the demo dataset (when enabled) and normalize existing documents.

        `force` is used by `python -m app.reseed`, which must load the demo
        dataset regardless of the SEED_DEMO_DATA setting.
        """
        if self.seeded and not force:
            return
        seeding.migrate(self, self._current_user.get("id", "u1"))
        if force or get_settings().seed_demo_data:
            seeding.seed_demo(self, self._seed_payload)
        else:
            seeding.ensure_bootstrap_admin(self, self._seed_payload)
        self.seeded = True

    def migrate(self) -> None:
        """Normalize pre-existing documents to the current schema in place."""
        seeding.migrate(self, self._current_user.get("id", "u1"))

    # --- queries -----------------------------------------------------------
    def find_all(self, coll: str) -> list[dict]:
        return self.backend.find_all(coll)

    def find_one(self, coll: str, doc_id: str) -> dict | None:
        return self.backend.find_one(coll, doc_id)

    def find_one_by(self, coll: str, field: str, value: str) -> dict | None:
        return self.backend.find_one_by(coll, field, value)

    def insert(self, coll: str, doc: dict) -> dict:
        return self.backend.insert(coll, doc)

    def replace(self, coll: str, doc: dict) -> dict:
        return self.backend.replace(coll, doc)

    def patch(self, coll: str, doc_id: str, updates: dict) -> dict | None:
        """Update specific fields without rewriting the whole document."""
        return self.backend.patch(coll, doc_id, updates)

    def delete_one(self, coll: str, doc_id: str) -> None:
        self.backend.delete_one(coll, doc_id)

    def mark_all_read(self) -> list[dict]:
        return self.backend.mark_all_read()

    def claim_invite(self, invite_id: str, accepted_at: str) -> bool:
        return self.backend.claim_invite(invite_id, accepted_at)


_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = _connect()
    return _store


def _connect() -> Store:
    settings = get_settings()
    if not settings.mongo_uri:
        raise RuntimeError(
            "MONGODB_URI is not set. All data must live in MongoDB Atlas; "
            "set MONGODB_URI in backend/.env before starting."
        )
    last_exc: Exception | None = None
    for attempt in range(1, 4):
        try:
            client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            store = Store(MongoStore(client, settings.db_name))
            logger.info("Connected to MongoDB at %s", settings.mongo_uri.split("@")[-1])
            return store
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.warning("MongoDB attempt %d/3 failed: %s", attempt, exc)
    raise RuntimeError(
        "Could not connect to MongoDB Atlas; refusing to fall back to local storage."
    ) from last_exc
