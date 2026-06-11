// LeaderboardPage.jsx — 4 tabs: Platform | Placements | Weekly | Monthly
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Leaderboard from '../components/Leaderboard'
import PlacementsLeaderboard from '../components/leaderboards/PlacementsLeaderboard'
import WeeklyLeaderboard from '../components/leaderboards/WeeklyLeaderboard'
import MonthlyLeaderboard from '../components/leaderboards/MonthlyLeaderboard'

const BOARD_TABS = [
  { id: 'platform',   label: '📊 Platform',   desc: 'Total solved, rating, consistency per platform' },
  { id: 'placements', label: '🏆 Placements',  desc: '6-month rolling window · 100pt scoring' },
  { id: 'weekly',     label: '⚡ Weekly',      desc: 'This week\'s contest performance only' },
  { id: 'monthly',    label: '📅 Monthly',     desc: 'Contest (60%) + Practice (40%) blend' },
]

export default function LeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const initTab = BOARD_TABS.find(t => t.id === params.get('tab'))?.id || 'platform'
  const [activeTab, setActiveTab] = useState(initTab)

  function switchTab(id) {
    setActiveTab(id)
    setParams({ tab: id })
  }

  return (
    <>
      <Header title="Leaderboard" breadcrumb="Overview" />
      <div className="page">

        {/* Tab bar */}
        <div className="card" style={{ padding:'12px 16px', marginBottom:0 }}>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {BOARD_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                style={{
                  padding:'8px 18px',
                  borderRadius:8,
                  border: activeTab === tab.id ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--fg)' : 'var(--fg-muted)',
                  fontSize:13,
                  fontWeight: activeTab === tab.id ? 700 : 400,
                  cursor:'pointer',
                  transition:'all 0.15s',
                  whiteSpace:'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Description of active tab */}
          <div style={{ fontSize:12, color:'var(--fg-muted)', marginTop:8 }}>
            {BOARD_TABS.find(t => t.id === activeTab)?.desc}
          </div>
        </div>

        {/* Board content */}
        {activeTab === 'platform'   && <PlatformTab />}
        {activeTab === 'placements' && <PlacementsLeaderboard />}
        {activeTab === 'weekly'     && <WeeklyLeaderboard />}
        {activeTab === 'monthly'    && <MonthlyLeaderboard />}

      </div>
    </>
  )
}

function PlatformTab() {
  const PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank']
  const [platform, setPlatform] = useState('leetcode')

  return (
    <>
      {/* Platform picker inside the platform tab */}
      <div className="card" style={{ padding:'10px 16px' }}>
        <div className="pills">
          {PLATFORMS.map(p => (
            <button
              key={p}
              className={`pill${platform === p ? ' active' : ''}`}
              onClick={() => setPlatform(p)}
            >
              {p === 'leetcode' ? 'LeetCode' : p === 'codeforces' ? 'Codeforces' : p === 'codechef' ? 'CodeChef' : 'HackerRank'}
            </button>
          ))}
        </div>
      </div>
      <Leaderboard platform={platform} />
    </>
  )
}
