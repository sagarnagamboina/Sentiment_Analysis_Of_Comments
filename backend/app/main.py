"""
main.py — extended version.
Adds /api/datasets router and MySQL init on startup.
Existing routers (/api/upload, /api/analysis, /api/wordcloud) are UNCHANGED.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Existing routers (unchanged)
from app.routers import upload, analysis, wordcloud
# New DB-backed router
from app.routers.datasets import router as datasets_router
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all MySQL tables on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Sentimental Analysis of E-Consultancy API",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Existing routes (untouched) ───────────────────────────────────────────────
app.include_router(upload.router,    prefix="/api/upload",    tags=["Upload"])
app.include_router(analysis.router,  prefix="/api/analysis",  tags=["Analysis"])
app.include_router(wordcloud.router, prefix="/api/wordcloud", tags=["WordCloud"])

# ── New DB-backed dataset routes ──────────────────────────────────────────────
app.include_router(datasets_router, prefix="/api/datasets", tags=["Datasets"])


@app.get("/")
def root():
    return {"status": "Sentimental Analysis of E-Consultancy API v3.0 running (MySQL enabled)"}
