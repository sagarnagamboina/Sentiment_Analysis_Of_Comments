import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.nlp_engine import auto_detect_columns

router = APIRouter()


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    columns = list(df.columns)
    detected = auto_detect_columns(columns)
    preview = df.head(5).fillna("").to_dict(orient="records")

    return {
        "columns": columns,
        "detected": detected,
        "preview": preview,
        "total_rows": len(df),
        "filename": file.filename,
    }
