// Leaderboard.jsx — Platform leaderboard with search + filters
import { useState, useEffect, useRef, useCallback } from 'react'
import { Flame, ExternalLink, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { leaderboardAPI } from '../api/api'

const PLATFORM_LABELS = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', hackerrank: 'HackerRank' }
const PLATFORM_URLS   = {
  leetcode:   u => `https://leetcode.com/u/${u}`,
  codeforces: u => `https://codeforces.com/profile/${u}`,
  codechef:   u => `https://www.codechef.com/users/${u}`,
  hackerrank: u => `https://www.hackerrank.com/profile/${u}`,
}
const FILTERS = ['all', 'contest', 'consistency', 'problems']

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n'
  return <div className={`rank-badge ${cls}`}>{rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
}

// Simple debounce hook
function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

export default function Leaderboard({ platform: initPlatform = 'leetcode' }) {
  const [platform, setPlatform] = useState(initPlatform)
  const [filter,   setFilter]   = useState('all')
  const [page,     setPage]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const searchRef = useRef(null)

  const debouncedSearch = useDebounce(search, 350)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [platform, filter, debouncedSearch])

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.get(platform, filter, page, 20, debouncedSearch)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load leaderboard'))
      .finally(() => setLoading(false))
  }, [platform, filter, page, debouncedSearch])

  const rows  = data?.data   || []
  const total = data?.total  || 0
  const pages = Math.ceil(total / 20)
  const start = (page - 1) * 20 + 1

  const clearSearch = useCallback(() => {
    setSearch('')
    searchRef.current?.focus()
  }, [])

  const hasFilters = search !== ''

  return (
    <div className="card">
      {/* Header row with search */}
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h3 className="card-title">Platform Leaderboard</h3>

        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280, display: 'flex', alignItems: 'center' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--fg-muted)', pointerEvents: 'none' }} />
          <input
            ref={searchRef}
            type="text"
            className="form-input"
            style={{ paddingLeft: 30, paddingRight: search ? 30 : 10, height: 34, width: '100%' }}
            placeholder="Search name, roll, handle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute', right: 8, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', padding: 2,
              }}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Platform + Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginLeft: 'auto' }}>
          <div className="pills">
            {Object.keys(PLATFORM_LABELS).map(p => (
              <button key={p} className={`pill${platform === p ? ' active' : ''}`} onClick={() => { setPlatform(p); setPage(1) }}>
                {p === 'leetcode' ? 'LC' : p === 'codeforces' ? 'CF' : p === 'codechef' ? 'CC' : 'HR'}
              </button>
            ))}
          </div>
          <div className="pills">
            {FILTERS.map(f => (
              <button key={f} className={`pill${filter === f ? ' active' : ''}`} onClick={() => { setFilter(f); setPage(1) }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result count + clear */}
      {!loading && (
        <div style={{ padding: '4px 16px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)' }}>
            {total.toLocaleString()} student{total !== 1 ? 's' : ''}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </span>
          {hasFilters && (
            <button
              onClick={clearSearch}
              style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <X size={10} /> Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /> Loading…</div>
      ) : error ? (
        <div className="empty-state"><p className="empty-desc" style={{ color: 'var(--danger)' }}>{error}</p></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">{debouncedSearch ? 'No matches found' : 'No data yet'}</p>
          <p className="empty-desc">
            {debouncedSearch ? `No students match "${debouncedSearch}". Try a different search.` : 'Students need to verify handles first.'}
          </p>
        </div>
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
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const rank     = start + i
                  const initials = s.full_name
                    ? s.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
                    : '?'
                  return (
                    <tr key={s.email || i}>
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
                        <a
                          href={s.username ? (PLATFORM_URLS[platform] || PLATFORM_URLS.leetcode)(s.username) : '#'}
                          target="_blank" rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm btn-icon"
                          title={`View on ${PLATFORM_LABELS[platform]}`}
                          style={{ display: 'inline-flex', alignItems: 'center' }}
                        >
                          <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <p className="pag-info">
              Showing {start}–{Math.min(start + 19, total)} of {total.toLocaleString()} students
            </p>
            <div className="pag-btns">
              <button className="pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="pag-current">{page} / {pages || 1}</span>
              <button className="pag-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
