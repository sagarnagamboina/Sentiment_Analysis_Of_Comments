import { useEffect, useRef } from 'react'

const MESSAGES = {
  kpi:     "Wow, look at those metrics! 📈",
  chart:   "Interactive charts! Try zooming in! 📊",
  card:    "Analyzing this section for you... 🧠",
  default: "I'm your AI Assistant!",
  self:    "Hey there! Ready to analyze data? 🚀",
}

export default function FloatingBot() {
  const bubbleRef = useRef(null)
  const avatarRef = useRef(null)

  useEffect(() => {
    const bubble = bubbleRef.current
    const avatar = avatarRef.current
    if (!bubble || !avatar) return

    const show = (msg) => {
      bubble.textContent = msg
      bubble.style.opacity = '1'
      bubble.style.transform = 'translateY(0)'
    }
    const hide = () => {
      bubble.style.opacity = '0'
      bubble.style.transform = 'translateY(15px)'
    }
    const bounce = () => {
      avatar.style.animation = 'none'
      setTimeout(() => { avatar.style.animation = 'bounceBot 0.6s cubic-bezier(.175,.885,.32,1.275)' }, 10)
    }

    const handler = (e) => {
      const t = e.target
      if (t.closest('[data-bot="kpi"]'))   { show(MESSAGES.kpi);   bounce(); }
      else if (t.closest('[data-bot="chart"]')) show(MESSAGES.chart)
      else if (t.closest('[data-bot="self"]'))  { show(MESSAGES.self); bounce(); }
      else if (t.closest('[data-bot="card"]'))  show(MESSAGES.card)
      else hide()
    }

    document.addEventListener('mouseover', handler)
    return () => document.removeEventListener('mouseover', handler)
  }, [])

  return (
    <div style={s.container} data-bot="self">
      <div ref={bubbleRef} style={s.bubble}>I'm your AI Assistant!</div>
      <div ref={avatarRef} style={s.avatar}>
        <img
          src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/People/Boy.png"
          width={80} height={80} alt="AI Bot"
        />
      </div>
    </div>
  )
}

const s = {
  container: {
    position: 'fixed', bottom: 30, right: 30, zIndex: 9999,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    pointerEvents: 'auto', userSelect: 'none',
  },
  bubble: {
    background: 'rgba(15,23,42,0.95)',
    color: '#60a5fa',
    padding: '10px 16px',
    borderRadius: 14,
    border: '1px solid #3b82f6',
    fontSize: '0.82rem',
    marginBottom: 10,
    boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
    opacity: 0,
    transform: 'translateY(15px)',
    transition: 'all 0.4s cubic-bezier(.175,.885,.32,1.275)',
    fontWeight: 700,
    textAlign: 'center',
    maxWidth: 190,
    pointerEvents: 'none',
  },
  avatar: {
    animation: 'float 3s ease-in-out infinite',
    filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.5))',
    cursor: 'pointer',
  },
}
