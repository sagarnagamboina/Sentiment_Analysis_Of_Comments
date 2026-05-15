export default function KpiCard({ label, value, color }) {
  return (
    <div className="kpi-card anim-num" data-bot="kpi">
      <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: '2.2rem', fontWeight: 700, color: color || '#e6edf3', lineHeight: 1, marginBottom: 2 }}>
        {value}
      </div>
    </div>
  )
}
