from motor.motor_asyncio import AsyncIOMotorClient
import os

# In a real production app, these would be environment variables
MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_DETAILS)
database = client.smart_health_db
user_collection = database.get_collection("users")
health_logs_collection = database.get_collection("health_logs")

async def create_user(user_data):
    await user_collection.insert_one(user_data)

async def get_user(user_id):
    return await user_collection.find_one({"_id": user_id})

async def save_health_log(log_data):
    await health_logs_collection.insert_one(log_data)

async def get_health_history(user_id):
    cursor = health_logs_collection.find({"user_id": user_id})
    return await cursor.to_list(length=100)
