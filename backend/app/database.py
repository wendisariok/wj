import sqlite3
import os
from contextlib import contextmanager
from . import config


def get_db_path() -> str:
    return config.DATABASE_PATH


def init_db():
    """Initialize database with schema from migration files."""
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrations")

    with sqlite3.connect(db_path) as conn:
        for filename in sorted(os.listdir(migrations_dir)):
            if filename.endswith(".sql"):
                filepath = os.path.join(migrations_dir, filename)
                with open(filepath, "r") as f:
                    sql = f.read()
                # For migrations with ALTER TABLE, execute statements individually
                # so that "duplicate column" errors don't abort the whole script
                if "ALTER TABLE" in sql:
                    for statement in sql.split(";"):
                        statement = statement.strip()
                        if statement and not statement.startswith("--"):
                            try:
                                conn.execute(statement)
                            except sqlite3.OperationalError:
                                # Column already exists — safe to ignore
                                pass
                else:
                    conn.executescript(sql)
        conn.commit()


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


def dict_from_row(row: sqlite3.Row) -> dict:
    """Convert a sqlite3.Row to a dictionary."""
    return dict(row)
