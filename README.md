# Paperbrain

A multi-user RAG (retrieval-augmented generation) platform that lets users upload documents and chat with them. Built as a portfolio project to demonstrate full-stack engineering from authentication and vector search to containerized deployment.

🎥 **Demo video:** *coming soon*

## What it does

Users sign up, upload PDFs or text files, and ask natural-language questions about their documents. Answers are grounded in the user's own corpus through vector similarity search each user only sees their own documents.

## Tech stack

- **Backend** : FastAPI · PostgreSQL + pgvector · LangChain · OpenAI embeddings & chat
- **Frontend** : React 18 · Vite · served via nginx in production
- **Auth** : JWT (PyJWT) + bcrypt password hashing
- **Messaging** : Apache Kafka (Confluent Platform) + Zookeeper
- **Infrastructure** : Docker Compose (app · consumer · postgres · kafka · zookeeper · frontend)

## Architecture highlights

- **Per-user isolation at the vector store level** : queries filter on a `user_id` metadata tag before similarity ranking, so a user cannot retrieve another user's chunks even with crafted queries.
- **JWT-based stateless auth** with bcrypt password hashing and configurable token expiry via `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Async ingestion via Kafka** : `POST /index` publishes an event to a Kafka topic (returns 202 immediately); a dedicated `consumer` service picks up the job, chunks the document, and indexes it into pgvector — decoupling upload latency from embedding time.
- **Pluggable ingestion pipeline** : UTF-8 text and PDF (via `pypdf`) extraction, chunked with `RecursiveCharacterTextSplitter`, indexed in pgvector with JSONB metadata.
- **Optional `context_tag`** lets a user partition their own corpus (e.g. one tag per project) without needing separate Postgres collections.
- **Document tracking and deletion** : each upload is logged in a `user_documents` table; users can delete a document (chunks + record) via the UI or `DELETE /documents/{id}`.

## Security considerations

- Passwords hashed with bcrypt
- JWT secret loaded from environment, never hardcoded; startup fails fast if missing
- User isolation enforced at query time via metadata filtering (see `api.py:query`)
- File uploads validated for content type, with a 50 MB limit at the nginx layer
- `.env` excluded from version control; `.env.example` documents required variables
- Rate limiting on auth endpoints via `slowapi` (5 req/min on register, 10 req/min on login)
- CORS origins configurable via `ALLOWED_ORIGINS` env var; defaults to `*` only when the variable is unset

**Known limitations** (for transparency, since this is a portfolio project):

- No refresh token rotation
- Debug `print` statements removed from auth; structured logging not yet in place

## Quick start

```bash
git clone https://github.com/samuel-verse/Paperbrain.git
cd Paperbrain
cp .env.example .env          # then edit .env and add your OpenAI key
docker compose up --build
```

- Frontend: http://localhost:3000
- API + Swagger docs: http://localhost:8000/docs

Get an OpenAI API key at https://platform.openai.com/api-keys.

## Project structure

```
.
├── api.py               : FastAPI app — auth, /index, /query, /documents endpoints
├── auth.py              : JWT, bcrypt, user DB helpers, FastAPI dependency
├── kafka_client.py      : Kafka producer — publishes indexing jobs to the topic
├── consumer.py          : Kafka consumer worker — chunks & indexes documents async
├── models.py            : Pydantic request/response models
├── vector_store.py      : pgvector connection, collection setup, PDF/text extraction
├── create_database.py   : bulk ingestion script for markdown files in data/books
├── query_data.py        : CLI query script (similarity search + LLM)
├── docker-compose.yml   : postgres + kafka + zookeeper + app + consumer + frontend
├── init.sql             : CREATE EXTENSION vector + users + user_documents tables
├── requirements.txt
└── rag-frontend/        : React + Vite frontend, served via nginx in production
```

## Environment variables

Create a `.env` file in the repo root (use `.env.example` as a template):

```
OPENAI_API_KEY=your_openai_key
JWT_SECRET=change-me-to-a-long-random-string
PGVECTOR_COLLECTION=default

# Token expiry in minutes (default: 60)
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Comma-separated allowed origins for CORS (default: * when unset)
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Used when PGVECTOR_CONNECTION is not set
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ragdb
POSTGRES_USER=raguser
POSTGRES_PASSWORD=ragpass

