import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from app.nlp_engine import (
    get_sentiment_score, label_sentiment, generate_short_summary,
    extract_keywords, cluster_themes, generate_insights, STOPWORDS
)

router = APIRouter()


@router.post("/process")
async def process_data(
    file: UploadFile = File(...),
    text_col: str = Form(...),
    policy_col: Optional[str] = Form(None),
    section_col: Optional[str] = Form(None),
    date_col: Optional[str] = Form(None),
    groq_api_key: Optional[str] = Form(None),
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {e}")

    # clean (same as original clean_and_process_data)
    df = df.dropna(subset=[text_col])
    if policy_col and policy_col in df.columns:
        df[policy_col] = df[policy_col].fillna("Unknown Policy")
    if section_col and section_col in df.columns:
        df[section_col] = df[section_col].fillna("Unknown Section")

    # score
    df["Score"]         = df[text_col].apply(get_sentiment_score)
    df["Sentiment"]     = df["Score"].apply(label_sentiment)
    df["Short_Summary"] = df[text_col].apply(generate_short_summary)

    records = df.fillna("").to_dict(orient="records")

    # overall sentiment counts
    counts = df["Sentiment"].value_counts().to_dict()
    total  = len(df)

    # policy-level breakdown
    policy_breakdown = []
    if policy_col and policy_col in df.columns:
        for policy, grp in df.groupby(policy_col):
            g = grp["Sentiment"].value_counts().to_dict()
            policy_breakdown.append({
                "policy":    str(policy),
                "total":     len(grp),
                "positive":  g.get("Positive", 0),
                "negative":  g.get("Negative", 0),
                "neutral":   g.get("Neutral",  0),
                "avg_score": round(grp["Score"].mean(), 3),
            })

    # keywords
    kw_raw = extract_keywords(df[text_col].tolist(), top_n=12)
    keywords = [{"keyword": k, "count": c} for k, c in kw_raw]

    # themes
    themes_raw  = cluster_themes(df[text_col].tolist())
    themes_count = {k: len(v) for k, v in themes_raw.items()}
    themes_preview = {k: v[:3] for k, v in themes_raw.items()}

    # date trend
    trend = []
    if date_col and date_col in df.columns:
        try:
            tdf = df.copy()
            tdf["_date"] = pd.to_datetime(tdf[date_col]).dt.date
            t = tdf.groupby(["_date", "Sentiment"]).size().reset_index(name="count")
            trend = [{"date": str(r["_date"]), "Sentiment": r["Sentiment"], "count": int(r["count"])}
                     for _, r in t.iterrows()]
        except Exception:
            pass

    # insights (with groq summary)
    ins = generate_insights(records, text_col, groq_api_key or None)

    return {
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
    }
