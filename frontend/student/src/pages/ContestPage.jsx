import { useState, useEffect, useCallback } from 'react'
import { contestsAPI } from '../api/api'
import Header from '../components/Header'
import {
  Clock, Users, ExternalLink,
  X, TrendingUp, TrendingDown, Minus,
  Calendar, Code2, Zap, Search, Trophy, ChevronDown
} from 'lucide-react'
import lcLogo from '../assets/leetcode.svg'
import cfLogo from '../assets/codeforces.svg'
import ccLogo from '../assets/codechef.svg'
import './ContestPage.css'

// ── Platform metadata ─────────────────────────────────────────────────────────
const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#f89f1b', bg: 'rgba(248,159,27,.12)', logo: lcLogo },
  codeforces: { label: 'Codeforces', color: '#1a8cff', bg: 'rgba(26,140,255,.12)', logo: cfLogo },
  codechef:   { label: 'CodeChef',   color: '#22c55e', bg: 'rgba(34,197,94,.12)',  logo: ccLogo },
}

// ── Format duration ───────────────────────────────────────────────────────────
function fmtDuration(mins) {
  if (!mins) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}

// ── Format date ───────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'
}

// ── Time until contest ────────────────────────────────────────────────────────
function timeUntil(iso) {
  if (!iso) return null
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return 'Started'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `In ${days}d ${hours}h`
  if (hours > 0) return `In ${hours}h ${mins}m`
  return `In ${mins}m`
}

// ── Trend icon ────────────────────────────────────────────────────────────────
function TrendIcon({ change, trend }) {
  const val = change ?? 0
  const up = val > 0 || trend === 'UP'
  const dn = val < 0 || trend === 'DOWN'
  if (up) return <TrendingUp size={12} style={{ color: '#22c55e' }} />
  if (dn) return <TrendingDown size={12} style={{ color: '#ef4444' }} />
  return <Minus size={12} style={{ color: 'var(--fg-muted)' }} />
}

