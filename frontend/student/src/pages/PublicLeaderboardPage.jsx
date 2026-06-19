// PublicLeaderboardPage.jsx — no auth required, shareable link — LIGHT MODE
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PlacementsLeaderboard from '../components/leaderboards/PlacementsLeaderboard'
import OverallLeaderboard    from '../components/leaderboards/OverallLeaderboard'
import WeeklyLeaderboard     from '../components/leaderboards/WeeklyLeaderboard'
import MonthlyLeaderboard    from '../components/leaderboards/MonthlyLeaderboard'
import { Share2, Trophy } from 'lucide-react'

const TABS = [
  { id: 'placements', label: 'Placements', emoji: '🏅' },
  { id: 'overall',    label: 'All-Time',   emoji: '🌐' },
  { id: 'weekly',     label: 'Weekly',     emoji: '📅' },
  { id: 'monthly',    label: 'Monthly',    emoji: '📆' },
]

/* ── Scoped CSS reset so dark global vars don't bleed in ─────────── */
const CSS = `
  .pub-root {
    min-height: 100vh;
    background: #f8fafc;
    color: #0f172a;
    font-family: 'Inter', 'Outfit', system-ui, sans-serif;
  }
  /* Override any dark CSS vars inside pub-root */
  .pub-root, .pub-root * {
    --bg: #f8fafc;
    --surface: #ffffff;
    --border: #e2e8f0;
    --fg: #0f172a;
    --fg-muted: #64748b;
    --primary: #6366f1;
  }
  .pub-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; height: 64px;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .pub-brand { display: flex; align-items: center; gap: 12px; }
  .pub-logo {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem; font-weight: 900; color: #fff; letter-spacing: -.04em;
    flex-shrink: 0;
  }
  .pub-brand-name { font-size: 0.95rem; font-weight: 700; color: #0f172a; line-height: 1.2; letter-spacing: -.02em; }
  .pub-brand-sub  { font-size: 0.67rem; color: #94a3b8; margin-top: 1px; }
  .pub-share-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 15px; border-radius: 9px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc; color: #475569;
    font-size: 0.78rem; font-weight: 600; cursor: pointer;
    transition: all .15s; white-space: nowrap;
  }
  .pub-share-btn:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
  .pub-share-btn.copied { border-color: #22c55e; color: #22c55e; background: #f0fdf4; }

  .pub-body { max-width: 1120px; margin: 0 auto; padding: 44px 28px 80px; }

  .pub-hero { text-align: center; margin-bottom: 36px; }
  .pub-live-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 14px; border-radius: 20px; margin-bottom: 14px;
    background: #eef2ff; border: 1px solid #c7d2fe;
    font-size: 0.7rem; font-weight: 700; color: #6366f1; letter-spacing: .05em;
    text-transform: uppercase;
  }
  .pub-hero h1 {
    font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 900;
    letter-spacing: -.04em; color: #0f172a; margin: 0 0 10px;
  }
  .pub-hero h1 span { color: #6366f1; }
  .pub-hero p { color: #64748b; font-size: 0.9rem; margin: 0; }

  .pub-tabs-wrap {
    display: flex; justify-content: center; margin-bottom: 32px;
  }
  .pub-tabs {
    display: inline-flex; gap: 4px;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    border-radius: 14px; padding: 4px;
  }
  .pub-tab {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 20px; border-radius: 10px; border: none;
    background: transparent; color: #64748b;
    font-size: 0.84rem; font-weight: 500; cursor: pointer;
    transition: all .15s;
  }
  .pub-tab.active {
    background: #fff; color: #6366f1; font-weight: 700;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }
  .pub-tab:hover:not(.active) { color: #334155; background: rgba(255,255,255,0.6); }
`

export default function PublicLeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const initTab = TABS.find(t => t.id === params.get('tab'))?.id || 'placements'
  const [activeTab, setActiveTab] = useState(initTab)
  const [copied, setCopied]       = useState(false)

  function switchTab(id) { setActiveTab(id); setParams({ tab: id }) }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2200)
    })
  }

  return (
    <div className="pub-root">
      <style>{CSS}</style>

      {/* Header */}
      <header className="pub-header">
        <div className="pub-brand">
          <div className="pub-logo">CP</div>
          <div>
            <div className="pub-brand-name">ACET Coding Tracker</div>
            <div className="pub-brand-sub">Annamacharya College of Engineering &amp; Technology</div>
          </div>
        </div>
        <button onClick={copyLink} className={`pub-share-btn${copied ? ' copied' : ''}`}>
          <Share2 size={13}/>
          {copied ? '✓ Copied!' : 'Share Link'}
        </button>
      </header>

      {/* Body */}
      <div className="pub-body">
        {/* Hero */}
        <div className="pub-hero">
          <div className="pub-live-badge">
            <Trophy size={11}/> Live Rankings
          </div>
          <h1>Coding <span>Leaderboard</span></h1>
          <p>Competitive programming rankings across LeetCode, Codeforces &amp; CodeChef</p>
        </div>

        {/* Tabs */}
        <div className="pub-tabs-wrap">
          <div className="pub-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`pub-tab${activeTab === t.id ? ' active' : ''}`}
                onClick={() => switchTab(t.id)}
              >
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
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
