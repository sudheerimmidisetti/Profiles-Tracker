import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { leaderboardAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import { Trophy, Medal, Target, TrendingUp, ChevronLeft, ChevronRight, Eye } from 'lucide-react'

// ── Shared rank badge ─────────────────────────────────────────────────────────
function RankBadge({ rank }) {
  if (rank === 1) return <span className="rank-badge rank-1">🥇</span>
  if (rank === 2) return <span className="rank-badge rank-2">🥈</span>
  if (rank === 3) return <span className="rank-badge rank-3">🥉</span>
  return <span className="rank-badge rank-n">{rank}</span>
}

function Pagination({ page, total, limit, onChange }) {
  const pages = Math.ceil(total / limit)
  if (pages <= 1) return null
  return (
    <div className="pagination">
      <button className="icon-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={15} />
      </button>
      <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
        Page {page} / {pages}
      </span>
      <button className="icon-btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ── Placements Leaderboard ────────────────────────────────────────────────────
function PlacementsLeaderboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    leaderboardAPI.placements(page, 20)
      .then(r => { setData(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={16} style={{ color: 'var(--warning)' }} />
          <span className="card-title">Placements Leaderboard</span>
          <span className="badge badge-gray" style={{ marginLeft: 4 }}>{total} students</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 4 }}>
          6-month composite score: ratings × problems × consistency
        </p>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-center" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : data.length === 0 ? (
          <div className="empty-state"><p>No data yet — run a sync first</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Branch</th>
                <th style={{ textAlign: 'right' }}>Score</th>
                <th style={{ textAlign: 'right' }}>CF Rating</th>
                <th style={{ textAlign: 'right' }}>CC Rating</th>
                <th style={{ textAlign: 'right' }}>Solved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.student_email}>
                  <td><RankBadge rank={(page - 1) * 20 + i + 1} /></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.full_name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{r.student_email}</div>
                  </td>
                  <td><span className="badge badge-gray">{r.branch || '—'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{Math.round(r.final_score ?? 0)}</span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--cf)' }}>{r.cf_rating || '—'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--cc)' }}>{r.cc_rating || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.total_solved ?? '—'}</td>
                  <td>
                    <button className="icon-btn" title="View profile"
                      onClick={() => navigate(`/students/${encodeURIComponent(r.student_email)}`)}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '12px 20px' }}>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}

// ── Weekly Contest Leaderboard ────────────────────────────────────────────────
function WeeklyLeaderboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    leaderboardAPI.weekly(page, 20)
      .then(r => { setData(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Medal size={16} style={{ color: 'var(--chart-1)' }} />
          <span className="card-title">Weekly Contest Leaderboard</span>
          <span className="badge badge-gray" style={{ marginLeft: 4 }}>{total} students</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 4 }}>
          This week's contest performance across platforms
        </p>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-center" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : data.length === 0 ? (
          <div className="empty-state"><p>No weekly data yet</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th style={{ textAlign: 'right' }}>Score</th>
                <th style={{ textAlign: 'right' }}>Contests</th>
                <th style={{ textAlign: 'right' }}>Best Rank</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.student_email}>
                  <td><RankBadge rank={(page - 1) * 20 + i + 1} /></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.full_name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{r.student_email}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: 'var(--chart-1)' }}>{Math.round(r.total_score ?? r.final_score ?? 0)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{r.contests_participated ?? r.contests_count ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.best_rank ?? '—'}</td>
                  <td>
                    <button className="icon-btn" title="View profile"
                      onClick={() => navigate(`/students/${encodeURIComponent(r.student_email)}`)}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '12px 20px' }}>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}

// ── Monthly Leaderboard ───────────────────────────────────────────────────────
function MonthlyLeaderboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    leaderboardAPI.monthly(page, 20)
      .then(r => { setData(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={16} style={{ color: 'var(--success)' }} />
          <span className="card-title">Monthly Leaderboard</span>
          <span className="badge badge-gray" style={{ marginLeft: 4 }}>{total} students</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 4 }}>
          Monthly blend: 40% contests + 60% practice problems
        </p>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-center" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : data.length === 0 ? (
          <div className="empty-state"><p>No monthly data yet</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th style={{ textAlign: 'right' }}>Score</th>
                <th style={{ textAlign: 'right' }}>Contest Pts</th>
                <th style={{ textAlign: 'right' }}>Practice Pts</th>
                <th style={{ textAlign: 'right' }}>Solved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.student_email}>
                  <td><RankBadge rank={(page - 1) * 20 + i + 1} /></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.full_name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{r.student_email}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{Math.round(r.final_score ?? 0)}</span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--cf)' }}>{Math.round(r.contest_score ?? 0)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--lc)' }}>{Math.round(r.practice_score ?? 0)}</td>
                  <td style={{ textAlign: 'right' }}>{r.problems_solved ?? '—'}</td>
                  <td>
                    <button className="icon-btn" title="View profile"
                      onClick={() => navigate(`/students/${encodeURIComponent(r.student_email)}`)}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '12px 20px' }}>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'placements', label: 'Placements', icon: Trophy },
  { key: 'weekly',     label: 'Weekly',     icon: Medal },
  { key: 'monthly',    label: 'Monthly',    icon: Target },
  { key: 'platform',   label: 'By Platform', icon: TrendingUp },
]

function PlatformLeaderboard() {
  const navigate = useNavigate()
  const [platform, setPlatform] = useState('leetcode')
  const [data,     setData]     = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)

  const PLATFORMS = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', hackerrank: 'HackerRank' }

  const load = useCallback(() => {
    setLoading(true)
    leaderboardAPI.get(platform, 'all', page, 20)
      .then(r => { setData(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [platform, page])

  useEffect(() => { load() }, [load])

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} style={{ color: 'var(--chart-1)' }} />
          <span className="card-title">Platform Leaderboard</span>
          <span className="badge badge-gray" style={{ marginLeft: 4 }}>{total} students</span>
        </div>
        <div className="filter-pills" style={{ marginTop: 12 }}>
          {Object.entries(PLATFORMS).map(([k, v]) => (
            <button key={k}
              className={`f-pill${platform === k ? ' active' : ''}`}
              onClick={() => { setPlatform(k); setPage(1) }}
            >{v}</button>
          ))}
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-center" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : data.length === 0 ? (
          <div className="empty-state"><p>No data for this platform</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Handle</th>
                <th style={{ textAlign: 'right' }}>Rating</th>
                <th style={{ textAlign: 'right' }}>Solved</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.email || r.student_email}>
                  <td><RankBadge rank={(page - 1) * 20 + i + 1} /></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.full_name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{r.email || r.student_email}</div>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>@{r.username || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: `var(--${platform === 'leetcode' ? 'lc' : platform === 'codeforces' ? 'cf' : platform === 'codechef' ? 'cc' : 'hr'})` }}>
                    {r.current_rating ? Math.round(r.current_rating) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>{r.total_solved ?? '—'}</td>
                  <td>
                    <button className="icon-btn" title="View profile"
                      onClick={() => navigate(`/students/${encodeURIComponent(r.email || r.student_email)}`)}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '12px 20px' }}>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState('placements')

  return (
    <>
      <AdminHeader title="Leaderboards" breadcrumb="Overview" />
      <div className="page">
        {/* Tab navigation */}
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
        {tab === 'platform'   && <PlatformLeaderboard />}
      </div>
    </>
  )
}
