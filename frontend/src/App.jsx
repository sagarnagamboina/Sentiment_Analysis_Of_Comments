import { useState, useMemo, useEffect, useCallback } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import FloatingBot from './components/FloatingBot'
import WelcomeScreen from './pages/WelcomeScreen'
import SetupPage from './pages/SetupPage'
import Dashboard from './pages/Dashboard'

// inject keyframes
const style = document.createElement('style')
style.textContent = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes bounceBot { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.25) translateY(-20px)} }
`
document.head.appendChild(style)

export default function App() {
  const [step, setStep] = useState('welcome')   // welcome | setup | dashboard
  const [file, setFile] = useState(null)
  const [fileSize, setFileSize] = useState(null)
  const [uploadData, setUploadData] = useState(null)   // includes dataset_id when using DB flow
  const [result, setResult] = useState(null)
  const [columnMap, setColumnMap] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Dataset Library state
  const [datasets, setDatasets] = useState([])
  const [datasetsLoading, setDatasetsLoading] = useState(false)
  const [activeDatasetId, setActiveDatasetId] = useState(null)

  // Scope filters
  const [selectedPolicy, setSelectedPolicy] = useState('All Policies')
  const [selectedSection, setSelectedSection] = useState('All Sections')
  const [sentFilter, setSentFilter] = useState('All')

  // ── Load dataset list from DB ──────────────────────────────────────────────
  const refreshDatasets = useCallback(async () => {
    setDatasetsLoading(true)
    try {
      const list = await api.listDatasets()
      setDatasets(list)
    } catch {
      // Backend may not be running — silently ignore so old file-only flow still works
    } finally {
      setDatasetsLoading(false)
    }
  }, [])

  useEffect(() => { refreshDatasets() }, [refreshDatasets])

  // Poll for newly-inserted external datasets every 30 s
  useEffect(() => {
    const id = setInterval(refreshDatasets, 30_000)
    return () => clearInterval(id)
  }, [refreshDatasets])

  // ── File upload (new DB-backed flow) ──────────────────────────────────────
  const handleFile = async (f) => {
    if (!f) { setFile(null); setStep('welcome'); setResult(null); return }
    setFile(f)
    setFileSize(f.size)
    setError(null)
    setLoading(true)
    setActiveDatasetId(null)
    try {
      // Try new DB-backed upload first; fall back to legacy if unavailable
      let data
      try {
        data = await api.uploadAndStore(f)
      } catch {
        data = await api.uploadCSV(f)
      }
      setUploadData(data)
      setStep('setup')
      refreshDatasets()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Upload failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  // ── Select a stored dataset from the library ───────────────────────────────
  const handleSelectDataset = async (ds) => {
    setError(null)
    setLoading(true)
    setActiveDatasetId(ds.id)
    setFile(null)
    try {
      const meta = await api.getDataset(ds.id)
      setUploadData({
        dataset_id: ds.id,
        name: ds.name,
        filename: ds.name,
        columns: meta.columns,
        detected: meta.hints,
        preview: meta.preview,
        total_rows: ds.total_rows,
      })
      setStep('setup')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not load dataset.')
    } finally {
      setLoading(false)
    }
  }

  // ── Delete a stored dataset ────────────────────────────────────────────────
  const handleDeleteDataset = async (id) => {
    if (!confirm('Delete this dataset and all its analysis results?')) return
    try {
      await api.deleteDataset(id)
      refreshDatasets()
      if (activeDatasetId === id) { setStep('welcome'); setResult(null); setActiveDatasetId(null) }
    } catch (e) {
      setError('Delete failed.')
    }
  }

  // ── Run analysis ──────────────────────────────────────────────────────────
  const handleConfirm = async (map) => {
    setError(null)
    setLoading(true)
    try {
      let data
      if (uploadData?.dataset_id) {
        // DB-backed: send only column map; no file re-upload
        data = await api.analyzeDataset(uploadData.dataset_id, map)
      } else {
        // Legacy: pass actual file
        data = await api.processData(file, map, '')
      }
      setColumnMap(map)
      setResult(data)
      setSelectedPolicy('All Policies')
      setSelectedSection('All Sections')
      setSentFilter('All')
      setStep('dashboard')
      refreshDatasets()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Processing failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep('setup')
    setResult(null)
    setSelectedPolicy('All Policies')
    setSelectedSection('All Sections')
    setSentFilter('All')
  }

  // ── Derived filters ────────────────────────────────────────────────────────
  const policies = useMemo(() => {
    if (!result || !result.columns.policy_col) return []
    return [...new Set(result.records.map(r => r[result.columns.policy_col]).filter(Boolean))].sort()
  }, [result])

  const sections = useMemo(() => {
    if (!result || !result.columns.section_col) return []
    let recs = result.records
    if (selectedPolicy !== 'All Policies')
      recs = recs.filter(r => r[result.columns.policy_col] === selectedPolicy)
    return [...new Set(recs.map(r => r[result.columns.section_col]).filter(Boolean))].sort()
  }, [result, selectedPolicy])

  const filteredRecords = useMemo(() => {
    if (!result) return []
    return result.records.filter(r => {
      if (selectedPolicy !== 'All Policies' && r[result.columns.policy_col] !== selectedPolicy) return false
      if (selectedSection !== 'All Sections' && r[result.columns.section_col] !== selectedSection) return false
      if (sentFilter !== 'All' && r.Sentiment !== sentFilter) return false
      return true
    })
  }, [result, selectedPolicy, selectedSection, sentFilter])

  const handlePolicyChange = (v) => {
    setSelectedPolicy(v)
    setSelectedSection('All Sections')
  }

  return (
    <div style={s.shell}>
      <Sidebar
        onFile={handleFile}
        filename={file?.name || (activeDatasetId ? uploadData?.name : null)}
        fileSize={file?.size}
        policies={policies}
        sections={sections}
        selectedPolicy={selectedPolicy}
        selectedSection={selectedSection}
        onPolicyChange={handlePolicyChange}
        onSectionChange={setSelectedSection}
        sentimentFilter={sentFilter}
        onSentimentFilter={setSentFilter}
        onReset={handleReset}
        hasResult={!!result}
        datasets={datasets}
        datasetsLoading={datasetsLoading}
        onSelectDataset={handleSelectDataset}
        onDeleteDataset={handleDeleteDataset}
        activeDatasetId={activeDatasetId}
      />

      <div style={s.content}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.headerInner}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
              stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 10px #8b5cf6)' }}>
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
            </svg>
            <div>
              <h1 style={s.headerTitle}>Sentimental Analysis of E-Consultancy</h1>
              <p style={s.headerSub}>Neural Analysis &amp; Insights Engine </p>
            </div>
          </div>
        </header>

        {error && (
          <div style={s.errBanner}>
            ⚠️ {error}
            <button style={s.errClose} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {step === 'welcome' && <WelcomeScreen />}
        {step === 'setup' && uploadData && (
          <SetupPage uploadData={uploadData} onConfirm={handleConfirm} loading={loading} />
        )}
        {step === 'dashboard' && result && (
          <Dashboard
            result={result}
            filteredRecords={filteredRecords}
            selectedPolicy={selectedPolicy}
            selectedSection={selectedSection}
          />
        )}
      </div>

      <FloatingBot />
    </div>
  )
}

const s = {
  shell: { display: 'flex', minHeight: '100vh' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header: {
    padding: '20px 28px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(10,15,30,0.6)',
    backdropFilter: 'blur(12px)',
    position: 'sticky', top: 0, zIndex: 50,
  },
  headerInner: { display: 'flex', alignItems: 'center', gap: 16 },
  headerTitle: {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 'clamp(1.1rem,2vw,1.45rem)', fontWeight: 800,
    background: 'linear-gradient(135deg, #e2e8f0, #8b5cf6)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    marginBottom: 2, lineHeight: 1.2,
  },
  headerSub: { color: '#475569', fontSize: '0.8rem' },
  errBanner: {
    background: 'rgba(127,29,29,0.9)', color: '#fecaca',
    padding: '10px 20px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', fontSize: '0.85rem',
    borderBottom: '1px solid rgba(239,68,68,0.3)',
  },
  errClose: { background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '1rem' },
}
