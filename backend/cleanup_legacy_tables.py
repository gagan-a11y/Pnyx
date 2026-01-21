import psycopg2
import os

NEON_URL = os.getenv("DATABASE_URL", "postgresql://neondb_owner:npg_3JYK7ySezjrT@ep-morning-truth-ahrz730e-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require")

def cleanup_legacy_tables():
    print("🧹 Cleaning up legacy tables...")
    try:
        conn = psycopg2.connect(NEON_URL)
        cursor = conn.cursor()
        
        # Drop the old tables if they exist
        # We use CASCADE just in case, but they shouldn't have dependents yet
        tables_to_drop = ["transcripts", "transcript_chunks"]
        
        for table in tables_to_drop:
            print(f"   Dropping {table}...")
            cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
            
        conn.commit()
        print("✅ Legacy tables deleted successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup_legacy_tables()
