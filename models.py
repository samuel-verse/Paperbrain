from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


# ── Auth ──

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserInfo(BaseModel):
    id: int
    email: str
    username: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


# ── RAG ──

class IngestRequest(BaseModel):
    context_tag: Optional[str] = None


class QueryRequest(BaseModel):
    query_text: str
    k: int = 14
    min_relevance: float = 0.7
    context_tag: Optional[str] = None


class QueryResponse(BaseModel):
    response: str
    sources: list[str]


class IndexResponse(BaseModel):
    documents: int
    chunks: int
    collection: str


class DocumentInfo(BaseModel):
    id: int
    filename: str
    source: str
    context_tag: Optional[str]
    chunks: int
    collection: str
    file_size: int
    created_at: Optional[str]