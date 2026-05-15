import { useRef, useState } from 'react'
import { Upload, Target, Database, RefreshCw, ChevronDown, Trash2 } from 'lucide-react'

export default function Sidebar({
  onFile, filename, fileSize,
  policies, sections,
  selectedPolicy, selectedSection, onPolicyChange, onSectionChange,
  sentimentFilter, onSentimentFilter,
  onReset, hasResult,
  // Dataset library props
  datasets, datasetsLoading, onSelectDataset, onDeleteDataset, activeDatasetId,
}) {
  const inputRef = useRef()
  const [libOpen, setLibOpen] = useState(true)

  const fmtSize = (b) => b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`
  const fmtDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  }
  const sourceColor = { upload: '#3b82f6', etl: '#f59e0b', external: '#10b981', api: '#a78bfa' }

  return (
    <aside style={s.sidebar}>
      {/* ── Data Import ─────────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.secHead}>
          <Upload size={15} color="#3b82f6" />
          <span style={s.secTitle}>Data Import</span>
        </div>

        <div
          style={s.dropZone}
          onClick={() => inputRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f?.name.endsWith('.csv')) onFile(f)
          }}
        >
          <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => onFile(e.target.files[0])} />
          <div style={s.dropText}>Drag and drop file here</div>
          <div style={s.dropHint}>Limit 200MB per file • CSV</div>
          <button style={s.browseBtn} onClick={e => { e.stopPropagation(); inputRef.current.click() }}>
            Browse files
          </button>
        </div>

        {filename && (
          <div style={s.fileChip}>
            <span style={{ fontSize: '1.1rem' }}>📄</span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={s.fileName}>{filename}</div>
              {fileSize && <div style={s.fileSize}>{fmtSize(fileSize)}</div>}
            </div>
            <button style={s.clearBtn} onClick={() => onFile(null)}>✕</button>
          </div>
        )}
      </div>

      <div style={s.divider} />

      {/* ── Dataset Library ──────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={{ ...s.secHead, cursor: 'pointer' }} onClick={() => setLibOpen(v => !v)}>
          <Database size={15} color="#8b5cf6" />
          <span style={s.secTitle}>📚 Dataset Library</span>
          <ChevronDown size={13} style={{ marginLeft: 'auto', color: '#64748b', transform: libOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        {libOpen && (
          <div style={s.libList}>
            {datasetsLoading ? (
              <div style={s.libEmpty}>Loading…</div>
            ) : datasets?.length === 0 ? (
              <div style={s.libEmpty}>No stored datasets yet.</div>
            ) : (
              datasets?.map(ds => (
                <div
                  key={ds.id}
                  style={{
                    ...s.libItem,
                    ...(activeDatasetId === ds.id ? s.libItemActive : {}),
                  }}
                  onClick={() => onSelectDataset(ds)}
                >
                  <div style={s.libItemTop}>
                    <span style={{ ...s.sourceTag, background: `${sourceColor[ds.source] || '#64748b'}22`, color: sourceColor[ds.source] || '#94a3b8', border: `1px solid ${sourceColor[ds.source] || '#64748b'}44` }}>
                      {ds.source}
                    </span>
                    {ds.processed && <span style={s.processedDot} title="Analysed">✓</span>}
                  </div>
                  <div style={s.libItemName}>{ds.name}</div>
                  <div style={s.libItemMeta}>{ds.total_rows?.toLocaleString()} rows · {fmtDate(ds.uploaded_at)}</div>
                  <button
                    style={s.libDelete}
                    title="Delete dataset"
                    onClick={e => { e.stopPropagation(); onDeleteDataset(ds.id) }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {hasResult && (
        <>
          <div style={s.divider} />

          {/* ── Target Scope ─────────────────────────────────────────────── */}
          <div style={s.section}>
            <div style={s.secHead}>
              <Target size={15} color="#8b5cf6" />
              <span style={s.secTitle}>🎯 Target Scope</span>
            </div>

            {policies.length > 0 && (
              <>
                <label style={s.label}>Select Policy/Law</label>
                <div style={{ ...s.selectWrap, marginBottom: 10 }}>
                  <select
                    style={s.select}
                    value={selectedPolicy}
                    onChange={e => onPolicyChange(e.target.value)}
                  >
                    <option value="All Policies">All Policies</option>
                    {policies.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown size={12} style={s.chevron} />
                </div>
              </>
            )}

            {sections.length > 0 && selectedPolicy !== 'All Policies' && (
              <>
                <label style={s.label}>Select Section</label>
                <div style={{ ...s.selectWrap, marginBottom: 10 }}>
                  <select
                    style={s.select}
                    value={selectedSection}
                    onChange={e => onSectionChange(e.target.value)}
                  >
                    <option value="All Sections">All Sections</option>
                    {sections.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                  </select>
                  <ChevronDown size={12} style={s.chevron} />
                </div>
              </>
            )}

            <label style={s.label}>Filter Sentiment</label>
            <div style={s.sentRow}>
              {['All', 'Positive', 'Negative', 'Neutral'].map(v => (
                <button key={v}
                  style={{ ...s.sentBtn, ...(sentimentFilter === v ? s.sentBtnOn : {}) }}
                  onClick={() => onSentimentFilter(v)}
                >{v}</button>
              ))}
            </div>

            <button style={s.resetBtn} onClick={onReset}>
              <RefreshCw size={13} /> Change Data Setup
            </button>
          </div>
        </>
      )}
    </aside>
  )
}

const s = {
  sidebar: {
    width: 272, flexShrink: 0,
    background: 'rgba(10,15,30,0.9)',
    backdropFilter: 'blur(20px)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    padding: '24px 16px',
    display: 'flex', flexDirection: 'column', gap: 0,
    height: '100vh', overflowY: 'auto', position: 'sticky', top: 0,
  },
  section: { marginBottom: 4 },
  secHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  secTitle: { fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' },
  divider: { borderTop: '1px solid rgba(255,255,255,0.07)', margin: '14px 0' },
  dropZone: {
    border: '1.5px dashed rgba(139,92,246,0.35)',
    borderRadius: 12, padding: '16px 12px', textAlign: 'center',
    cursor: 'pointer', marginBottom: 10,
    transition: 'border-color 0.2s',
    background: 'rgba(139,92,246,0.04)',
  },
  dropText: { fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: '#e2e8f0' },
  dropHint: { fontSize: '0.7rem', color: '#64748b', marginBottom: 10 },
  browseBtn: {
    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
    borderRadius: 8, padding: '6px 16px', color: '#c4b5fd',
    cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
  },
  fileChip: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 10, padding: '8px 10px',
  },
  fileName: { fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#e2e8f0' },
  fileSize: { fontSize: '0.68rem', color: '#64748b' },
  clearBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0 },
  // Dataset Library
  libList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' },
  libEmpty: { fontSize: '0.75rem', color: '#475569', textAlign: 'center', padding: '12px 0' },
  libItem: {
    position: 'relative',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10, padding: '10px 10px 8px',
    cursor: 'pointer', transition: 'all 0.18s',
  },
  libItemActive: {
    background: 'rgba(139,92,246,0.12)',
    border: '1px solid rgba(139,92,246,0.4)',
  },
  libItemTop: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  sourceTag: { fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, letterSpacing: '0.04em', textTransform: 'uppercase' },
  processedDot: { fontSize: '0.65rem', color: '#10b981', fontWeight: 700, marginLeft: 'auto' },
  libItemName: { fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 2, paddingRight: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  libItemMeta: { fontSize: '0.67rem', color: '#475569' },
  libDelete: {
    position: 'absolute', top: 8, right: 8,
    background: 'none', border: 'none', color: '#475569',
    cursor: 'pointer', padding: 3, borderRadius: 4,
    display: 'flex', alignItems: 'center',
    transition: 'color 0.15s',
  },
  // Target scope
  label: { display: 'block', fontSize: '0.73rem', color: '#94a3b8', fontWeight: 600, marginBottom: 5, letterSpacing: '0.03em' },
  selectWrap: { position: 'relative' },
  select: {
    width: '100%',
    background: '#1e293b',  /* ← solid dark background so text is always visible */
    border: '1px solid rgba(139,92,246,0.35)',
    borderRadius: 10, padding: '9px 30px 9px 12px',
    color: '#e2e8f0',       /* ← always-white text */
    fontSize: '0.82rem', outline: 'none', cursor: 'pointer',
    fontFamily: 'inherit', appearance: 'none',
  },
  chevron: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', pointerEvents: 'none' },
  sentRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  sentBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '5px 10px', color: '#94a3b8',
    fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
  },
  sentBtnOn: {
    background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.5)',
    color: '#c4b5fd', fontWeight: 700,
  },
  resetBtn: {
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 10, padding: '9px 14px', color: '#60a5fa',
    fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
  },
}