// ── Contest Card ──────────────────────────────────────────────────────────────
function ContestCard({ contest, onClick }) {
  const p = PLAT[contest.platform] || PLAT.leetcode
  const isPast = contest.status === 'past'
  const dateStr = fmtDate(contest.startTime)
  const timeStr = fmtTime(contest.startTime)
  const until   = !isPast ? timeUntil(contest.startTime) : null
  const dur     = fmtDuration(contest.durationMin)

  return (
    <div className={`contest-card ${isPast ? 'contest-card-past' : 'contest-card-upcoming'}`}
      onClick={() => onClick(contest)}
    >
      <div className="cc-platform-row">
        <span className="cc-plat-badge" style={{ background: p.bg, color: p.color }}>
          {p.logo && <img src={p.logo} alt={p.label} className="cc-plat-logo" />}
          {p.label}
        </span>
        {isPast
          ? <span className="cc-status-past">Past</span>
          : <span className="cc-status-upcoming">{until || 'Soon'}</span>
        }
      </div>

      <div className="cc-name">{contest.name}</div>

      <div className="cc-meta">
        <span className="cc-meta-item">
          <Calendar size={11} />
          {dateStr}
        </span>
        {timeStr && (
          <span className="cc-meta-item">
            <Clock size={11} />
            {timeStr}
          </span>
        )}
        {dur && (
          <span className="cc-meta-item">
            <Zap size={11} />
            {dur}
          </span>
        )}
      </div>

      {isPast ? (
        <div className="cc-footer">
          <span className="cc-participants">
            <Users size={12} />
            {contest.participants} participant{contest.participants !== 1 ? 's' : ''}
          </span>
          <span className="cc-action">View Results →</span>
        </div>
      ) : (
        <div className="cc-footer">
          <a
            href={contest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="cc-register-btn"
            onClick={e => e.stopPropagation()}
          >
            Register <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  )
}

// ── Results Modal ─────────────────────────────────────────────────────────────
function ResultsModal({ contest, onClose, fetchParticipants }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const p = PLAT[contest.platform] || PLAT.leetcode

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchParticipants(contest.platform, contest.contestId)
      .then(rows => { if (!cancelled) { setData(rows); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contest.contestId, contest.platform, fetchParticipants])

  const filtered = data
    ? data.filter(r =>
        !search ||
        r.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
        r.handle?.toLowerCase().includes(search.toLowerCase())
      )
    : []

  return (
    <div className="results-overlay" onClick={onClose}>
      <div className="results-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="rm-header">
          <div>
            <span className="rm-platform-badge" style={{ background: p.bg, color: p.color }}>
              {p.label}
            </span>
            <h2 className="rm-title">{contest.name}</h2>
            <p className="rm-sub">
              {fmtDate(contest.startTime)}
              {data && ` · ${data.length} cohort participant${data.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="rm-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Search */}
        <div className="rm-search-wrap">
          <Search size={14} className="rm-search-icon" />
          <input
            type="text"
            placeholder="Search by name, roll no, handle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rm-search"
          />
        </div>

        {/* Table */}
        <div className="rm-body">
          {loading ? (
            <div className="rm-loading">
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <span>Loading participants…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rm-empty">
              <Trophy size={36} style={{ opacity: .25 }} />
              <p>{data?.length === 0 ? 'No cohort students participated in this contest.' : 'No results match your search.'}</p>
            </div>
          ) : (
            <table className="rm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Handle</th>
                  <th>Global Rank</th>
                  <th>Solved</th>
                  <th>Rating</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.email || i} className={i % 2 === 0 ? 'rm-row-even' : ''}>
                    <td className="rm-col-rank">{r.cohortRank}</td>
                    <td>
                      <div className="rm-name">{r.name || r.email}</div>
                      {r.rollNumber && <div className="rm-roll">{r.rollNumber}</div>}
                      {r.branch    && <div className="rm-branch">{r.branch}</div>}
                    </td>
                    <td>
                      {r.handle ? (
                        <a
                          href={contest.url?.replace(/\/[^/]*$/, `/${r.handle}`) || '#'}
                          target="_blank" rel="noopener noreferrer"
                          className="rm-handle"
                        >
                          {r.handle}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="rm-col-num">
                      {r.globalRank ? `#${r.globalRank.toLocaleString()}` : '—'}
                    </td>
                    <td className="rm-col-num">
                      {r.problemsSolved != null
                        ? `${r.problemsSolved}${r.totalProblems ? `/${r.totalProblems}` : ''}`
                        : '—'}
                    </td>
                    <td className="rm-col-num">
                      {r.ratingAfter != null ? r.ratingAfter : '—'}
                    </td>
                    <td>
                      {r.ratingChange != null ? (
                        <span className={`rm-change ${r.ratingChange >= 0 ? 'rm-up' : 'rm-dn'}`}>
                          <TrendIcon change={r.ratingChange} trend={r.trend} />
                          {r.ratingChange >= 0 ? '+' : ''}{r.ratingChange}
                        </span>
                      ) : r.ratingAfter != null ? (
                        <span style={{ color: 'var(--fg-muted)', fontSize: '0.78rem' }}>—</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ContestPage({ isAdmin = false }) {
  const [platform,   setPlatform]   = useState('all')
  const [weekOffset, setWeekOffset] = useState(0)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null) // contest for results modal

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await contestsAPI.list(platform, weekOffset)
      setData(r.data.data)
    } catch { setData({ upcoming: [], past: [] }) }
    finally { setLoading(false) }
  }, [platform, weekOffset])

  useEffect(() => { load() }, [load])

  const handleCardClick = (contest) => {
    if (contest.status === 'upcoming') {
      window.open(contest.url, '_blank', 'noopener')
    } else {
      setSelected(contest)
    }
  }

  const fetchParticipants = useCallback(async (plt, cid) => {
    const r = await contestsAPI.participants(plt, cid)
    return r.data.data
  }, [])

  // Week label
  const weekLabel = weekOffset === 0 ? 'This Week'
    : weekOffset === -1 ? 'Last Week'
    : `${Math.abs(weekOffset)} weeks ago`

  const { start, end } = data?.week || {}
  const weekRange = start && end
    ? `${fmtDate(start)} – ${fmtDate(end)}`
    : ''

  return (
    <>
      <Header title="Contests" breadcrumb="Overview" />
      <div className="page">

      {/* Filters */}
      <div className="contest-filters">
        {/* Platform filter */}
        <div className="cf-platform-tabs">
          {['all', 'leetcode', 'codeforces', 'codechef'].map(p => (
            <button
              key={p}
              className={`cf-tab ${platform === p ? 'cf-tab-active' : ''}`}
              onClick={() => { setPlatform(p); setWeekOffset(0) }}
              style={platform === p && p !== 'all'
                ? { borderColor: PLAT[p]?.color, color: PLAT[p]?.color,
                    background: PLAT[p]?.bg }
                : {}}
            >
              {p === 'all' ? 'All Platforms' : PLAT[p]?.label || p}
            </button>
          ))}
        </div>

        {/* Week dropdown */}
        <div className="cf-week-nav">
          <ChevronDown size={13} className="cf-week-chevron" />
          <select
            className="cf-week-select"
            value={weekOffset}
            onChange={e => setWeekOffset(Number(e.target.value))}
          >
            <option value={0}>This Week</option>
            <option value={-1}>Last Week</option>
            {Array.from({ length: 10 }, (_, i) => i + 2).map(n => (
              <option key={n} value={-n}>{n} weeks ago</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div>
          {/* Upcoming contests */}
          {weekOffset === 0 && (
            <section className="contest-section">
              <div className="cs-header">
                <div className="cs-dot upcoming-dot" />
                <h2 className="cs-title">Upcoming</h2>
                <span className="cs-count">{data?.upcoming?.length ?? 0}</span>
              </div>
              {data?.upcoming?.length === 0 ? (
                <div className="cs-empty">
                  <Code2 size={28} style={{ opacity: .3 }} />
                  <p>No upcoming contests found.</p>
                </div>
              ) : (
                <div className="contest-grid">
                  {data.upcoming.map((c, i) => (
                    <ContestCard key={`${c.platform}-${c.contestId}-${i}`} contest={c} onClick={handleCardClick} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Past contests */}
          <section className="contest-section">
            <div className="cs-header">
              <div className="cs-dot past-dot" />
              <h2 className="cs-title">Past</h2>
              <span className="cs-count">{data?.past?.length ?? 0}</span>
            </div>
            {data?.past?.length === 0 ? (
              <div className="cs-empty">
                <Trophy size={28} style={{ opacity: .3 }} />
                <p>No past contests in this week from your cohort's data.</p>
              </div>
            ) : (
              <div className="contest-grid">
                {data.past.map((c, i) => (
                  <ContestCard key={`${c.platform}-${c.contestId}-${i}`} contest={c} onClick={handleCardClick} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Results Modal */}
      {selected && (
        <ResultsModal
          contest={selected}
          onClose={() => setSelected(null)}
          fetchParticipants={fetchParticipants}
        />
      )}
      </div>
    </>
  )
}
