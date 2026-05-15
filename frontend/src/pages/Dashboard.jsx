import { useState, useMemo, useEffect, useRef } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Download, Search, Volume2 } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import FeedbackStrip from '../components/FeedbackStrip'
import { api } from '../api'

const SENT_COLORS = { Positive: '#10b981', Negative: '#ef4444', Neutral: '#64748b' }
const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'insights',  label: '🧠 Insights & Themes' },
  { id: 'wordcloud', label: '☁️ Word Cloud' },
  { id: 'explorer',  label: '🔍 Data Explorer' },
]

const TT_STYLE = {
  background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, fontSize: '0.8rem', color: '#e2e8f0',
}

export default function Dashboard({ result, filteredRecords, selectedPolicy, selectedSection }) {
  const [tab, setTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [wcImage, setWcImage] = useState(null)
  const [wcLoading, setWcLoading] = useState(false)
  const [wcFilter, setWcFilter] = useState('All')

  const { insights, keywords, themes_count, themes_preview, trend, columns, policy_breakdown } = result
  const { text_col, policy_col, section_col, date_col } = columns

  // === derived filtered stats ===
  const stats = useMemo(() => {
    const n = filteredRecords.length
    if (!n) return { n: 0, pos: 0, neg: 0, neu: 0, avg: 0 }
    let pos = 0, neg = 0, neu = 0, sum = 0
    for (const r of filteredRecords) {
      if (r.Sentiment === 'Positive') pos++
      else if (r.Sentiment === 'Negative') neg++
      else neu++
      sum += Number(r.Score || 0)
    }
    return { n, pos, neg, neu, avg: sum / n }
  }, [filteredRecords])

  const pieData = [
    { name: 'Positive', value: stats.pos },
    { name: 'Negative', value: stats.neg },
    { name: 'Neutral',  value: stats.neu },
  ].filter(d => d.value > 0)

  // keywords from filtered records
  const filteredKeywords = useMemo(() => {
    const stop = new Set(['the','and','for','are','but','not','you','all','any','can','her','was','she','that','this','with','they','have','from','had','has','been','were','will','just','each','than','then','them','some','his','him','into','its','our','use','used','more','most','such','when','also','over','your','same','said'])
    const words = {}
    for (const r of filteredRecords) {
      String(r[text_col] || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).forEach(w => {
        if (w.length > 2 && !stop.has(w)) words[w] = (words[w] || 0) + 1
      })
    }
    return Object.entries(words).sort((a,b) => b[1]-a[1]).slice(0, 12)
      .map(([keyword, count]) => ({ keyword, count }))
  }, [filteredRecords, text_col])

  // trend data for filtered
  const trendData = useMemo(() => {
    if (!date_col) return []
    const map = {}
    for (const r of filteredRecords) {
      const d = String(r[date_col] || '').slice(0, 10)
      if (!d) continue
      if (!map[d]) map[d] = { date: d, Positive: 0, Negative: 0, Neutral: 0 }
      map[d][r.Sentiment] = (map[d][r.Sentiment] || 0) + 1
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredRecords, date_col])

  // word cloud
  const loadWordCloud = async (filter = 'All') => {
    setWcLoading(true)
    try {
      let recs = filteredRecords
      if (filter !== 'All') recs = recs.filter(r => r.Sentiment === filter)
      const texts = recs.map(r => r[text_col]).filter(Boolean)
      const data = await api.generateWordCloud(texts, filter)
      setWcImage(data.image)
    } catch (e) {
      console.error(e)
    } finally {
      setWcLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'wordcloud') loadWordCloud(wcFilter)
  }, [tab, filteredRecords])

  // TTS
  const speak = (text) => {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95; u.pitch = 1.0
    window.speechSynthesis.speak(u)
  }

  // data explorer filtered
  const explorerData = useMemo(() => {
    const q = search.toLowerCase()
    return filteredRecords.filter(r =>
      !q || String(r[text_col] || '').toLowerCase().includes(q)
    )
  }, [filteredRecords, text_col, search])

  const downloadCSV = () => {
    const cols = Object.keys(explorerData[0] || {})
    const rows = [cols.join(','), ...explorerData.map(r =>
      cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')
    )]
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'feedback_data.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // top pos/neg for actionable highlights
  const topPos = filteredRecords.filter(r => r.Sentiment === 'Positive').sort((a,b) => b.Score - a.Score)
  const topNeg = filteredRecords.filter(r => r.Sentiment === 'Negative').sort((a,b) => a.Score - b.Score)

  const contextStr = selectedPolicy !== 'All Policies'
    ? `Analyzing: ${selectedPolicy}${selectedSection !== 'All Sections' ? ` › ${selectedSection}` : ''}`
    : 'Analyzing: All Policies'

  return (
    <div style={s.wrap} className="anim-fade">
      <div style={s.contextBar}>
        <span style={s.contextText}>📍 {contextStr}</span>
      </div>

      {/* KPIs */}
      <div style={s.kpiGrid}>
        <KpiCard label="Total Comments"  value={stats.n.toLocaleString()} />
        <KpiCard label="Positive"  value={`${stats.n ? ((stats.pos/stats.n)*100).toFixed(1) : 0}%`} color="#10b981" />
        <KpiCard label="Negative"  value={`${stats.n ? ((stats.neg/stats.n)*100).toFixed(1) : 0}%`} color="#ef4444" />
        <KpiCard
          label="Avg Sentiment"
          value={stats.avg.toFixed(2)}
          color={stats.avg > 0 ? '#10b981' : stats.avg < 0 ? '#ef4444' : '#64748b'}
        />
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <button key={t.id}
            style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnOn : {}) }}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {/* ═══ TAB: DASHBOARD ═══ */}
      {tab === 'dashboard' && (
        <div>
          <div style={s.twoCol}>
            <div className="glass-card" data-bot="chart">
              <h3 style={s.cardTitle}>Sentiment Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={4} dataKey="value">
                    {pieData.map(e => <Cell key={e.name} fill={SENT_COLORS[e.name]} />)}
                  </Pie>
                  <Tooltip contentStyle={TT_STYLE} />
                  <Legend iconType="circle" iconSize={9}
                    formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card" data-bot="chart">
              <h3 style={s.cardTitle}>Top Keywords Extracted</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={filteredKeywords} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="keyword" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {trendData.length > 0 && (
            <div className="glass-card" style={{ marginTop: 16 }} data-bot="chart">
              <h3 style={s.cardTitle}>Sentiment Over Time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Legend iconSize={9} formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{v}</span>} />
                  <Line type="monotone" dataKey="Positive" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Negative" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Neutral"  stroke="#64748b" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {policy_breakdown.length > 0 && (
            <div className="glass-card" style={{ marginTop: 16 }}>
              <h3 style={s.cardTitle}>Policy Breakdown</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Policy','Total','Positive','Negative','Neutral','Avg Score'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {policy_breakdown.map((p, i) => (
                      <tr key={i} style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                        <td style={{ ...s.td, fontWeight: 700, color: '#e2e8f0' }}>{p.policy}</td>
                        <td style={s.td}>{p.total}</td>
                        <td style={{ ...s.td, color: '#10b981' }}>{p.positive}</td>
                        <td style={{ ...s.td, color: '#ef4444' }}>{p.negative}</td>
                        <td style={{ ...s.td, color: '#64748b' }}>{p.neutral}</td>
                        <td style={{ ...s.td, color: p.avg_score > 0 ? '#10b981' : p.avg_score < 0 ? '#ef4444' : '#64748b', fontFamily: 'monospace' }}>
                          {p.avg_score.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: INSIGHTS & THEMES ═══ */}
      {tab === 'insights' && (
        <div>
          <div style={s.twoCol}>
            {/* Executive Summary */}
            <div className="glass-card" data-bot="card">
              <div style={s.hoverLinkRow}>
                <span style={s.hoverLink}>
                  {insights?.summary_sentences?.length ? '🤖 Gen-AI Executive Summary ✨' : '📋 Intelligent Executive Summary ✨'}
                </span>
              </div>
              {insights?.summary_sentences?.length > 0 && (
                <button style={s.ttsBtn}
                  onClick={() => speak('Here is the executive summary. ' + insights.summary_sentences.join(' '))}>
                  <Volume2 size={13} /> 🔊 Read Summary
                </button>
              )}
              {insights?.summary_sentences?.map((line, i) => (
                <div key={i} style={s.bulletRow}>
                  <span style={s.bullet}>•</span>
                  <span style={s.bulletText}>{line}</span>
                </div>
              ))}
              {!insights?.summary_sentences?.length && (
                <p style={{ color: '#64748b' }}>Not enough feedback text to generate a summary.</p>
              )}
            </div>

            {/* Actionable Highlights */}
            <div className="glass-card" data-bot="card">
              <div style={s.hoverLinkRow}>
                <span style={s.hoverLink}>Actionable Highlights ✨</span>
              </div>
              <button style={s.ttsBtn}
                onClick={() => {
                  let t = 'Here are the most actionable highlights. '
                  if (topPos[0]) t += 'Top Positive: ' + topPos[0][text_col] + '. '
                  if (topNeg[0]) t += 'Top Critical: ' + topNeg[0][text_col] + '. '
                  speak(t)
                }}>
                <Volume2 size={13} /> 🔊 Read Feedback
              </button>
              {topPos[0] && <FeedbackStrip text={topPos[0][text_col]} sentiment="Positive" />}
              {topNeg[0] && <FeedbackStrip text={topNeg[0][text_col]} sentiment="Negative" />}
              {topNeg[1] && <FeedbackStrip text={topNeg[1][text_col]} sentiment="Negative" />}
              {!topPos[0] && !topNeg[0] && <p style={{ color: '#64748b' }}>No data available.</p>}
            </div>
          </div>

          {/* Themes */}
          <div className="glass-card" style={{ marginTop: 16 }} data-bot="card">
            <h3 style={s.cardTitle}>🧩 Feedback Themes &amp; Clusters</h3>
            <ThemeTabs themes={themes_preview} themes_count={themes_count} />
          </div>
        </div>
      )}

      {/* ═══ TAB: WORD CLOUD ═══ */}
      {tab === 'wordcloud' && (
        <div className="glass-card" data-bot="chart">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={s.cardTitle} >
              ☁️ Word Cloud — {selectedPolicy}{selectedSection !== 'All Sections' ? ` › ${selectedSection}` : ''}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {['All','Positive','Negative','Neutral'].map(f => (
                <button key={f}
                  style={{ ...s.wcFilterBtn, ...(wcFilter === f ? s.wcFilterBtnOn : {}) }}
                  onClick={() => { setWcFilter(f); loadWordCloud(f) }}
                >{f}</button>
              ))}
            </div>
          </div>

          {wcLoading ? (
            <div style={s.wcPlaceholder}>
              <div style={s.spinner} />
              <span style={{ color: '#64748b', marginTop: 12 }}>Generating word cloud…</span>
            </div>
          ) : wcImage ? (
            <img
              src={wcImage} alt="Word Cloud"
              style={{ width: '100%', borderRadius: 12, background: 'transparent' }}
            />
          ) : (
            <div style={s.wcPlaceholder}>
              <span style={{ color: '#64748b' }}>Not enough text to generate a word cloud.</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: DATA EXPLORER ═══ */}
      {tab === 'explorer' && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={s.cardTitle}>Detailed Feedback Table</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={s.searchWrap}>
                <Search size={13} style={s.searchIcon} />
                <input style={s.searchInput} placeholder="Search comments…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button style={s.dlBtn} onClick={downloadCSV}>
                <Download size={13} /> 📥 Download
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
            <table style={s.table}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr>
                  {[policy_col, section_col, text_col, 'Sentiment', 'Score', 'Short_Summary', date_col]
                    .filter(Boolean)
                    .map(c => <th key={c} style={s.th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {explorerData.slice(0, 300).map((row, i) => (
                  <tr key={i} style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.02)' }}>
                    {[policy_col, section_col, text_col, 'Sentiment', 'Score', 'Short_Summary', date_col]
                      .filter(Boolean)
                      .map(c => (
                        <td key={c} style={{
                          ...s.td,
                          ...(c === 'Sentiment' ? { color: SENT_COLORS[row[c]] || '#94a3b8', fontWeight: 700 } : {}),
                          ...(c === 'Score' ? { color: Number(row[c])>0?'#10b981':Number(row[c])<0?'#ef4444':'#64748b', fontFamily:'monospace' } : {}),
                        }}>
                          {c === text_col
                            ? String(row[c]||'').slice(0,120)+(String(row[c]||'').length>120?'…':'')
                            : c === 'Score' ? Number(row[c]).toFixed(3)
                            : String(row[c]??'')}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {explorerData.length > 300 && (
            <div style={{ padding: '10px 0', color: '#64748b', fontSize: '0.78rem' }}>
              Showing 300 of {explorerData.length} rows. Download CSV for full data.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Theme tabs inner component
function ThemeTabs({ themes, themes_count }) {
  const [active, setActive] = useState(Object.keys(themes || {})[0] || '')
  const themeKeys = Object.keys(themes || {})

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {themeKeys.map(k => (
          <button key={k}
            style={{
              ...tt.tabBtn,
              ...(active === k ? tt.tabBtnOn : {}),
            }}
            onClick={() => setActive(k)}
          >
            {k}
            <span style={tt.badge}>{themes_count[k] || (themes[k]?.length || 0)}</span>
          </button>
        ))}
      </div>
      {active && themes[active] && (
        <div>
          <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 10 }}>
            <strong style={{ color: '#94a3b8' }}>{themes_count[active] || themes[active].length}</strong> comments matched this theme.
          </p>
          {themes[active].map((c, i) => (
            <FeedbackStrip key={i} text={c} sentiment="Neutral" />
          ))}
        </div>
      )}
    </div>
  )
}

const tt = {
  tabBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '6px 14px', color: '#94a3b8',
    fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
  },
  tabBtnOn: {
    background: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)',
    color: '#60a5fa', fontWeight: 700,
  },
  badge: {
    background: 'rgba(255,255,255,0.1)', borderRadius: 999,
    padding: '1px 7px', fontSize: '0.7rem', color: '#64748b',
  },
}

const s = {
  wrap: { flex: 1, padding: '24px 28px', minWidth: 0 },
  contextBar: { marginBottom: 16 },
  contextText: { fontWeight: 700, fontSize: '1rem', color: '#94a3b8' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  tabBar: {
    display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
    padding: '8px 8px 0', marginBottom: 20, flexWrap: 'wrap',
  },
  tabBtn: {
    border: 'none', background: 'transparent', borderRadius: '10px 10px 0 0',
    padding: '10px 22px', color: '#94a3b8', cursor: 'pointer',
    fontSize: '0.85rem', fontFamily: 'inherit', transition: 'all 0.2s',
    borderBottom: '3px solid transparent',
  },
  tabBtnOn: {
    background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
    borderBottomColor: '#3b82f6', fontWeight: 700,
  },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 0 },
  cardTitle: { fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 16 },
  hoverLinkRow: { marginBottom: 8 },
  hoverLink: { color: '#60a5fa', fontSize: '1.1rem', fontWeight: 800, cursor: 'default', borderBottom: '2px dashed #3b82f6' },
  ttsBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fc8019', border: 'none', borderRadius: 10,
    padding: '7px 14px', color: '#fff', cursor: 'pointer',
    fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(252,128,25,0.3)', marginBottom: 14,
    transition: 'all 0.2s',
  },
  bulletRow: { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  bullet: { color: '#8b5cf6', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 },
  bulletText: { color: '#cbd5e1', lineHeight: 1.65, fontSize: '0.88rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { padding: '10px 14px', textAlign: 'left', background: 'rgba(255,255,255,0.05)', color: '#64748b', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top', maxWidth: 260, wordBreak: 'break-word' },
  wcFilterBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '5px 12px', color: '#94a3b8',
    fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  wcFilterBtnOn: {
    background: 'rgba(139,92,246,0.2)', borderColor: 'rgba(139,92,246,0.4)',
    color: '#c4b5fd', fontWeight: 700,
  },
  wcPlaceholder: {
    height: 360, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
  },
  spinner: { width: 28, height: 28, border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  searchWrap: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' },
  searchInput: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '8px 12px 8px 30px', color: '#e2e8f0',
    fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit', width: 220,
  },
  dlBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)',
    border: 'none', borderRadius: 10, padding: '8px 16px',
    color: '#fff', fontSize: '0.82rem', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 600,
  },
}
