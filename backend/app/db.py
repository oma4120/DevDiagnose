import logging
from copy import deepcopy
from uuid import uuid4

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError, ServerSelectionTimeoutError

from app.auth import DEMO_PASSWORD, hash_password
from app.config import get_settings
from app.seed import seed_data

logger = logging.getLogger("devdiagnose.db")

_COLLECTIONS = [
    "members",
    "projects",
    "bugs",
    "notifications",
    "recentActivity",
    "bug_assignments",
    "invites",
]

_SECRET_KEYS = {"passwordHash", "inviteTokenHash", "inviteSentAt", "inviteExpiresAt"}


def public_user(doc: dict) -> dict:
    """Drop credential fields before a document leaves the API."""
    return {k: v for k, v in doc.items() if k not in _SECRET_KEYS}


class MongoStore:
    """MongoDB-backed store. Documents use their natural string `id` as `_id`."""

    def __init__(self, client: MongoClient, db_name: str) -> None:
        self._db = client[db_name]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        try:
            self._db["members"].create_index([("email", 1)], unique=True)
            self._db["bugs"].create_index([("projectId", 1), ("status", 1)])
            self._db["bug_assignments"].create_index([("bugId", 1)])
            self._db["bug_assignments"].create_index(
                [("developerId", 1), ("status", 1)]
            )
            self._db["notifications"].create_index([("read", 1)])
        except (DuplicateKeyError, PyMongoError):
            pass

    def _collection(self, coll: str):
        return self._db[coll]

    def count(self, coll: str) -> int:
        return self._db[coll].estimated_document_count()

    def find_all(self, coll: str) -> list[dict]:
        return [self._strip(doc) for doc in self._db[coll].find()]

    def find_one(self, coll: str, doc_id: str) -> dict | None:
        doc = self._db[coll].find_one({"_id": doc_id})
        return self._strip(doc) if doc else None

    def find_one_by(self, coll: str, field: str, value: str) -> dict | None:
        doc = self._db[coll].find_one({field: {"$regex": f"^{value}$", "$options": "i"}})
        return self._strip(doc) if doc else None

    def insert(self, coll: str, doc: dict) -> dict:
        self._db[coll].insert_one({"_id": doc["id"], **doc})
        return deepcopy(doc)

    def replace(self, coll: str, doc: dict) -> dict:
        self._db[coll].replace_one({"_id": doc["id"]}, {**doc, "_id": doc["id"]}, upsert=True)
        return deepcopy(doc)

    def delete_one(self, coll: str, doc_id: str) -> None:
        self._db[coll].delete_one({"_id": doc_id})

    def delete_all(self, coll: str) -> None:
        self._db[coll].delete_many({})

    def mark_all_read(self) -> list[dict]:
        self._db["notifications"].update_many({}, {"$set": {"read": True}})
        return self.find_all("notifications")

    @staticmethod
    def _strip(doc: dict) -> dict:
        doc.pop("_id", None)
        return doc


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

    def seed_if_empty(self) -> None:
        if self.seeded:
            return
        for coll in _COLLECTIONS:
            if self.backend.count(coll) == 0 and coll in self._seed_payload:
                for doc in self._seed_payload[coll]:
                    self.backend.insert(coll, doc)
        if self.backend.count("company") == 0:
            self.backend.insert("company", {"id": "company", **self._seed_payload["company"]})
        self.seeded = True
        self.migrate()

    def migrate(self) -> None:
        """Normalize pre-existing documents to the current schema in place."""
        hashed = hash_password(DEMO_PASSWORD)
        fallback = self._current_user.get("id", "u1")

        for member in self.backend.find_all("members"):
            changed = False
            if not member.get("passwordHash"):
                member["passwordHash"] = hashed
                changed = True
            if not member.get("status"):
                member["status"] = "Active"
                changed = True
            if changed:
                self.backend.replace("members", member)

        for bug in self.backend.find_all("bugs"):
            changed = False
            if bug.get("status") == "Resolved" and not bug.get("resolvedAt"):
                bug["resolvedBy"] = bug.get("resolvedBy") or bug.get("reporterId") or fallback
                bug["resolvedAt"] = bug.get("updatedAt") or bug.get("createdAt") or "imported"
                changed = True
            if bug.get("status") == "Closed":
                bug["closedAt"] = bug.get("updatedAt") or bug.get("createdAt") or "imported"
                if not bug.get("resolvedAt"):
                    bug["resolvedBy"] = bug.get("resolvedBy") or bug.get("reporterId") or fallback
                    bug["resolvedAt"] = bug.get("resolvedAt") or bug.get("updatedAt") or bug.get("createdAt")
                changed = True
            for ev in bug.get("evidence", []):
                if isinstance(ev, dict):
                    if "fileUrl" not in ev:
                        ev["fileUrl"] = None
                        changed = True
                    if "metadata" not in ev:
                        ev["metadata"] = {}
                        changed = True
            for an in bug.get("analyses", []):
                if not isinstance(an, dict):
                    continue
                fix = an.get("suggestedFix")
                if isinstance(fix, str):
                    an["suggestedFix"] = {"summary": fix, "steps": [], "code": None}
                    changed = True
                if isinstance(an.get("uncertainty"), list):
                    an["uncertainty"] = (
                        " ".join(str(u) for u in an["uncertainty"]) if an["uncertainty"] else None
                    )
                    changed = True
                if "inputContext" not in an:
                    an["inputContext"] = {}
                    changed = True
            if changed:
                self.backend.replace("bugs", bug)

        if self.backend.count("bug_assignments") == 0:
            for bug in self.backend.find_all("bugs"):
                for dev_id in bug.get("assigneeIds", []):
                    self.backend.insert(
                        "bug_assignments",
                        {
                            "id": f"ba{uuid4().hex[:8]}",
                            "bugId": bug["id"],
                            "developerId": dev_id,
                            "assignedBy": bug.get("reporterId") or fallback,
                            "assignedAt": bug.get("createdAt", "imported"),
                            "unassignedAt": None,
                            "status": "active",
                        },
                    )

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

    def delete_one(self, coll: str, doc_id: str) -> None:
        self.backend.delete_one(coll, doc_id)

    def mark_all_read(self) -> list[dict]:
        return self.backend.mark_all_read()


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