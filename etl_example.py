"""
etl_example.py — Example external ingestion script.

Run this from any external system (cron job, Airflow DAG, another service)
to push a dataset into the sentiment analysis DB without going through the UI.

The dataset will appear automatically in the React sidebar's Dataset Library
within 30 seconds (one poll cycle).
"""
import requests
import csv

BACKEND_URL = "http://localhost:8000"


def ingest_csv_file(filepath: str, name: str = None, source: str = "etl"):
    """Read a CSV file and push it to the ingest endpoint."""
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        columns = list(rows[0].keys()) if rows else []

    payload = {
        "name":    name or filepath.split("/")[-1],
        "source":  source,
        "columns": columns,
        "rows":    rows,
    }

    response = requests.post(f"{BACKEND_URL}/api/datasets/ingest", json=payload)
    response.raise_for_status()
    result = response.json()
    print(f"✅ Ingested dataset_id={result['dataset_id']} name='{result['name']}' rows={result['total_rows']}")
    return result["dataset_id"]


def ingest_from_dict(rows: list[dict], name: str, source: str = "api"):
    """Push data already in memory (e.g. from a database query or API response)."""
    columns = list(rows[0].keys()) if rows else []
    payload = {"name": name, "source": source, "columns": columns, "rows": rows}
    response = requests.post(f"{BACKEND_URL}/api/datasets/ingest", json=payload)
    response.raise_for_status()
    result = response.json()
    print(f"✅ Ingested dataset_id={result['dataset_id']} rows={result['total_rows']}")
    return result["dataset_id"]


if __name__ == "__main__":
    # Example 1: ingest a CSV file
    # dataset_id = ingest_csv_file("./new_feedback.csv", name="June 2024 Feedback", source="etl")

    # Example 2: ingest data from memory (e.g. from a DB query result)
    sample_rows = [
        {"Policy": "GST Reform Bill", "Section": "Tax Rates", "Comment": "The new rates are fair and transparent.", "Date": "2024-06-01"},
        {"Policy": "GST Reform Bill", "Section": "Tax Rates", "Comment": "Implementation timeline is too aggressive.", "Date": "2024-06-02"},
    ]
    dataset_id = ingest_from_dict(sample_rows, name="GST Feedback - ETL Sample", source="etl")
    print(f"Dataset {dataset_id} will appear in the React UI within 30 seconds.")
