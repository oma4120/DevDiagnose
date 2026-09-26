"""Reset MongoDB to the demo dataset in app/seed.py.

Usage (from the backend/ directory):

    python -m app.reseed

Wipes members, projects, bugs, notifications, recent activity, assignments,
invites and company settings, re-inserts the demo seed data, resets every
account password to the demo password and recomputes the project counters.
"""

from app.auth import DEMO_PASSWORD, hash_password
from app.db import _COLLECTIONS, get_store
from app.status_rules import project_bug_counts

_WIPE = [*_COLLECTIONS, "company"]


def main() -> None:
    store = get_store()
    before = {coll: store.backend.count(coll) for coll in _WIPE}

    for coll in _WIPE:
        store.backend.delete_all(coll)

    store.seeded = False
    store.seed_if_empty()

    hashed = hash_password(DEMO_PASSWORD)
    for member in store.find_all("members"):
        member["passwordHash"] = hashed
        store.replace("members", member)

    bugs = store.find_all("bugs")
    for project in store.find_all("projects"):
        project.update(
            project_bug_counts([b for b in bugs if b.get("projectId") == project["id"]])
        )
        store.replace("projects", project)

    print("DevDiagnose database reset to demo data")
    for coll in _WIPE:
        print(f"  {coll:<16} {before[coll]:>4} -> {store.backend.count(coll)}")
    print(f"  login           every account uses the password {DEMO_PASSWORD!r}")


if __name__ == "__main__":
    main()
