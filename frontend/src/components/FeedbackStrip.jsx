const ICONS = { Positive: '🌟', Negative: '⚠️', Neutral: 'ℹ️' }

export default function FeedbackStrip({ text, sentiment = 'Neutral' }) {
  const cls = sentiment === 'Positive' ? 'feedback-positive'
            : sentiment === 'Negative' ? 'feedback-negative'
            : 'feedback-neutral'
  return (
    <div className={cls}>
      <span style={{ marginRight: 8 }}>{ICONS[sentiment] || 'ℹ️'}</span>
      <span style={{ color: '#e2e8f0', lineHeight: 1.6, fontSize: '0.88rem' }}>{text}</span>
    </div>
  )
}
