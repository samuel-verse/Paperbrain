from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import psycopg
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer
import jwt
import bcrypt
from dotenv import load_dotenv

from vector_store import get_psycopg_connection

load_dotenv()


SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET is not set. Define it in your .env file "
        "(see _env.example)"
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Password helpers ──

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT helpers ──

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ── Database helpers ──

def get_user_by_email(email: str) -> dict | None:
    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, username, hashed_password FROM users WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
    if row is None:
        return None
    return {"id": row[0], "email": row[1], "username": row[2], "hashed_password": row[3]}


def get_user_by_username(username: str) -> dict | None:
    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, username, hashed_password FROM users WHERE username = %s",
                (username,),
            )
            row = cur.fetchone()
    if row is None:
        return None
    return {"id": row[0], "email": row[1], "username": row[2], "hashed_password": row[3]}


def create_user(email: str, username: str, password: str) -> dict:
    hashed = hash_password(password)
    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, username, hashed_password) VALUES (%s, %s, %s) RETURNING id",
                (email, username, hashed),
            )
            user_id = cur.fetchone()[0]
        conn.commit()
    return {"id": user_id, "email": email, "username": username}


# ── Document tracking ──

def track_document(user_id: int, filename: str, source: str, context_tag: str | None,
                   chunks: int, collection: str, file_size: int):
    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO user_documents (user_id, filename, source, context_tag, chunks, collection, file_size)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (user_id, filename, source, context_tag, chunks, collection, file_size),
            )
        conn.commit()


def get_user_documents(user_id: int) -> list[dict]:
    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, filename, source, context_tag, chunks, collection, file_size, created_at
                   FROM user_documents WHERE user_id = %s ORDER BY created_at DESC""",
                (user_id,),
            )
            rows = cur.fetchall()
    return [
        {
            "id": r[0], "filename": r[1], "source": r[2], "context_tag": r[3],
            "chunks": r[4], "collection": r[5], "file_size": r[6],
            "created_at": r[7].isoformat() if r[7] else None,
        }
        for r in rows
    ]


def get_document(doc_id: int, user_id: int) -> dict | None:
    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, source, context_tag FROM user_documents WHERE id = %s AND user_id = %s",
                (doc_id, user_id),
            )
            row = cur.fetchone()
    if row is None:
        return None
    return {"id": row[0], "source": row[1], "context_tag": row[2]}


def delete_document(doc_id: int, user_id: int) -> int:
    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM user_documents WHERE id = %s AND user_id = %s",
                (doc_id, user_id),
            )
            deleted = cur.rowcount
        conn.commit()
    return deleted


# ── FastAPI dependency ──

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        print(f"[AUTH] Decoding token: {token[:20]}...")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        print(f"[AUTH] Decoded payload sub={user_id}")
        if user_id is None:
            print("[AUTH] FAIL: sub is None")
            raise credentials_exception
    except jwt.PyJWTError as e:
        print(f"[AUTH] FAIL: JWT decode error: {e}")
        raise credentials_exception

    with psycopg.connect(get_psycopg_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, username FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
    if row is None:
        print(f"[AUTH] FAIL: user {user_id} not found in DB")
        raise credentials_exception
    print(f"[AUTH] OK: user {row[2]}")
    return {"id": row[0], "email": row[1], "username": row[2]}
