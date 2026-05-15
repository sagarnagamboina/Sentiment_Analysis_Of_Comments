"""
services/dataset_service.py
Clean service layer — all DB operations live here.
Routers call service functions; service functions talk to the DB.
"""
import io
import json
import pandas as pd
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dataset import Dataset, AnalysisResult


# ── Dataset CRUD ──────────────────────────────────────────────────────────────

async def save_dataset(
    db: AsyncSession,
    name: str,
    df: pd.DataFrame,
    source: str = "upload",
    detected: Optional[dict] = None,
) -> Dataset:
    """Persist a DataFrame as a new Dataset row and return it."""
    detected = detected or {}
    ds = Dataset(
        name         = name,
        source       = source,
        total_rows   = len(df),
        columns_json = json.dumps(list(df.columns)),
        raw_data     = df.to_json(orient="records"),
        uploaded_at  = datetime.now(timezone.utc),
        processed    = False,
        hint_text_col    = detected.get("text_col"),
        hint_policy_col  = detected.get("policy_col"),
        hint_section_col = detected.get("section_col"),
        hint_date_col    = detected.get("date_col"),
    )
    db.add(ds)
    await db.flush()   # get ds.id before commit
    return ds


async def list_datasets(db: AsyncSession) -> list[Dataset]:
    """Return all datasets ordered newest-first."""
    stmt = select(Dataset).order_by(desc(Dataset.uploaded_at))
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_dataset(db: AsyncSession, dataset_id: int) -> Optional[Dataset]:
    """Fetch a single Dataset by PK."""
    return await db.get(Dataset, dataset_id)


async def dataset_to_dataframe(ds: Dataset) -> pd.DataFrame:
    """Deserialise the stored JSON rows back into a pandas DataFrame."""
    return pd.read_json(io.StringIO(ds.raw_data), orient="records")


async def delete_dataset(db: AsyncSession, dataset_id: int) -> bool:
    ds = await db.get(Dataset, dataset_id)
    if not ds:
        return False
    await db.delete(ds)
    return True


# ── Analysis Result CRUD ──────────────────────────────────────────────────────

async def save_analysis_result(
    db: AsyncSession,
    dataset_id: int,
    column_map: dict,
    result: dict,
) -> AnalysisResult:
    ar = AnalysisResult(
        dataset_id  = dataset_id,
        run_at      = datetime.now(timezone.utc),
        text_col    = column_map.get("text_col", ""),
        policy_col  = column_map.get("policy_col"),
        section_col = column_map.get("section_col"),
        date_col    = column_map.get("date_col"),
        avg_score   = result.get("avg_score"),
        total_records = result.get("total"),
        result_json = json.dumps(result, default=str),
    )
    db.add(ar)

    # mark parent dataset as processed
    ds = await db.get(Dataset, dataset_id)
    if ds:
        ds.processed = True

    await db.flush()
    return ar


async def get_latest_result(
    db: AsyncSession, dataset_id: int
) -> Optional[AnalysisResult]:
    stmt = (
        select(AnalysisResult)
        .where(AnalysisResult.dataset_id == dataset_id)
        .order_by(desc(AnalysisResult.run_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
