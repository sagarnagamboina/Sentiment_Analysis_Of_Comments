import { useState } from 'react'
import { Rocket, ChevronDown } from 'lucide-react'

export default function SetupPage({ uploadData, onConfirm, loading }) {
  const { columns, detected, preview, filename, total_rows } = uploadData

  const [map, setMap] = useState({
    policy_col:  detected?.policy_col  || '',
    section_col: detected?.section_col || '',
    text_col:    detected?.text_col    || columns[0] || '',
    date_col:    detected?.date_col    || '',
  })

  const set = (k, v) => setMap(m => ({ ...m, [k]: v || '' }))
  const nullOpts = ['', ...columns]

  const previewCols = [map.policy_col, map.section_col, map.text_col, map.date_col].filter(Boolean)

  return (
    <div style={s.page} className="anim-fade">
      {/* Step 1 */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h2 style={s.stepTitle}>🛠️ Step 1: Data Setup</h2>
        <p style={s.stepSub}>
          Confirm column mappings for <strong style={{ color: '#c4b5fd' }}>{filename}</strong>{' '}
          ({total_rows?.toLocaleString()} rows). Auto-detected best matches below.
        </p>

        {/* 3 columns — removed Groq API Key column as per requirement */}
        <div style={s.colGrid}>
          <div>
            <label style={s.colLabel}>Policy / Law Column</label>
            <div style={s.selectWrap}>
              <select style={s.select} value={map.policy_col} onChange={e => set('policy_col', e.target.value)}>
                {nullOpts.map(o => (
                  <option key={o} value={o} style={s.option}>{o || '— None —'}</option>
                ))}
              </select>
              <ChevronDown size={13} style={s.chevron} />
            </div>
          </div>

          <div>
            <label style={s.colLabel}>Section Column</label>
            <div style={s.selectWrap}>
              <select style={s.select} value={map.section_col}
                onChange={e => set('section_col', e.target.value)}>
                {nullOpts.filter(o => !o || o !== map.policy_col).map(o => (
                  <option key={o} value={o} style={s.option}>{o || '— None —'}</option>
                ))}
              </select>
              <ChevronDown size={13} style={s.chevron} />
            </div>
          </div>

          <div>
            <label style={s.colLabel}>
              Comment Text Column <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={s.selectWrap}>
              <select style={s.select} value={map.text_col}
                onChange={e => set('text_col', e.target.value)}>
                {columns
                  .filter(c => c !== map.policy_col && c !== map.section_col)
                  .map(o => (
                    <option key={o} value={o} style={s.option}>{o}</option>
                  ))}
              </select>
              <ChevronDown size={13} style={s.chevron} />
            </div>
          </div>

          <div>
            <label style={s.colLabel}>Date Column</label>
            <div style={s.selectWrap}>
              <select style={s.select} value={map.date_col}
                onChange={e => set('date_col', e.target.value)}>
                {nullOpts
                  .filter(o => !o || ![map.policy_col, map.section_col, map.text_col].includes(o))
                  .map(o => (
                    <option key={o} value={o} style={s.option}>{o || '— None —'}</option>
                  ))}
              </select>
              <ChevronDown size={13} style={s.chevron} />
            </div>
          </div>
        </div>

        <div style={s.noteBar}>
          ✅ <strong>Groq AI</strong> is pre-configured on the server — no key needed.
        </div>
      </div>

      {/* Data Preview */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <h2 style={s.stepTitle}>👀 Data Preview</h2>
        {previewCols.length > 0 ? (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  {previewCols.map(c => <th key={c} style={s.th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={s.td}>{i + 1}</td>
                    {previewCols.map(c => (
                      <td key={c} style={s.td}>
                        {String(row[c] ?? '').slice(0, 80)}
                        {String(row[c] ?? '').length > 80 ? '…' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#64748b' }}>Select columns above to preview data.</p>
        )}
      </div>

      <button
        style={{ ...s.genBtn, ...(loading || !map.text_col ? s.genBtnDisabled : {}) }}
        disabled={loading || !map.text_col}
        onClick={() => onConfirm(map)}
      >
        {loading ? (
          <><div style={s.spinner} /> Analyzing Intelligence…</>
        ) : (
          <><Rocket size={18} /> 🚀 Generate Intelligence</>
        )}
      </button>
    </div>
  )
}

const s = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  stepTitle: { fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: '#f1f5f9' },
  stepSub: { color: '#94a3b8', marginBottom: 24, fontSize: '0.88rem' },
  colGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 },
  colLabel: { display: 'block', fontSize: '0.73rem', color: '#94a3b8', fontWeight: 600, marginBottom: 6, letterSpacing: '0.03em' },
  selectWrap: { position: 'relative' },
  // KEY FIX: solid background so option text is always readable
  select: {
    width: '100%',
    background: '#1e293b',
    border: '1px solid rgba(139,92,246,0.4)',
    borderRadius: 10, padding: '10px 30px 10px 12px',
    color: '#e2e8f0',
    fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
    fontFamily: 'inherit', appearance: 'none',
  },
  option: {
    background: '#1e293b',
    color: '#e2e8f0',
  },
  chevron: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', pointerEvents: 'none' },
  noteBar: {
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 10, padding: '10px 16px', fontSize: '0.8rem', color: '#6ee7b7',
  },
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th: {
    padding: '10px 14px', textAlign: 'left',
    background: 'rgba(139,92,246,0.08)', color: '#c4b5fd',
    fontWeight: 600, fontSize: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  td: {
    padding: '10px 14px', color: '#cbd5e1',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    verticalAlign: 'top', maxWidth: 260, wordBreak: 'break-word',
  },
  genBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', padding: '16px', borderRadius: 14,
    background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
    border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
    transition: 'all 0.3s',
  },
  genBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  spinner: { width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
}
