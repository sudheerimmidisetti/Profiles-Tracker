// LeaderboardPage.jsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Leaderboard from '../components/Leaderboard'
import PlacementsLeaderboard from '../components/leaderboards/PlacementsLeaderboard'
import WeeklyLeaderboard from '../components/leaderboards/WeeklyLeaderboard'
import MonthlyLeaderboard from '../components/leaderboards/MonthlyLeaderboard'

const TABS = [
  { id: 'platform',   label: 'Platform' },
  { id: 'placements', label: 'Placements' },
  { id: 'weekly',     label: 'Weekly' },
  { id: 'monthly',    label: 'Monthly' },
]

const PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank']
const PLAT_LABELS = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', hackerrank: 'HackerRank' }

export default function LeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const initTab = TABS.find(t => t.id === params.get('tab'))?.id || 'platform'
  const [activeTab, setActiveTab] = useState(initTab)
  const [platform,  setPlatform]  = useState('leetcode')

  function switchTab(id) {
    setActiveTab(id)
    setParams({ tab: id })
  }

  return (
    <>
      <Header title="Leaderboard" breadcrumb="Overview" />
      <div className="page">

        {/* Tab selector — uses app's .pills/.pill pattern */}
        <div className="card" style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div className="pills">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`pill${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => switchTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Platform picker — only shown in Platform tab */}
            {activeTab === 'platform' && (
              <div className="pills">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    className={`pill${platform === p ? ' active' : ''}`}
                    onClick={() => setPlatform(p)}
                  >
                    {PLAT_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'platform'   && <Leaderboard platform={platform} />}
        {activeTab === 'placements' && <PlacementsLeaderboard />}
        {activeTab === 'weekly'     && <WeeklyLeaderboard />}
        {activeTab === 'monthly'    && <MonthlyLeaderboard />}

      </div>
    </>
  )
}
