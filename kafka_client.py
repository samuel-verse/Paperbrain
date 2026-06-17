import os
from kafka import KafkaProducer

# Lit l'adresse dans une variable d'env, avec une valeur par défaut pour le local
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:29092")

producer = KafkaProducer(bootstrap_servers=BOOTSTRAP_SERVERS)

def publish_event(message: bytes):
    producer.send('test', message)
    producer.flush()
    print("Message sent successfully")
