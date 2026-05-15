import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export const api = {
  // ── Original endpoints (unchanged) ─────────────────────────────────────────
  async uploadCSV(file) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(`${BASE}/upload/csv`, form)
    return data
  },

  async processData(file, columns, groqKey = '') {
    const form = new FormData()
    form.append('file', file)
    form.append('text_col', columns.text_col)
    if (columns.policy_col)  form.append('policy_col',  columns.policy_col)
    if (columns.section_col) form.append('section_col', columns.section_col)
    if (columns.date_col)    form.append('date_col',    columns.date_col)
    // groq_api_key intentionally omitted — handled server-side
    const { data } = await axios.post(`${BASE}/analysis/process`, form)
    return data
  },

  async generateWordCloud(texts, sentimentFilter = 'All') {
    const { data } = await axios.post(`${BASE}/wordcloud/generate`, {
      texts,
      sentiment_filter: sentimentFilter,
    })
    return data
  },

  // ── New DB-backed dataset endpoints ─────────────────────────────────────────

  /** Upload CSV → save to MySQL → returns {dataset_id, columns, detected, preview, ...} */
  async uploadAndStore(file) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(`${BASE}/datasets/upload`, form)
    return data
  },

  /** List all datasets from DB (uploaded + external ETL) */
  async listDatasets() {
    const { data } = await axios.get(`${BASE}/datasets/`)
    return data
  },

  /** Fetch single dataset metadata + 5-row preview */
  async getDataset(datasetId) {
    const { data } = await axios.get(`${BASE}/datasets/${datasetId}`)
    return data
  },

  /** Run NLP analysis on a stored dataset by ID */
  async analyzeDataset(datasetId, columns, groqKey = '') {
    const form = new FormData()
    form.append('text_col', columns.text_col)
    if (columns.policy_col)  form.append('policy_col',  columns.policy_col)
    if (columns.section_col) form.append('section_col', columns.section_col)
    if (columns.date_col)    form.append('date_col',    columns.date_col)
    const { data } = await axios.post(`${BASE}/datasets/${datasetId}/analyze`, form)
    return data
  },

  /** Delete a stored dataset */
  async deleteDataset(datasetId) {
    const { data } = await axios.delete(`${BASE}/datasets/${datasetId}`)
    return data
  },
}
