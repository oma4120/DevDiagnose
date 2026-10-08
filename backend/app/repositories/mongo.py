import re
from copy import deepcopy

from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

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
        # Escape the needle: without this, regex metacharacters in a login email
        # or invite address change which document matches.
        doc = self._db[coll].find_one({field: {"$regex": f"^{re.escape(value)}$", "$options": "i"}})
        return self._strip(doc) if doc else None

    def claim_invite(self, invite_id: str, accepted_at: str) -> bool:
        """Atomically move a pending invite to `accepted`; False if already claimed."""
        result = self._db["invites"].update_one(
            {"_id": invite_id, "status": "pending"},
            {"$set": {"status": "accepted", "acceptedAt": accepted_at}},
        )
        return result.modified_count == 1

    def insert(self, coll: str, doc: dict) -> dict:
        self._db[coll].insert_one({"_id": doc["id"], **doc})
        return deepcopy(doc)

    def replace(self, coll: str, doc: dict) -> dict:
        self._db[coll].replace_one({"_id": doc["id"]}, {**doc, "_id": doc["id"]}, upsert=True)
        return deepcopy(doc)

    def patch(self, coll: str, doc_id: str, updates: dict) -> dict | None:
        self._db[coll].update_one({"_id": doc_id}, {"$set": updates})
        return self.find_one(coll, doc_id)

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
