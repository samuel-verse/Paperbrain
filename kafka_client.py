import json
import os
from kafka import KafkaProducer

# Lit l'adresse dans une variable d'env, avec une valeur par défaut pour le local
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:29092")

producer = KafkaProducer(
    bootstrap_servers=BOOTSTRAP_SERVERS,
    value_serializer=lambda v: json.dumps(v).encode('utf-8')   
)

def publish_event(event: dict):
    producer.send('test', value=event)   
    producer.flush()