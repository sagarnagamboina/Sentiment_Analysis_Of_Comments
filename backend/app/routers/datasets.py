"""
routers/datasets.py
New router that adds DB-backed dataset management while keeping the
existing /api/upload and /api/analysis routers completely unchanged.
"""
import io
import json
import pandas as pd
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.dataset import Dataset
from app.services.dataset_service import (
    save_dataset, list_datasets, get_dataset,
    dataset_to_dataframe, delete_dataset,
    save_analysis_result, get_latest_result,
)
from app.nlp_engine import (
    auto_detect_columns,
    get_sentiment_score, label_sentiment, generate_short_summary,
    extract_keywords, cluster_themes, generate_insights,
)

router = APIRouter()


# ─── 1. Upload CSV → parse, store in DB, return metadata ─────────────────────
@router.post("/upload")
async def upload_and_store(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a CSV file.  
    • Parses it into a DataFrame  
    • Auto-detects column hints  
    • Stores raw data + metadata in MySQL  
    • Returns dataset_id and column hints so the frontend can proceed to SetupPage
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported.")
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(400, f"Failed to parse CSV: {e}")

    columns = list(df.columns)
    detected = auto_detect_columns(columns)
    preview  = df.head(5).fillna("").to_dict(orient="records")

    ds = await save_dataset(
        db, name=file.filename, df=df, source="upload", detected=detected
    )

    return {
        "dataset_id": ds.id,
        "name":       ds.name,
        "columns":    columns,
        "detected":   detected,
        "preview":    preview,
        "total_rows": len(df),
        "uploaded_at": ds.uploaded_at.isoformat(),
    }


# ─── 2. List all datasets (uploaded + external ETL) ──────────────────────────
@router.get("/")
async def list_all_datasets(db: AsyncSession = Depends(get_db)):
    """
    Returns metadata list for all datasets — whether uploaded via UI
    or inserted externally by ETL / API scripts.
    Sorted newest-first.
    """
    datasets = await list_datasets(db)
    return [
        {
            "id":          ds.id,
            "name":        ds.name,
            "source":      ds.source,
            "total_rows":  ds.total_rows,
            "processed":   ds.processed,
            "uploaded_at": ds.uploaded_at.isoformat(),
            "columns":     json.loads(ds.columns_json) if ds.columns_json else [],
            "hints": {
                "text_col":    ds.hint_text_col,
                "policy_col":  ds.hint_policy_col,
                "section_col": ds.hint_section_col,
                "date_col":    ds.hint_date_col,
            },
        }
        for ds in datasets
    ]


# ─── 3. Fetch single dataset metadata + preview ───────────────────────────────
@router.get("/{dataset_id}")
async def get_dataset_meta(dataset_id: int, db: AsyncSession = Depends(get_db)):
    ds = await get_dataset(db, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found.")
    df = await dataset_to_dataframe(ds)
    columns = list(df.columns)
    return {
        "id":          ds.id,
        "name":        ds.name,
        "source":      ds.source,
        "total_rows":  ds.total_rows,
        "processed":   ds.processed,
        "uploaded_at": ds.uploaded_at.isoformat(),
        "columns":     columns,
        "preview":     df.head(5).fillna("").to_dict(orient="records"),
        "hints": {
            "text_col":    ds.hint_text_col,
            "policy_col":  ds.hint_policy_col,
            "section_col": ds.hint_section_col,
            "date_col":    ds.hint_date_col,
        },
    }


# ─── 4. Run analysis on a stored dataset ─────────────────────────────────────
@router.post("/{dataset_id}/analyze")
async def analyze_dataset(
    dataset_id: int,
    text_col:    str           = Form(...),
    policy_col:  Optional[str] = Form(None),
    section_col: Optional[str] = Form(None),
    date_col:    Optional[str] = Form(None),
    groq_api_key: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch dataset from DB → convert to DataFrame → run the SAME NLP pipeline
    as /api/analysis/process → store results → return identical response shape.
    The NLP pipeline (nlp_engine.py) is NOT modified.
    """
    ds = await get_dataset(db, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found.")

    # ── Load from DB into DataFrame (same as reading from CSV file) ───────────
    df = await dataset_to_dataframe(ds)

    # ── Identical cleaning + scoring logic from routers/analysis.py ──────────
    df = df.dropna(subset=[text_col])
    if policy_col and policy_col in df.columns:
        df[policy_col] = df[policy_col].fillna("Unknown Policy")
    if section_col and section_col in df.columns:
        df[section_col] = df[section_col].fillna("Unknown Section")

    df["Score"]         = df[text_col].apply(get_sentiment_score)
    df["Sentiment"]     = df["Score"].apply(label_sentiment)
    df["Short_Summary"] = df[text_col].apply(generate_short_summary)

    records = df.fillna("").to_dict(orient="records")
    counts  = df["Sentiment"].value_counts().to_dict()
    total   = len(df)

    policy_breakdown = []
    if policy_col and policy_col in df.columns:
        for policy, grp in df.groupby(policy_col):
            g = grp["Sentiment"].value_counts().to_dict()
            policy_breakdown.append({
                "policy":    str(policy),
                "total":     len(grp),
                "positive":  g.get("Positive", 0),
                "negative":  g.get("Negative", 0),
                "neutral":   g.get("Neutral", 0),
                "avg_score": round(grp["Score"].mean(), 3),
            })

    kw_raw   = extract_keywords(df[text_col].tolist(), top_n=12)
    keywords = [{"keyword": k, "count": c} for k, c in kw_raw]

    themes_raw    = cluster_themes(df[text_col].tolist())
    themes_count  = {k: len(v) for k, v in themes_raw.items()}
    themes_preview = {k: v[:3] for k, v in themes_raw.items()}

    trend = []
    if date_col and date_col in df.columns:
        try:
            tdf = df.copy()
            tdf["_date"] = pd.to_datetime(tdf[date_col]).dt.date
            t = tdf.groupby(["_date", "Sentiment"]).size().reset_index(name="count")
            trend = [
                {"date": str(r["_date"]), "Sentiment": r["Sentiment"], "count": int(r["count"])}
                for _, r in t.iterrows()
            ]
        except Exception:
            pass

    ins = generate_insights(records, text_col, groq_api_key or None)

    result = {
        "records":          records,
        "total":            total,
        "sentiment_counts": counts,
        "avg_score":        round(df["Score"].mean(), 3),
        "keywords":         keywords,
        "policy_breakdown": policy_breakdown,
        "themes_count":     themes_count,
        "themes_preview":   themes_preview,
        "trend":            trend,
        "insights":         ins,
        "columns": {
            "text_col":    text_col,
            "policy_col":  policy_col,
            "section_col": section_col,
            "date_col":    date_col,
        },
        # extra field so UI knows this came from DB
        "dataset_id": dataset_id,
    }

    # ── Persist result ────────────────────────────────────────────────────────
    column_map = {
        "text_col": text_col, "policy_col": policy_col,
        "section_col": section_col, "date_col": date_col,
    }
    await save_analysis_result(db, dataset_id, column_map, result)

    return result


# ─── 5. Get cached analysis result ───────────────────────────────────────────
@router.get("/{dataset_id}/result")
async def get_cached_result(dataset_id: int, db: AsyncSession = Depends(get_db)):
    """Returns the most recent analysis result for a dataset without re-running."""
    ar = await get_latest_result(db, dataset_id)
    if not ar or not ar.result_json:
        raise HTTPException(404, "No analysis result found. Run /analyze first.")
    return json.loads(ar.result_json)


# ─── 6. Delete a dataset ──────────────────────────────────────────────────────
@router.delete("/{dataset_id}")
async def delete_dataset_endpoint(dataset_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await delete_dataset(db, dataset_id)
    if not deleted:
        raise HTTPException(404, "Dataset not found.")
    return {"deleted": True, "dataset_id": dataset_id}


# ─── 7. External ETL ingestion endpoint ──────────────────────────────────────
@router.post("/ingest")
async def ingest_external(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    External scripts, APIs, or ETL pipelines call this endpoint to push data.
    
    Expected payload:
    {
      "name":    "my_dataset",
      "source":  "etl",            // optional, default "external"
      "columns": ["Policy","Section","Comment","Date"],
      "rows":    [{"Policy": ..., "Comment": ...}, ...]
    }
    """
    try:
        name    = payload.get("name", "external_dataset")
        source  = payload.get("source", "external")
        columns = payload.get("columns", [])
        rows    = payload.get("rows", [])
        df      = pd.DataFrame(rows, columns=columns if columns else None)
    except Exception as e:
        raise HTTPException(400, f"Invalid payload: {e}")

    detected = auto_detect_columns(list(df.columns))
    ds = await save_dataset(db, name=name, df=df, source=source, detected=detected)
    return {
        "dataset_id": ds.id,
        "name":       ds.name,
        "total_rows": ds.total_rows,
        "message":    "Dataset ingested successfully and ready for analysis.",
    }
