import sqlite3
import os

DB_PATH = '/app/backend/vulnerabilities.db'
SQL_INIT_SCRIPT = '/app/backend/init_db.sql'

def init_db():
    """Initialize the SQLite database."""
    if os.path.exists(DB_PATH):
        print("Database already initialized.")
        return

    # Connect to SQLite DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Execute the schema and insert patterns
    with open(SQL_INIT_SCRIPT, 'r') as f:
        sql_script = f.read()

    cursor.executescript(sql_script)
    conn.commit()
    conn.close()
    print("Database initialized successfully!")

if __name__ == '__main__':
    init_db()
