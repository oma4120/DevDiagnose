"""In-memory Store double shared by the HTTP-layer test modules.

The routers only reach the Store facade (`find_all`, `find_one`, `find_one_by`,
`insert`, `replace`, `patch`, `delete_one`, `count`, `company`) plus one
Mongo-only call through `store.backend` (`claim_invite`). One fake therefore
serves every router under test without a database.

Unlike the real MongoStore, `find_one` returns the stored document itself, so
router-side mutations are visible to later assertions - which is what the tests
want when they check that an endpoint actually wrote something.
"""

from fastapi import FastAPI

from app.deps import get_current_user


class FakeBackend:
    """Only `claim_invite` is reached through `store.backend`."""

    def __init__(self, store: "FakeStore") -> None:
        self._store = store

    def claim_invite(self, invite_id: str, accepted_at: str) -> bool:
        """Flip pending -> accepted exactly once, mirroring the Mongo update."""
        for invite in self._store.collections.get("invites", []):
            if invite.get("id") == invite_id and invite.get("status") == "pending":
                invite["status"] = "accepted"
                invite["acceptedAt"] = accepted_at
                return True
        return False


class FakeStore:
    def __init__(
        self,
        *,
        projects: list[dict] | None = None,
        bugs: list[dict] | None = None,
        members: list[dict] | None = None,
        invites: list[dict] | None = None,
        notifications: list[dict] | None = None,
        company: dict | None = None,
    ) -> None:
        self.collections = {
            "projects": [dict(p) for p in (projects or [])],
            "bugs": [dict(b) for b in (bugs or [])],
            "members": [dict(m) for m in (members or [])],
            "invites": [dict(i) for i in (invites or [])],
            "notifications": [dict(n) for n in (notifications or [])],
            "recentActivity": [],
            "bug_assignments": [],
        }
        self.backend = FakeBackend(self)
        self.inserted: list[tuple[str, dict]] = []
        self._company = company or {
            "id": "company",
            "name": "Northwind Labs",
            "workspace": "northwind",
            "hasQA": True,
            "logo": "",
        }

    # --- Store facade -------------------------------------------------------

    def seed_if_empty(self, force: bool = False) -> None:
        return None

    def find_all(self, collection: str, **kwargs) -> list[dict]:
        return list(self.collections.get(collection, []))

    def find_one(self, collection: str, doc_id: str) -> dict | None:
        for doc in self.collections.get(collection, []):
            if doc.get("id") == doc_id:
                return doc
        return None

    def find_one_by(self, collection: str, field: str, value) -> dict | None:
        for doc in self.collections.get(collection, []):
            if doc.get(field) == value:
                return doc
        return None

    def insert(self, collection: str, doc: dict) -> dict:
        self.collections.setdefault(collection, []).append(doc)
        self.inserted.append((collection, doc))
        return doc

    def replace(self, collection: str, doc: dict) -> dict:
        docs = self.collections.setdefault(collection, [])
        for i, existing in enumerate(docs):
            if existing.get("id") == doc.get("id"):
                docs[i] = doc
                return doc
        docs.append(doc)
        return doc

    def patch(self, collection: str, doc_id: str, updates: dict) -> dict | None:
        for doc in self.collections.setdefault(collection, []):
            if doc.get("id") == doc_id:
                doc.update(updates)
                return doc
        return None

    def delete_one(self, collection: str, doc_id: str) -> None:
        docs = self.collections.setdefault(collection, [])
        self.collections[collection] = [d for d in docs if d.get("id") != doc_id]

    def count(self, collection: str) -> int:
        return len(self.collections.get(collection, []))

    def company(self) -> dict:
        return dict(self._company)


def build_app(*routers) -> FastAPI:
    """Mount routers under /api exactly as app.main does."""
    app = FastAPI()
    for router in routers:
        app.include_router(router, prefix="/api")
    return app


def sign_in_as(app: FastAPI, user: dict) -> None:
    """Replace the auth dependency with a fixed caller (cookie-free tests)."""
    app.dependency_overrides[get_current_user] = lambda: user
