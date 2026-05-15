export default function WelcomeScreen() {
  return (
    <div style={s.wrap} className="anim-pop">
      <div style={s.card}>
        <h1 style={s.title}>Sentimental Analysis of E-Consultancy</h1>
        <p style={s.sub}>
          Upload your dataset in the sidebar to begin. We'll automatically extract intelligent insights,
          perform advanced sentiment analysis, and highlight critical stakeholder feedback.
        </p>
        <div style={s.steps}>
          {[
            { icon: '📂', label: 'Upload your CSV feedback dataset' },
            { icon: '🗂️', label: 'Map columns (auto-detected for you)' },
            { icon: '🚀', label: 'Generate intelligence with Groq AI' },
          ].map(({ icon, label }, i) => (
            <div key={i} style={s.step}>
              <div style={s.stepIcon}>{icon}</div>
              <div style={s.stepLabel}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 24px', minHeight: '70vh' },
  card: {
    textAlign: 'center', padding: '80px 32px', maxWidth: 700,
    background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(16px)',
    borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  title: {
    fontSize: 'clamp(1.6rem,3.5vw,2.6rem)', fontWeight: 800,
    background: 'linear-gradient(135deg, #60a5fa, #c084fc)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    marginBottom: 20, lineHeight: 1.2,
  },
  sub: { color: '#94a3b8', fontSize: '1rem', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 40px' },
  steps: { display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' },
  step: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '20px 18px', width: 170,
  },
  stepIcon: { fontSize: '2rem' },
  stepLabel: { fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4, textAlign: 'center' },
}
