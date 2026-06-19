// Admin ContestPage — same UI as student version but uses admin-auth API endpoints
import { useState, useEffect, useCallback } from 'react'
import { contestsAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import {
  Trophy, Clock, Users, ExternalLink, ChevronLeft,
  ChevronRight, X, TrendingUp, TrendingDown, Minus,
  Calendar, Code2, Zap, Search
} from 'lucide-react'

// ── Platform metadata ─────────────────────────────────────────────────────────
const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#f89f1b', dot: '#f89f1b', bg: 'rgba(248,159,27,.12)' },
  codeforces: { label: 'Codeforces', color: '#1a8cff', dot: '#1a8cff', bg: 'rgba(26,140,255,.12)' },
  codechef:   { label: 'CodeChef',   color: '#22c55e', dot: '#22c55e', bg: 'rgba(34,197,94,.12)'  },
}

function fmtDuration(mins) {
  if (!mins) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN',
    { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'
}
function timeUntil(iso) {
  if (!iso) return null
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return 'Started'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)
  if (days > 0)  return `In ${days}d ${hours}h`
  if (hours > 0) return `In ${hours}h ${mins}m`
  return `In ${mins}m`
}

function TrendIcon({ change }) {
  if (change > 0)  return <TrendingUp size={12} style={{ color: '#22c55e' }} />
  if (change < 0)  return <TrendingDown size={12} style={{ color: '#ef4444' }} />
  return <Minus size={12} style={{ color: 'var(--fg-muted)' }} />
}

