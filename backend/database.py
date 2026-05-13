import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

def get_db():
    uri = os.getenv("MONGODB_URI")
    if not uri:
        # Fallback if .env is missing
        uri = "mongodb+srv://ddybkr_db_user:HcQuzQrxaJKEGFFB@clusteratlantis.vvyp34s.mongodb.net/?appName=ClusterAtlantis"
    
    client = MongoClient(uri)
    return client['atlantis_db']

if __name__ == "__main__":
    try:
        db = get_db()
        db.command('ping')
        print("Connected to ClusterAtlantis! ✅")
    except Exception as e:
        print(f"Connection failed: {e}")
