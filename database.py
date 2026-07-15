import os
import sqlite3
import json
from datetime import datetime, timedelta

DB_FILE = os.path.join(os.path.dirname(__file__), "users.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create OTP table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS otps (
            email TEXT PRIMARY KEY,
            otp TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    """)
    
    # Create user history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            title TEXT,
            source_name TEXT,
            question TEXT,
            analysis TEXT,
            extracted_text TEXT,
            timestamp TEXT,
            timestamp_display TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()

def create_user(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (email) VALUES (?)", (email.lower().strip(),))
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        # User already exists, retrieve ID
        cursor.execute("SELECT id FROM users WHERE email = ?", (email.lower().strip(),))
        row = cursor.fetchone()
        user_id = row['id'] if row else None
    conn.close()
    return user_id

def get_user_by_email(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def save_otp(email, otp_code, expires_in_minutes=10):
    conn = get_db_connection()
    cursor = conn.cursor()
    expires_at = datetime.now() + timedelta(minutes=expires_in_minutes)
    expires_at_str = expires_at.strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
        INSERT OR REPLACE INTO otps (email, otp, expires_at)
        VALUES (?, ?, ?)
    """, (email.lower().strip(), otp_code, expires_at_str))
    
    conn.commit()
    conn.close()

def verify_otp(email, otp_code):
    conn = get_db_connection()
    cursor = conn.cursor()
    current_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Find active non-expired OTP
    cursor.execute("""
        SELECT * FROM otps 
        WHERE email = ? AND otp = ? AND expires_at > ?
    """, (email.lower().strip(), otp_code, current_time_str))
    
    row = cursor.fetchone()
    
    if row:
        # Delete verified OTP
        cursor.execute("DELETE FROM otps WHERE email = ?", (email.lower().strip(),))
        conn.commit()
        conn.close()
        return True
        
    conn.close()
    return False

def load_history_for_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Order by timestamp desc
    cursor.execute("""
        SELECT * FROM history 
        WHERE user_id = ? 
        ORDER BY timestamp DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_history_for_user(user_id, entry):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Insert new entry
    cursor.execute("""
        INSERT OR REPLACE INTO history (id, user_id, title, source_name, question, analysis, extracted_text, timestamp, timestamp_display)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        entry.get("id"),
        user_id,
        entry.get("title"),
        entry.get("source_name"),
        entry.get("question"),
        entry.get("analysis"),
        entry.get("extracted_text"),
        entry.get("timestamp"),
        entry.get("timestamp_display")
    ))
    
    # Enforce MAX_HISTORY_ITEMS limit (keep top 50, delete rest)
    cursor.execute("""
        DELETE FROM history 
        WHERE user_id = ? AND id NOT IN (
            SELECT id FROM history 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 50
        )
    """, (user_id, user_id))
    
    conn.commit()
    conn.close()

def delete_history_item_for_user(user_id, item_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history WHERE user_id = ? AND id = ?", (user_id, item_id))
    conn.commit()
    conn.close()


def migrate_guest_history(guest_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Migrate any guest history entries to the logged-in user
    cursor.execute("UPDATE history SET user_id = ? WHERE user_id = ?", (user_id, guest_id))
    conn.commit()
    conn.close()

