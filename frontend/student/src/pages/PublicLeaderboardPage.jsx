// PublicLeaderboardPage.jsx — no auth required, shareable link
import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import PlacementsLeaderboard from '../components/leaderboards/PlacementsLeaderboard'
import OverallLeaderboard    from '../components/leaderboards/OverallLeaderboard'
import WeeklyLeaderboard     from '../components/leaderboards/WeeklyLeaderboard'
import MonthlyLeaderboard    from '../components/leaderboards/MonthlyLeaderboard'
import { Share2, ExternalLink } from 'lucide-react'

const TABS = [
  { id: 'placements', label: '🏅 Placements' },
  { id: 'overall',    label: '🌐 All-Time'   },
  { id: 'weekly',     label: '📅 Weekly'     },
  { id: 'monthly',    label: '📆 Monthly'    },
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
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="pub-lb-root">
      {/* Top nav bar */}
      <header className="pub-lb-header">
        <div className="pub-lb-brand">
          <div className="pub-lb-logo-mark">CP</div>
          <div>
            <div className="pub-lb-college">ACET Coding Tracker</div>
            <div className="pub-lb-subtitle">Annamacharya College of Engineering</div>
          </div>
        </div>
        <div className="pub-lb-actions">
          <button onClick={copyLink} className="pub-action-btn">
            <Share2 size={14} />
            {copied ? 'Copied!' : 'Share Link'}
          </button>
          <Link to="/login" className="pub-action-btn pub-action-btn-primary">
            <ExternalLink size={14} /> Student Login
          </Link>
        </div>
      </header>

      <div className="pub-lb-body">
        {/* Hero */}
        <div className="pub-lb-hero">
          <h1 className="pub-lb-title">Coding Leaderboard</h1>
          <p className="pub-lb-desc">
            Live rankings of competitive programmers across LeetCode, Codeforces & CodeChef.
          </p>
        </div>

        {/* Tabs */}
        <div className="pub-lb-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`pub-lb-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="pub-lb-content">
          {activeTab === 'placements' && <PlacementsLeaderboard />}
          {activeTab === 'overall'    && <OverallLeaderboard />}
          {activeTab === 'weekly'     && <WeeklyLeaderboard />}
          {activeTab === 'monthly'    && <MonthlyLeaderboard />}
        </div>
      </div>

      <style>{`
        .pub-lb-root {
          min-height: 100vh;
          background: var(--bg, #0a0a12);
          color: var(--fg, #e2e8f0);
          font-family: 'Inter', 'Outfit', sans-serif;
        }
        .pub-lb-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 32px;
          border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
          background: var(--surface, #13131f);
          position: sticky; top: 0; z-index: 50;
          backdrop-filter: blur(12px);
        }
        .pub-lb-brand { display: flex; align-items: center; gap: 12px; }
        .pub-lb-logo-mark {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem; font-weight: 900; color: #fff; letter-spacing: -.04em;
        }
        .pub-lb-college { font-size: 0.9rem; font-weight: 700; letter-spacing: -.02em; }
        .pub-lb-subtitle { font-size: 0.7rem; color: var(--fg-muted, #64748b); margin-top: 1px; }
        .pub-lb-actions { display: flex; gap: 8px; align-items: center; }
        .pub-action-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 9px;
          border: 1.5px solid var(--border, rgba(255,255,255,.1));
          background: var(--surface, #13131f);
          color: var(--fg-muted, #94a3b8);
          font-size: 0.77rem; font-weight: 600; cursor: pointer;
          text-decoration: none; transition: all .12s;
        }
        .pub-action-btn:hover { color: var(--fg, #e2e8f0); border-color: var(--primary, #6366f1); }
        .pub-action-btn-primary {
          background: var(--primary, #6366f1); color: #fff !important;
          border-color: transparent;
        }
        .pub-action-btn-primary:hover { background: #5254c4; }
        .pub-lb-body { max-width: 1100px; margin: 0 auto; padding: 32px 24px 60px; }
        .pub-lb-hero { text-align: center; margin-bottom: 28px; }
        .pub-lb-title {
          font-size: 2rem; font-weight: 900; letter-spacing: -.04em;
          background: linear-gradient(135deg, #e2e8f0, #818cf8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin: 0 0 8px;
        }
        .pub-lb-desc { color: var(--fg-muted, #64748b); font-size: 0.9rem; margin: 0; }
        .pub-lb-tabs {
          display: flex; gap: 6px; justify-content: center;
          flex-wrap: wrap; margin-bottom: 24px;
        }
        .pub-lb-tab {
          padding: 8px 18px; border-radius: 24px;
          border: 1.5px solid var(--border, rgba(255,255,255,.08));
          background: var(--surface, #13131f);
          color: var(--fg-muted, #64748b);
          font-size: 0.82rem; font-weight: 600; cursor: pointer;
          transition: all .12s;
        }
        .pub-lb-tab.active {
          border-color: var(--primary, #6366f1);
          color: var(--primary, #6366f1);
          background: rgba(99,102,241,.09);
        }
        .pub-lb-tab:hover { color: var(--fg, #e2e8f0); }
        .pub-lb-content { }
      `}</style>
    </div>
  )
}
