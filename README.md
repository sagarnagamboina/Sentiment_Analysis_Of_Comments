# Sentimental Analysis of E-Consultancy Comments


- **MySQL-backed dataset storage** — every uploaded CSV is saved to MySQL and is reusable
- **Dataset Library** in the sidebar — pick any past dataset, click Analyze, done
- **External data ingestion** — ETL scripts / external APIs push data via `/api/datasets/ingest`; new datasets appear in the UI automatically via 30-second polling
- **Zero NLP changes** — `nlp_engine.py` is byte-for-byte identical to v2
- **UI fixes** — dropdowns now show text correctly (solid background), chart labels visible, Groq API key column removed from SetupPage
- **Cached results** — analysis results stored in DB; re-fetch without re-running

---

## Folder structure

```
sentiment_v3/
├── backend/
│   ├── app/
│   │   ├── main.py                  ← Updated: adds /api/datasets, DB init on startup
│   │   ├── nlp_engine.py            ← UNCHANGED from v2
│   │   ├── db/
│   │   │   └── database.py          ← MySQL async engine (aiomysql + SQLAlchemy)
│   │   ├── models/
│   │   │   └── dataset.py           ← ORM: datasets + analysis_results tables
│   │   ├── services/
│   │   │   └── dataset_service.py   ← All DB operations (CRUD, DataFrame conversion)
│   │   └── routers/
│   │       ├── upload.py            ← UNCHANGED
│   │       ├── analysis.py          ← UNCHANGED
│   │       ├── wordcloud.py         ← UNCHANGED
│   │       └── datasets.py          ← NEW: full dataset lifecycle API
│   └── requirements.txt             ← Added: sqlalchemy, aiomysql, cryptography
└── frontend/
    └── src/
        ├── App.jsx                  ← Updated: DB flow, dataset library state, polling
        ├── api.js                   ← Updated: uploadAndStore(), listDatasets(), analyzeDataset()
        ├── components/
        │   └── Sidebar.jsx          ← Updated: Dataset Library panel, fixed dropdowns
        └── pages/
            └── SetupPage.jsx        ← Updated: removed API key column, fixed select styles
```

---

## Database schema

### `datasets` table
| Column | Type | Notes |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| name | VARCHAR(255) | Original filename or label |
| source | VARCHAR(64) | `upload` / `etl` / `external` / `api` |
| total_rows | INT | Row count at ingest time |
| columns_json | TEXT | JSON array of column names |
| raw_data | MEDIUMTEXT | JSON-serialised rows (DataFrame.to_json) |
| uploaded_at | DATETIME | UTC timestamp |
| processed | BOOLEAN | True after first analysis |
| hint_text_col | VARCHAR(128) | Auto-detected comment column |
| hint_policy_col | VARCHAR(128) | Auto-detected policy column |
| hint_section_col | VARCHAR(128) | Auto-detected section column |
| hint_date_col | VARCHAR(128) | Auto-detected date column |

### `analysis_results` table
| Column | Type | Notes |
|---|---|---|
| id | INT PK AUTO_INCREMENT | |
| dataset_id | INT FK | → datasets.id (CASCADE DELETE) |
| run_at | DATETIME | UTC timestamp |
| text_col | VARCHAR(128) | Column mapping used |
| policy_col | VARCHAR(128) | |
| section_col | VARCHAR(128) | |
| date_col | VARCHAR(128) | |
| avg_score | FLOAT | Overall sentiment score |
| total_records | INT | |
| result_json | MEDIUMTEXT | Full NLP output (same shape as /api/analysis/process) |

**Design choice — JSON rows vs. normalised rows table:**
Storing rows as JSON in a single MEDIUMTEXT column keeps the schema simple and avoids
millions of tiny MySQL rows for moderate datasets (< ~200k rows). The service layer reads
the JSON back into a pandas DataFrame in one call. For datasets > 500k rows, switch
`raw_data` to a file-reference column pointing to S3/local disk — only the `dataset_service.py`
`save_dataset` and `dataset_to_dataframe` functions need updating; everything else stays the same.

---

## API endpoints

### Existing (unchanged)
| Method | Path | Purpose |
|---|---|---|
| POST | /api/upload/csv | Parse CSV, return column hints |
| POST | /api/analysis/process | Run NLP on uploaded file |
| POST | /api/wordcloud/generate | Generate word cloud image |

