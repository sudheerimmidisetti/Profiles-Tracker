// PublicLeaderboardPage.jsx — no auth required, shareable link
import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import PlacementsLeaderboard from '../components/leaderboards/PlacementsLeaderboard'
import OverallLeaderboard    from '../components/leaderboards/OverallLeaderboard'
import WeeklyLeaderboard     from '../components/leaderboards/WeeklyLeaderboard'
import MonthlyLeaderboard    from '../components/leaderboards/MonthlyLeaderboard'
import { Share2, ExternalLink, Trophy } from 'lucide-react'

const TABS = [
  { id: 'placements', label: 'Placements',  emoji: '🏅' },
  { id: 'overall',    label: 'All-Time',    emoji: '🌐' },
  { id: 'weekly',     label: 'Weekly',      emoji: '📅' },
  { id: 'monthly',    label: 'Monthly',     emoji: '📆' },
]

export default function PublicLeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const initTab = TABS.find(t => t.id === params.get('tab'))?.id || 'placements'
  const [activeTab, setActiveTab] = useState(initTab)
  const [copied, setCopied] = useState(false)

  function switchTab(id) {
    setActiveTab(id)
    setParams({ tab: id })
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', color: '#e2e8f0', fontFamily: "'Inter','Outfit',system-ui,sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 60,
        background: 'rgba(10,10,22,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg,#6366f1 0%,#a855f7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.78rem', fontWeight: 900, color: '#fff', letterSpacing: '-.04em',
            flexShrink: 0,
          }}>CP</div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-.02em', color: '#f1f5f9' }}>
              ACET Coding Tracker
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1, marginTop: 2 }}>
              Annamacharya College of Engineering
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <button onClick={copyLink} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
            color: copied ? '#22c55e' : '#94a3b8',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            transition: 'all .15s',
          }}>
            <Share2 size={13}/>
            {copied ? '✓ Copied!' : 'Share'}
          </button>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 8,
            background: '#6366f1', color: '#fff',
            fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
          }}>
            <ExternalLink size={13}/> Student Login
          </Link>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '4px 14px', borderRadius: 20, marginBottom: 16,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            fontSize: '0.72rem', fontWeight: 600, color: '#818cf8', letterSpacing: '.04em',
          }}>
            <Trophy size={11}/> LIVE RANKINGS
          </div>
          <h1 style={{
            fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 900, letterSpacing: '-.04em',
            background: 'linear-gradient(135deg,#f1f5f9 30%,#818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0 0 10px',
          }}>
            Coding Leaderboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
            Live competitive programming rankings across LeetCode, Codeforces &amp; CodeChef
          </p>
        </div>

        {/* ── Tab filter bar ──────────────────────────────────── */}
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 4,
          marginBottom: 28, gap: 2,
          flexWrap: 'wrap',
        }}>
          {TABS.map(t => {
            const active = activeTab === t.id
            return (
              <button key={t.id} onClick={() => switchTab(t.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 10,
                border: 'none',
                background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                color: active ? '#a5b4fc' : '#64748b',
                fontSize: '0.82rem', fontWeight: active ? 700 : 500,
                cursor: 'pointer', transition: 'all .15s',
                outline: active ? '1px solid rgba(99,102,241,0.35)' : 'none',
              }}>
                <span style={{ fontSize: '0.85em' }}>{t.emoji}</span>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div>
          {activeTab === 'placements' && <PlacementsLeaderboard />}
          {activeTab === 'overall'    && <OverallLeaderboard />}
          {activeTab === 'weekly'     && <WeeklyLeaderboard />}
          {activeTab === 'monthly'    && <MonthlyLeaderboard />}
        </div>
      </div>
    </div>
  )
}
