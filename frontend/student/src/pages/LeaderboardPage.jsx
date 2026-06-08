import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Leaderboard from '../components/Leaderboard'

const PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank']

export default function LeaderboardPage() {
  const [params] = useSearchParams()
  const initPlatform = PLATFORMS.includes(params.get('p')) ? params.get('p') : 'leetcode'
  const [platform, setPlatform] = useState(initPlatform)

  return (
    <>
      <Header title="Leaderboard" breadcrumb="Overview" onPlatformChange={id => { if (id !== 'all') setPlatform(id) }} />
      <div className="page">
        <Leaderboard platform={platform} />
      </div>
    </>
  )
}
