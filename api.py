import json
import os
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi import File, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from langchain.schema import Document
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from create_database import (
    split_text,
    save_to_pgvector,
    set_context_tag,
)
from models import (
    RegisterRequest, LoginRequest, AuthResponse, UserInfo,
    QueryRequest, QueryResponse, IndexResponse, DocumentInfo,
)
from query_data import PROMPT_TEMPLATE
from vector_store import create_vector_store, get_collection_name, extract_content_from_bytes,delete_document_chunks
from auth import (
    get_user_by_email, get_user_by_username, create_user,
    verify_password, create_access_token, get_current_user,
    track_document, get_user_documents,check_user_documents,delete_document
)
from kafka_client import publish_event


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="RAG API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════
#  AUTH ENDPOINTS
# ══════════════════════════════════════════

@app.post("/auth/register", response_model=AuthResponse)
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest):
    if get_user_by_email(req.email):
        raise HTTPException(status_code=400, detail="Email already registered.")
    if get_user_by_username(req.username):
        raise HTTPException(status_code=400, detail="Username already taken.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    user = create_user(req.email, req.username, req.password)
    token = create_access_token({"sub": user["id"]})
    return AuthResponse(access_token=token, user=UserInfo(**user))


@app.post("/auth/login", response_model=AuthResponse)
@limiter.limit("10/minute")
def login(request: Request, req: OAuth2PasswordRequestForm = Depends()):
    user = get_user_by_email(req.username)
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token({"sub": user["id"]})
    return AuthResponse(
        access_token=token,
        user=UserInfo(id=user["id"], email=user["email"], username=user["username"]),
    )


@app.get("/auth/me", response_model=UserInfo)
def me(current_user: dict = Depends(get_current_user)):
    return UserInfo(**current_user)


# ══════════════════════════════════════════
#  DOCUMENTS (user-scoped)
# ══════════════════════════════════════════

@app.get("/documents", response_model=list[DocumentInfo])
def list_documents(current_user: dict = Depends(get_current_user)):
    return get_user_documents(current_user["id"])


@app.post("/index", status_code=202)
def index_documents(
    file: UploadFile = File(...),
    metadata_json: str | None = Query(default=None),
    reset_collection: bool = Query(default=False),
    context_tag: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    try:
        base_metadata = {}
        if metadata_json:
            loaded_metadata = json.loads(metadata_json)
            if not isinstance(loaded_metadata, dict):
                raise HTTPException(status_code=400, detail="metadata_json must be a JSON object.")
            base_metadata = loaded_metadata
        resolved_source = file.filename or "api_document"
        if "source" not in base_metadata:
            base_metadata["source"] = resolved_source

        base_metadata["user_id"] = str(current_user["id"])

        raw_bytes = file.file.read()
        content = extract_content_from_bytes(raw_bytes, resolved_source)

        publish_event({
            "type": "index_document",
            "content": content,
            "metadata": base_metadata,
            "context_tag": context_tag,
            "reset_collection": reset_collection,
            "user_id": current_user["id"],
            "filename": file.filename or "api_document",
            "source": resolved_source,
            "file_size": len(raw_bytes),
            })

        return {"status": "queued", "filename": file.filename or "api_document"}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.delete("/documents/{doc_id}", status_code=204)
def delete_document_endpoint(doc_id: int, current_user: dict = Depends(get_current_user)):
        user_doc = check_user_documents(doc_id, current_user["id"])
        if user_doc is None:
            raise HTTPException(status_code=404, detail="Document not found.")

        delete_document_chunks(current_user["id"],user_doc["source"],user_doc.get("context_tag"))
        delete_document(doc_id,current_user["id"])


@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest, current_user: dict = Depends(get_current_user)):
    try:
        db = create_vector_store(OpenAIEmbeddings())

        query_filter = {"user_id": str(current_user["id"])}
        if request.context_tag:
            query_filter["context_tag"] = request.context_tag

        results = db.similarity_search_with_relevance_scores(
            request.query_text,
            k=request.k,
            filter=query_filter,
        )
        if len(results) == 0 or results[0][1] < request.min_relevance:
            raise HTTPException(status_code=404, detail="Unable to find matching results.")
        context_text = "\n\n---\n\n".join([doc.page_content for doc, _score in results])
        prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE).format(
            context=context_text, question=request.query_text
        )
        response_text = ChatOpenAI().invoke(prompt).content
        sources = [doc.metadata.get("source", "") for doc, _score in results]
        return QueryResponse(response=response_text, sources=sources)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
