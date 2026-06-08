import { useState } from 'react'
import AdminHeader from '../components/AdminHeader'
import ConsistencyLeaderboard from '../components/ConsistencyLeaderboard'

export default function LeaderboardPage() {
  return (
    <>
      <AdminHeader title="Leaderboard" breadcrumb="Overview" />
      <div className="page">
        <ConsistencyLeaderboard />
      </div>
    </>
  )
}
