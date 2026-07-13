import asyncio
import sys
import os

# Load .env manually
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "Desktop", "WebD Projects", "coding_portal", "backend", ".env"))
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k] = v

# Adjust path to find backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "Desktop", "WebD Projects", "coding_portal", "backend")))

# Set custom DNS resolver to bypass ISP blockages
import dns.resolver
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']

from app.database import connect_to_mongo, close_mongo_connection
from app.services.upcoming_contests import sync_upcoming_contests
from app.services.codechef import sync_codechef_data

async def run():
    print("Connecting to Mongo...")
    await connect_to_mongo()
    
    print("Executing upcoming contests sync...")
    await sync_upcoming_contests()
    
    print("Executing CodeChef scraper sync to format Markdown statements...")
    await sync_codechef_data()
    
    await close_mongo_connection()
    print("Finished.")

if __name__ == "__main__":
    asyncio.run(run())
