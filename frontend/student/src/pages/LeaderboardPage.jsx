// LeaderboardPage.jsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import PlacementsLeaderboard from '../components/leaderboards/PlacementsLeaderboard'
import OverallLeaderboard from '../components/leaderboards/OverallLeaderboard'
import WeeklyLeaderboard from '../components/leaderboards/WeeklyLeaderboard'
import MonthlyLeaderboard from '../components/leaderboards/MonthlyLeaderboard'

const TABS = [
  { id: 'placements', label: 'Placements' },
  { id: 'overall',    label: 'Overall'    },
  { id: 'weekly',     label: 'Weekly'     },
  { id: 'monthly',    label: 'Monthly'    },
]

export default function LeaderboardPage() {
  const [params, setParams] = useSearchParams()
  const initTab = TABS.find(t => t.id === params.get('tab'))?.id || 'placements'
  const [activeTab, setActiveTab] = useState(initTab)

  function switchTab(id) {
    setActiveTab(id)
    setParams({ tab: id })
  }

  return (
    <>
      <Header title="Leaderboard" breadcrumb="Overview" />
      <div className="page">

        {/* Tab selector */}
        <div className="card" style={{ padding: '10px 16px' }}>
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
        </div>

        {/* Content */}
        {activeTab === 'placements' && <PlacementsLeaderboard />}
        {activeTab === 'overall'    && <OverallLeaderboard />}
        {activeTab === 'weekly'     && <WeeklyLeaderboard />}
        {activeTab === 'monthly'    && <MonthlyLeaderboard />}

      </div>
    </>
  )
}
