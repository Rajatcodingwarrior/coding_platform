import dns.resolver
import motor.motor_asyncio
import certifi
from app.config import settings

import os

# ─── Force Google DNS (8.8.8.8) only in local development to bypass ISP/corporate DNS ───
if os.environ.get("VERCEL") != "1":
    try:
        _google_resolver = dns.resolver.Resolver(configure=False)
        _google_resolver.nameservers = ['8.8.8.8', '8.8.4.4']
        dns.resolver.default_resolver = _google_resolver
    except Exception as e:
        print(f"Failed to configure custom DNS resolver: {e}")


class Database:
    client: motor.motor_asyncio.AsyncIOMotorClient = None
    db: motor.motor_asyncio.AsyncIOMotorDatabase = None

db_instance = Database()

def get_database() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    return db_instance.db

async def connect_to_mongo():
    db_instance.client = motor.motor_asyncio.AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where()
    )
    db_instance.db = db_instance.client[settings.DB_NAME]
    print(f"Connected to MongoDB: {settings.DB_NAME}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")
