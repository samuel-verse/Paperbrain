import os
import time
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:29092")

def make_consumer():
    while True:
        try:
            return KafkaConsumer('test', bootstrap_servers=BOOTSTRAP_SERVERS, auto_offset_reset="earliest")
        except NoBrokersAvailable:
            print("Kafka pas encore pret, nouvel essai dans 3s...", flush=True)
            time.sleep(3)

consumer = make_consumer()
print("Consumer connecte, en attente de messages...", flush=True)
for message in consumer:
    print(message.value, flush=True)