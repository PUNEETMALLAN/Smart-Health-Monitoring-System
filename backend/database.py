import os
import socket
import uuid

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except Exception:
    AsyncIOMotorClient = None


def _mongo_available():
    try:
        with socket.create_connection(("localhost", 27017), timeout=1):
            return True
    except OSError:
        return False


class MemoryCollection:
    def __init__(self, name):
        self.name = name
        self._documents = []

    def _matches(self, doc, query):
        if not query:
            return True
        for key, value in query.items():
            if key == "$set":
                continue
            if key not in doc:
                return False
            if doc[key] != value:
                return False
        return True

    async def find_one(self, query):
        for doc in self._documents:
            if self._matches(doc, query):
                return doc
        return None

    async def insert_one(self, doc):
        doc = dict(doc)
        doc.setdefault("_id", str(uuid.uuid4()))
        self._documents.append(doc)
        return type("InsertResult", (), {"inserted_id": doc["_id"]})()

    async def update_one(self, query, update, upsert=False):
        payload = update.get("$set", {}) if isinstance(update, dict) else {}
        document = await self.find_one(query)
        if document is None:
            if not upsert:
                return type("UpdateResult", (), {"matched_count": 0, "modified_count": 0})()
            new_doc = dict(query)
            new_doc.update(payload)
            self._documents.append(new_doc)
            return type("UpdateResult", (), {"matched_count": 0, "modified_count": 1, "upserted_id": new_doc.get("_id")})()

        for key, value in payload.items():
            document[key] = value
        return type("UpdateResult", (), {"matched_count": 1, "modified_count": 1})()

    async def delete_one(self, query):
        for index, document in enumerate(self._documents):
            if self._matches(document, query):
                del self._documents[index]
                return type("DeleteResult", (), {"deleted_count": 1})()
        return type("DeleteResult", (), {"deleted_count": 0})()

    def find(self, query):
        docs = [doc for doc in self._documents if self._matches(doc, query)]
        return MemoryCursor(docs)


class MemoryCursor:
    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, length=100):
        return self._docs[:length]


# In a real production app, these would be environment variables
MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb://localhost:27017")

client = None
user_collection = None
health_logs_collection = None

if AsyncIOMotorClient is not None and _mongo_available():
    try:
        client = AsyncIOMotorClient(MONGO_DETAILS)
        database = client.smart_health_db
        user_collection = database.get_collection("users")
        health_logs_collection = database.get_collection("health_logs")
    except Exception:
        client = None

if user_collection is None:
    user_collection = MemoryCollection("users")
if health_logs_collection is None:
    health_logs_collection = MemoryCollection("health_logs")


async def create_user(user_data):
    await user_collection.insert_one(user_data)


async def get_user(user_id):
    return await user_collection.find_one({"_id": user_id})


async def save_health_log(log_data):
    await health_logs_collection.insert_one(log_data)


async def get_health_history(user_id):
    cursor = health_logs_collection.find({"user_id": user_id})
    return await cursor.to_list(length=100)