# Kafka broker address (default: localhost:29092)
KAFKA_BOOTSTRAP_SERVERS=localhost:29092
```

Notes:

- In Docker Compose, `PGVECTOR_CONNECTION` and `KAFKA_BOOTSTRAP_SERVERS` are already set for the app and consumer services.
- If `PGVECTOR_CONNECTION` is present, it takes precedence over the individual `POSTGRES_*` variables.

## Run with Docker (recommended)

```bash
docker compose up --build
```

What happens under the hood:

- Postgres runs from `pgvector/pgvector:pg16`.
- `init.sql` is mounted into `/docker-entrypoint-initdb.d/` so `CREATE EXTENSION vector` and the `users` / `user_documents` tables are created on first initialization.
- The app entrypoint runs `create_vector_store()` before launching Uvicorn, so the collection and indexes are ready before the first request.
- Zookeeper and Kafka (Confluent Platform 7.6) start alongside Postgres; the app waits for both before accepting requests.
- The `consumer` service runs `consumer.py` in a separate container, polling the `test` Kafka topic and indexing documents asynchronously.
- The frontend is built with Vite, then served by nginx, which also proxies `/api/*` to the backend.

## Run locally (without Docker)

```bash
python -m venv .venv
source .venv/bin/activate          # Linux/Mac
# .venv\Scripts\activate           # Windows
pip install -r requirements.txt

# Make sure a Postgres instance with the pgvector extension is reachable
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

For the frontend (in another terminal):

```bash
cd rag-frontend
npm install
npm run dev                        # http://localhost:5173 by default
```

The Vite config proxies `/api` to `http://localhost:8000`, so you don't need nginx in dev.

## API reference

### Authentication

| Method | Path             | Description                              |
| ------ | ---------------- | ---------------------------------------- |
| POST   | `/auth/register` | Create a new account                     |
| POST   | `/auth/login`    | Get a JWT access token (JSON body)       |
| GET    | `/auth/me`       | Return the current user (requires token) |

All non-auth endpoints below require `Authorization: Bearer <token>`.

### Documents and queries

| Method | Path                  | Description                                                     |
| ------ | --------------------- | --------------------------------------------------------------- |
| GET    | `/documents`          | List documents uploaded by the current user                     |
| POST   | `/index`              | Upload a file: queues it for async indexing (returns 202)      |
| DELETE | `/documents/{doc_id}` | Delete a document's chunks and tracking record                  |
| POST   | `/query`              | Ask a question against the current user's corpus                |

### Ingestion example

The `/index` endpoint returns `202 Accepted` immediately; actual indexing happens asynchronously in the consumer service.

```bash
curl -X POST "http://localhost:8000/index?reset_collection=false&context_tag=book" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/alice_in_wonderland.md"
```

Optional query parameters:

- `metadata_json` : a JSON object as a string, merged into each chunk's metadata
- `reset_collection` : boolean (default `false`)
- `context_tag` : string, written into each chunk's metadata for later filtering

### Query example

```bash
curl -X POST "http://localhost:8000/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query_text": "Who is Alice?",
    "k": 3,
    "min_relevance": 0.7,
    "context_tag": "book"
  }'
```

## Script-based workflows

Bulk-index markdown files under `data/books/` and reset the collection:

```bash
python create_database.py
```

Run a one-off query from the CLI:

```bash
python query_data.py "What happens to Alice?"
```

## Testing

```bash
pytest -q
```

Current tests cover:

- `test_models.py` : API data models
- `test_vector_store.py` : file-content extraction behavior

## Troubleshooting

- **`Unable to find matching results`** : lower `min_relevance` or index more data.
- **`Uploaded file must be UTF-8 text or PDF`** : upload UTF-8 text or a PDF with extractable text (scanned PDFs without OCR will fail).
- **Connection errors on startup** : verify Postgres is reachable and `.env` credentials match the actual database.
- **422 on Swagger "Authorize"** : the login endpoint expects JSON, not OAuth2 form. Log in via the `POST /auth/login` endpoint directly to get a token, or use the dedicated `/auth/token` endpoint if configured.
- **Document not appearing after upload** : indexing is async wait a moment and refresh. If it never appears, check the `consumer` container logs (`docker compose logs consumer`) for errors.
- **`Kafka pas encore pret`** in consumer logs : normal at startup; the consumer retries every 3 s until Kafka is ready.

## About

Built by [Samuel Verse](https://samuel-verse.com/) : Software Engineer.
