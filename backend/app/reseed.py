"""Reset MongoDB to the demo dataset in app/seed.py.

Usage (from the backend/ directory):

    python -m app.reseed

DESTRUCTIVE: wipes members, projects, bugs, notifications, recent activity,
assignments, invites and company settings, re-inserts the demo seed data,
resets every account password to the demo password and recomputes the project
counters. There is no confirmation and no environment guard, so this must never
be pointed at a real workspace.
"""

import os
import sys

from app.auth import hash_password
from app.db import _COLLECTIONS, get_store
from app.seed import DEMO_PASSWORD
from app.status_rules import project_bug_counts

_WIPE = [*_COLLECTIONS, "company"]

# Opt-in acknowledgement for the non-demo database names.
_GUARDED = {"devdiagnose", "devdiagnosedev", "devdiagnoselocal", "devdiagnosetest"}


def _confirm(db_name: str) -> bool:
    if db_name.lower() in _GUARDED:
        return True
    if os.environ.get("DEVDIAGNOSE_ALLOW_RESEED") == "1":
        return True
    print(
        f"Refusing to wipe database {db_name!r}: it does not look like a local demo "
        "database. Set DEVDIAGNOSE_ALLOW_RESEED=1 if you are certain."
    )
    return False


def main() -> None:
    store = get_store()
    db_name = store.backend._db.name  # noqa: SLF001 - guard needs the real target
    if not _confirm(db_name):
        sys.exit(1)

    before = {coll: store.backend.count(coll) for coll in _WIPE}

    for coll in _WIPE:
        store.backend.delete_all(coll)

    store.seeded = False
    store.seed_if_empty(force=True)

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
