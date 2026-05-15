"""
models/dataset.py  — ORM model for uploaded / externally-ingested datasets.

Schema design rationale
-----------------------
datasets          — metadata + raw CSV rows stored as JSON
analysis_results  — cached result of NLP pipeline keyed by dataset_id

Storing rows as JSON (TEXT column) rather than a separate "rows" table keeps
the schema simple and avoids millions of tiny MySQL rows for moderate datasets.
For very large datasets (>500k rows) swap raw_data for a file-reference column
and store the file on S3 / local disk — the service layer stays the same.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    name         = Column(String(255), nullable=False)          # original filename / label
    source       = Column(String(64),  default="upload")        # upload | api | etl | external
    total_rows   = Column(Integer,     default=0)
    columns_json = Column(Text,        nullable=True)           # JSON list of column names
    raw_data     = Column(Text(16_000_000), nullable=False)     # JSON-serialised rows (MEDIUMTEXT)
    uploaded_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed    = Column(Boolean,  default=False)              # has been analysed at least once

    # detected column hints (saved so UI can pre-fill SetupPage)
    hint_text_col    = Column(String(128), nullable=True)
    hint_policy_col  = Column(String(128), nullable=True)
    hint_section_col = Column(String(128), nullable=True)
    hint_date_col    = Column(String(128), nullable=True)

    results = relationship("AnalysisResult", back_populates="dataset", cascade="all, delete-orphan")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    run_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # column mapping used for this run
    text_col    = Column(String(128), nullable=False)
    policy_col  = Column(String(128), nullable=True)
    section_col = Column(String(128), nullable=True)
    date_col    = Column(String(128), nullable=True)

    avg_score      = Column(Float,  nullable=True)
    total_records  = Column(Integer, nullable=True)

    # full NLP output stored as JSON (matches existing /api/analysis/process response shape)
    result_json = Column(Text(16_000_000), nullable=True)   # MEDIUMTEXT

    dataset = relationship("Dataset", back_populates="results")
