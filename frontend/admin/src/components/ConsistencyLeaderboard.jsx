import { useState, useEffect, useCallback } from 'react'
import { Flame, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { leaderboardAPI } from '../api/api'
import { useNavigate } from 'react-router-dom'

function Sparkline({ trend }) {
  if (!trend?.length) return null
  const max = Math.max(...trend), min = Math.min(...trend), range = max - min || 1
  return (
    <div className="sparkline">
      {trend.map((v, i) => (
        <div key={i} className="spark-bar" style={{ height: `${((v - min) / range) * 100}%` }} />
      ))}
    </div>
  )
}

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n'
  return <div className={`rank-badge ${cls}`}>{rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
}

const PLATFORMS = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', hackerrank: 'HackerRank' }

export default function ConsistencyLeaderboard() {
  const navigate = useNavigate()
  const [platform, setPlatform] = useState('leetcode')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    leaderboardAPI.get(platform, 'all', page, 20)
      .then(r => { setData(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [platform, page])

  useEffect(() => { load() }, [load])

  const pages = Math.ceil(total / 20)

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h3 className="card-title">Student Rankings</h3>
        <div className="pills">
          {Object.keys(PLATFORMS).map(p => (
            <button key={p} className={`pill${platform === p ? ' active' : ''}`}
              onClick={() => { setPlatform(p); setPage(1) }}>
              {p === 'leetcode' ? 'LC' : p === 'codeforces' ? 'CF' : p === 'codechef' ? 'CC' : 'HR'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /> Loading…</div>
      ) : data.length === 0 ? (
        <div className="empty-state"><p className="empty-desc">No verified students on this platform yet.</p></div>
      ) : (
        <>
          <div className="lb-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Dept</th>
                  <th className="right">Rating</th>
                  <th className="right">Solved</th>
                  <th className="right">Streak</th>
                  <th className="right">Score</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s, i) => {
                  const rank = (page - 1) * 20 + i + 1
                  const initials = s.full_name
                    ? s.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
                    : '?'
                  const score = s.consistency_score ?? Math.round((s.total_solved || 0) / 10)
                  return (
                    <tr key={s.email || i} style={{ opacity: s.is_blocklisted ? 0.5 : 1 }}>
                      <td><RankBadge rank={rank} /></td>
                      <td>
                        <div className="student-cell">
                          <div className="avatar">{initials}</div>
                          <div className="student-info">
                            <p className="sname">{s.full_name || 'Unknown'}</p>
                            <p className="shandle">@{s.username || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="dept-tag">{s.branch || '—'}</span></td>
                      <td className="right" style={{ fontWeight: 600 }}>
                        {s.contest_rating ? Math.round(s.contest_rating) : s.current_rating ?? '—'}
                      </td>
                      <td className="right">{s.total_solved ?? '—'}</td>
                      <td className="right">
                        <div className="streak-display" style={{ justifyContent: 'flex-end' }}>
                          <Flame size={12} style={{ color: 'var(--warning)' }} />
                          {s.streak ?? 0}
                        </div>
                      </td>
                      <td className="right">
                        <div className="score-bar-wrap" style={{ justifyContent: 'flex-end' }}>
                          <div className="score-bar">
                            <div className="score-bar-fill" style={{ width: `${Math.min(score, 100)}%` }} />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 28 }}>{score}</span>
                        </div>
                      </td>
                      <td className="right">
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => navigate(`/students/${encodeURIComponent(s.email)}`)}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <p className="pag-info">Showing {(page-1)*20+1}–{Math.min(page*20, total)} of {total.toLocaleString()}</p>
            <div className="pag-btns">
              <button className="pag-btn" disabled={page === 1} onClick={() => setPage(p => p-1)}><ChevronLeft size={15} /></button>
              <span className="pag-current">{page} / {pages || 1}</span>
              <button className="pag-btn" disabled={page >= pages} onClick={() => setPage(p => p+1)}><ChevronRight size={15} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
