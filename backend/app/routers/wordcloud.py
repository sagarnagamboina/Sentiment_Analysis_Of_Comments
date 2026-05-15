import io
import base64
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.nlp_engine import STOPWORDS

router = APIRouter()


class WordCloudRequest(BaseModel):
    texts: list[str]
    sentiment_filter: str = "All"   # All | Positive | Negative | Neutral
    colormap: str = "plasma"        # plasma | cool | viridis | RdYlGn


@router.post("/generate")
async def generate_wordcloud(req: WordCloudRequest):
    try:
        from wordcloud import WordCloud
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Missing library: {e}")

    texts = [str(t) for t in req.texts if len(str(t).strip()) > 3]
    if not texts:
        raise HTTPException(status_code=400, detail="No text provided.")

    combined = " ".join(texts)
    if len(combined.strip()) < 10:
        raise HTTPException(status_code=400, detail="Not enough text.")

    # colour per sentiment
    cmap_map = {
        "All":      "plasma",
        "Positive": "summer",
        "Negative": "Reds",
        "Neutral":  "Blues",
    }
    colormap = cmap_map.get(req.sentiment_filter, "plasma")

    wc = WordCloud(
        width=1400, height=600,
        background_color=None, mode="RGBA",
        colormap=colormap,
        stopwords=STOPWORDS,
        max_words=150,
        prefer_horizontal=0.85,
        collocations=False,
        font_path=None,
    ).generate(combined)

    fig, ax = plt.subplots(figsize=(14, 6))
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)
    ax.imshow(wc, interpolation="bilinear")
    ax.axis("off")
    plt.tight_layout(pad=0)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True, dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)

    img_b64 = base64.b64encode(buf.read()).decode("utf-8")
    return {"image": f"data:image/png;base64,{img_b64}"}