// ── Contest Card ──────────────────────────────────────────────────────────────
function ContestCard({ contest, onClick }) {
  const p = PLAT[contest.platform] || PLAT.leetcode
  const isPast = contest.status === 'past'
  return (
    <div
      onClick={() => onClick(contest)}
      style={{
        borderRadius: 14, padding: 18,
        border: `1.5px solid var(--border)`,
        background: 'var(--surface)',
        cursor: 'pointer',
        transition: 'transform .15s, box-shadow .15s, border-color .15s',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
      className="contest-card-hover"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
          background: p.bg, color: p.color, letterSpacing: '.04em',
        }}>{p.label}</span>
        {isPast
          ? <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
              background: 'rgba(128,128,128,.1)', color: 'var(--fg-muted)' }}>Past</span>
          : <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
              background: 'rgba(34,197,94,.1)', color: '#22c55e' }}>{timeUntil(contest.startTime) || 'Soon'}</span>
        }
      </div>

      <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.35 }}>{contest.name}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          [<Calendar size={11} />, fmtDate(contest.startTime)],
          [<Clock size={11} />,    fmtTime(contest.startTime)],
          [<Zap size={11} />,      fmtDuration(contest.durationMin)],
        ].filter(([, v]) => v).map(([icon, val], i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
            {icon}{val}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6 }}>
        {isPast ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600, color: 'var(--fg-muted)' }}>
              <Users size={12} />{contest.participants} participant{contest.participants !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>View Results →</span>
          </>
        ) : (
          <a href={contest.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 13px', borderRadius: 8,
              background: 'rgba(34,197,94,.12)', color: '#22c55e',
              fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
            Register <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Results Modal ─────────────────────────────────────────────────────────────
function ResultsModal({ contest, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const p = PLAT[contest.platform] || PLAT.leetcode

  useEffect(() => {
    let cancelled = false
    contestsAPI.participants(contest.platform, contest.contestId)
      .then(r => { if (!cancelled) { setData(r.data.data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contest.contestId, contest.platform])

  const filtered = (data || []).filter(r =>
    !search ||
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.handle?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg, oklch(0.1 0 0))',
        border: '1px solid var(--border)', borderRadius: 18,
        width: '100%', maxWidth: 900, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.5)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px',
              borderRadius: 6, background: p.bg, color: p.color, marginBottom: 6, display: 'inline-block' }}>
              {p.label}
            </span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-.02em' }}>
              {contest.name}
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', margin: 0 }}>
              {fmtDate(contest.startTime)}
              {data && ` · ${data.length} cohort participant${data.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--fg-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', position: 'relative', flexShrink: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 38, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
          <input
            type="text" placeholder="Search by name, roll no, handle…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'var(--surface)', color: 'var(--fg)',
              fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 48, color: 'var(--fg-muted)' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <span>Loading participants…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 48, color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
              <Trophy size={36} style={{ opacity: .25 }} />
              <p>{data?.length === 0 ? 'No cohort students participated.' : 'No matches.'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {['#','Student','Handle','Global Rank','Solved','Rating After','Change'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.06em', color: 'var(--fg-muted)',
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, background: 'var(--bg, oklch(0.1 0 0))',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.email || i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{r.cohortRank}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{r.name || r.email}</div>
                      {r.rollNumber && <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>{r.rollNumber}</div>}
                      {r.branch    && <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>{r.branch}</div>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.78rem' }}>{r.handle || '—'}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {r.globalRank ? `#${r.globalRank.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {r.problemsSolved != null ? `${r.problemsSolved}${r.totalProblems ? `/${r.totalProblems}` : ''}` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {r.ratingAfter != null ? r.ratingAfter : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {r.ratingChange != null ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '0.78rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                          background: r.ratingChange >= 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                          color: r.ratingChange >= 0 ? '#22c55e' : '#ef4444',
                        }}>
                          <TrendIcon change={r.ratingChange} />
                          {r.ratingChange >= 0 ? '+' : ''}{r.ratingChange}
                        </span>
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

// ── Main Admin Contest Page ───────────────────────────────────────────────────
export default function AdminContestPage() {
  const [platform,   setPlatform]   = useState('all')
  const [weekOffset, setWeekOffset] = useState(0)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)

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
    if (contest.status === 'upcoming') window.open(contest.url, '_blank', 'noopener')
    else setSelected(contest)
  }

  const weekLabel = weekOffset === 0 ? 'This Week'
    : weekOffset === -1 ? 'Last Week'
    : `${Math.abs(weekOffset)} weeks ago`
  const { start, end } = data?.week || {}
  const weekRange = start && end ? `${fmtDate(start)} – ${fmtDate(end)}` : ''

  const sectionStyle = { marginBottom: 32 }
  const sectionHdr = (dot, label, count) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot,
        boxShadow: dot === '#22c55e' ? '0 0 6px rgba(34,197,94,.5)' : 'none' }} />
      <h2 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', margin: 0 }}>{label}</h2>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>{count}</span>
    </div>
  )

  return (
    <>
      <AdminHeader title="Contests" breadcrumb="Overview" />
      <div className="page">

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all','leetcode','codeforces','codechef'].map(p => (
            <button key={p}
              onClick={() => { setPlatform(p); setWeekOffset(0) }}
              style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${platform === p && p !== 'all' ? PLAT[p]?.color : platform === p ? 'var(--primary)' : 'var(--border)'}`,
                background: platform === p && p !== 'all' ? PLAT[p]?.bg : platform === p ? 'rgba(99,102,241,.1)' : 'var(--surface)',
                color: platform === p && p !== 'all' ? PLAT[p]?.color : platform === p ? 'var(--primary)' : 'var(--fg-muted)',
                fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all .15s',
              }}>
              {p === 'all' ? 'All Platforms' : PLAT[p]?.label || p}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <button onClick={() => setWeekOffset(w => w - 1)} disabled={weekOffset <= -12}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid var(--border)',
              background: 'var(--surface)', color: 'var(--fg-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: weekOffset <= -12 ? .3 : 1 }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ textAlign: 'center', minWidth: 130 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block' }}>{weekLabel}</span>
            {weekRange && <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', display: 'block' }}>{weekRange}</span>}
          </div>
          <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} disabled={weekOffset >= 0}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid var(--border)',
              background: 'var(--surface)', color: 'var(--fg-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: weekOffset >= 0 ? .3 : 1 }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div>
          {weekOffset === 0 && (
            <div style={sectionStyle}>
              {sectionHdr('#22c55e', 'Upcoming', data?.upcoming?.length ?? 0)}
              {!data?.upcoming?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 36, gap: 10,
                  color: 'var(--fg-muted)', fontSize: '0.85rem',
                  border: '1.5px dashed var(--border)', borderRadius: 14, textAlign: 'center' }}>
                  <Code2 size={28} style={{ opacity: .3 }} />
                  <p>No upcoming contests found.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                  {data.upcoming.map((c, i) => <ContestCard key={i} contest={c} onClick={handleCardClick} />)}
                </div>
              )}
            </div>
          )}

          <div style={sectionStyle}>
            {sectionHdr('var(--fg-muted)', 'Past', data?.past?.length ?? 0)}
            {!data?.past?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 36, gap: 10,
                color: 'var(--fg-muted)', fontSize: '0.85rem',
                border: '1.5px dashed var(--border)', borderRadius: 14, textAlign: 'center' }}>
                <Trophy size={28} style={{ opacity: .3 }} />
                <p>No past contests this week from cohort data.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {data.past.map((c, i) => <ContestCard key={i} contest={c} onClick={handleCardClick} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {selected && <ResultsModal contest={selected} onClose={() => setSelected(null)} />}
      </div>
    </>
  )
}
