import os
import time
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable
import json
from langchain.schema import Document
from create_database import split_text, save_to_pgvector, set_context_tag
from vector_store import get_collection_name
from auth import track_document


BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:29092")

def make_consumer():
    while True:
        try:
            return KafkaConsumer(
                'test',
                bootstrap_servers=BOOTSTRAP_SERVERS,
                group_id="rag-indexer",
                auto_offset_reset="earliest",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            )
        except NoBrokersAvailable:
            print("Kafka pas encore pret, nouvel essai dans 3s...", flush=True)
            time.sleep(3)

consumer = make_consumer()
print("Consumer connecte, en attente de jobs...", flush=True)
for message in consumer:
    event = message.value
    try:
        documents = [Document(page_content=event["content"], metadata=event["metadata"])]
        chunks = split_text(documents)
        chunks = set_context_tag(chunks, event.get("context_tag"))
        save_to_pgvector(chunks, pre_delete_collection=event.get("reset_collection", False))
        track_document(
            user_id=event["user_id"],
            filename=event["filename"],
            source=event["source"],
            context_tag=event.get("context_tag"),
            chunks=len(chunks),
            collection=get_collection_name(),
            file_size=event.get("file_size", 0),
        )
        print(f"[worker] Indexe: {event['filename']} ({len(chunks)} chunks)", flush=True)
    except Exception as exc:
        print(f"[worker] ERREUR: {exc}", flush=True)
