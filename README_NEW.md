# Sentiment Extended

A modern full-stack sentiment analysis solution for e-consultancy feedback and customer comment datasets.

This repository combines a FastAPI backend, a React + Vite frontend, and an NLP pipeline to upload, store, analyze, and visualize sentiment from CSV feedback data.

## What this project does

- Accepts CSV file uploads through the frontend
- Saves uploaded datasets in MySQL for reuse
- Detects text, policy, section, and date columns automatically
- Runs sentiment analysis on stored datasets
- Caches analysis results in the database
- Displays KPI dashboards and word clouds for feedback insights
- Supports external ingestion via API for ETL or automated data pipelines

## Key features

- MySQL-backed dataset storage
- Reusable dataset library in the sidebar
- Dataset preview and metadata
- Cached analysis results for faster repeated views
- Word cloud generation from processed feedback text
- External ingest endpoint for ETL pipelines

## Project structure

```
backend/
  requirements.txt
  app/
    main.py
    nlp_engine.py
    db/
      database.py
    models/
      dataset.py
    services/
      dataset_service.py
    routers/
      analysis.py
      datasets.py
      upload.py
      wordcloud.py
frontend/
  package.json
  vite.config.js
  src/
    api.js
    App.jsx
    main.jsx
    index.css
    components/
      FeedbackStrip.jsx
      FloatingBot.jsx
      KpiCard.jsx
      Sidebar.jsx
    pages/
      Dashboard.jsx
      SetupPage.jsx
      WelcomeScreen.jsx
etl_example.py
sample_feedback.csv
```

## Technology stack

- Python 3.x
- FastAPI
- SQLAlchemy
- aiomysql
- MySQL
- TextBlob
- React 18
- Vite
- Axios
- Recharts
- WordCloud
- Lucide React

## Backend setup

1. Create the MySQL database

```sql
CREATE DATABASE sentiment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sentiment_user'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON sentiment_db.* TO 'sentiment_user'@'localhost';
FLUSH PRIVILEGES;
```

2. Configure environment variables

Set the following variables in your environment or in a `.env` file:

```bash
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sentiment_db
DB_USER=sentiment_user
DB_PASSWORD=yourpassword
GROQ_API_KEY=your_groq_api_key
```

3. Install backend dependencies

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m textblob.download_corpora
```

4. Start the backend server

```bash
uvicorn app.main:app --reload --port 8000
```

## Frontend setup

1. Install dependencies

```bash
cd frontend
npm install
```

2. Run the frontend

```bash
npm run dev
```

3. Open the application

Visit the local URL shown by Vite, typically `http://localhost:5173`.

## Usage

1. Upload a CSV file from the UI.
2. Select a dataset from the dataset library in the sidebar.
3. Configure the analysis columns if needed.
4. Run sentiment analysis and review dashboard metrics.
5. Generate a word cloud for visual insight into common feedback terms.

## API summary

- `POST /api/upload/csv` — upload a CSV file and infer column hints
- `POST /api/analysis/process` — process uploaded data with the NLP pipeline
- `POST /api/wordcloud/generate` — create a word cloud image
- `POST /api/datasets/upload` — upload and save a dataset to MySQL
- `GET /api/datasets/` — list saved datasets
- `GET /api/datasets/{id}` — get dataset details and preview
- `POST /api/datasets/{id}/analyze` — analyze a stored dataset
- `GET /api/datasets/{id}/result` — fetch cached analysis results
- `DELETE /api/datasets/{id}` — remove dataset and associated results
- `POST /api/datasets/ingest` — ingest external dataset payloads

## Notes

- The backend uses a JSON-based raw dataset storage format to simplify dataset persistence.
- Results are cached to minimize repeated NLP work and improve response speed.
- The frontend is designed for dataset-centric workflows and quick insights.

## Recommended improvements

- Add authentication and role-based access control
- Add pagination for large dataset listings
- Introduce WebSocket support for real-time dataset updates
- Add file-based storage for very large datasets

## License

Add a license file if you plan to share or publish this repository.