### New (DB-backed)
| Method | Path | Purpose |
|---|---|---|
| POST | /api/datasets/upload | Upload CSV → save to MySQL → return dataset_id |
| GET | /api/datasets/ | List all datasets (newest first) |
| GET | /api/datasets/{id} | Get metadata + 5-row preview |
| POST | /api/datasets/{id}/analyze | Run NLP on stored dataset |
| GET | /api/datasets/{id}/result | Fetch cached analysis result |
| DELETE | /api/datasets/{id} | Delete dataset + all results |
| POST | /api/datasets/ingest | External ETL push endpoint |

### External ingest payload example
```json
POST /api/datasets/ingest
{
  "name":    "q2_feedback_etl",
  "source":  "etl",
  "columns": ["Policy", "Section", "Comment", "Date"],
  "rows": [
    {"Policy": "Data Protection Act", "Section": "Privacy", "Comment": "...", "Date": "2024-06-01"},
    ...
  ]
}
```
Response:
```json
{ "dataset_id": 7, "name": "q2_feedback_etl", "total_rows": 312, "message": "Dataset ingested successfully and ready for analysis." }
```

---

## Setup instructions

### 1. Create MySQL database
```sql
CREATE DATABASE sentiment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sentiment_user'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON sentiment_db.* TO 'sentiment_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Configure environment variables
```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=sentiment_db
export DB_USER=sentiment_user
export DB_PASSWORD=yourpassword
export GROQ_API_KEY=gsk_your_groq_key_here
```

Or create a `.env` file and load with `python-dotenv`.

### 3. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
python -m textblob.download_corpora   # first run only
```

### 4. Start backend (tables auto-created on startup)
```bash
uvicorn app.main:app --reload --port 8000
```
MySQL tables are created automatically on first start via `init_db()`.

### 5. Start frontend
```bash
cd frontend
npm install
npm run dev
```

---

## How loading strategies work

### DB → DataFrame (incremental-friendly)
```python
df = pd.read_json(io.StringIO(ds.raw_data), orient="records")
```
The NLP pipeline receives a standard DataFrame regardless of whether data came from
an uploaded file or the database. Zero changes to `nlp_engine.py`.

### Large dataset strategy
For datasets > 500k rows:
1. Change `raw_data` → `file_path VARCHAR(512)` in the model
2. Save the DataFrame as a Parquet file on disk/S3 in `save_dataset()`
3. Load with `pd.read_parquet(ds.file_path)` in `dataset_to_dataframe()`
4. Everything else stays identical

### Detecting newly ingested external data
The frontend polls `GET /api/datasets/` every 30 seconds. New rows (from ETL scripts
or direct SQL inserts) automatically appear in the Dataset Library. For real-time
updates, replace polling with a WebSocket endpoint (`/ws/datasets`) that broadcasts
on INSERT — no frontend logic change needed beyond swapping `setInterval` for a WebSocket listener.

### Incremental processing (process only new records)
Add a `last_processed_row_id INT` column to `datasets`. On each analysis run, query
only rows with id > last_processed_row_id, run the NLP pipeline on the delta, merge
counts with stored results, and update `last_processed_row_id`. This is an O(new rows)
operation regardless of total dataset size.

---

## Scalability path

| Concern | Current | Scale-up |
|---|---|---|
| Dataset storage | JSON in MEDIUMTEXT | Parquet on S3 + file_path column |
| Analysis caching | Latest result in DB | Redis with dataset_id:column_map key |
| Multiple users | Single DB | Add user_id FK to datasets, row-level auth |
| Large datasets | All rows in memory | Chunked pandas with `chunksize=10000` |
| Real-time updates | 30s polling | WebSocket broadcast on INSERT |
| Concurrency | Single Uvicorn worker | Gunicorn multi-worker + connection pool |

---

## UI fixes applied

1. **Dropdown text invisible** — `select` elements now use `background: #1e293b` (solid dark) instead of `rgba(255,255,255,0.06)` (transparent). All `<option>` elements explicitly set the same background so browser-native dropdowns render correctly on all OS themes.
2. **Chart label visibility** — `SENT_COLORS` tooltip and legend text explicitly set to `#e2e8f0`.
3. **API key column removed** — SetupPage now shows 4 columns (Policy, Section, Comment, Date). The Groq API key is handled entirely server-side via environment variable. A green info bar confirms this.
4. **Gen-AI Settings section removed from sidebar** — replaced by the Dataset Library panel.
