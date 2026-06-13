// admin/src/pages/LeaderboardPage.jsx
// Uses the exact same leaderboard components as the student portal —
// same logic, same ordering, same scoring display.
import { useState } from 'react'
import AdminHeader from '../components/AdminHeader'
import PlacementsLeaderboard from '../components/leaderboards/PlacementsLeaderboard'
import WeeklyLeaderboard     from '../components/leaderboards/WeeklyLeaderboard'
import MonthlyLeaderboard    from '../components/leaderboards/MonthlyLeaderboard'
import { Trophy, Medal, Target } from 'lucide-react'

const TABS = [
  { key: 'placements', label: 'Placements', icon: Trophy },
  { key: 'weekly',     label: 'Weekly',     icon: Medal  },
  { key: 'monthly',    label: 'Monthly',    icon: Target },
]

export default function LeaderboardPage() {
  const [tab, setTab] = useState('placements')

  return (
    <>
      <AdminHeader title="Leaderboards" breadcrumb="Overview" />
      <div className="page">
        <div className="tab-bar">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`tab-btn${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'placements' && <PlacementsLeaderboard />}
        {tab === 'weekly'     && <WeeklyLeaderboard />}
        {tab === 'monthly'    && <MonthlyLeaderboard />}
      </div>
    </>
  )
}
