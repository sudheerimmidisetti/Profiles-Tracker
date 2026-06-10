// frontend/student/src/components/platform-profiles/CodeforcesProfile.jsx
// Full Codeforces GitHub-style profile with 4 tabs:
//   Profile | Statistics | Contests | Topics
import { useState, useMemo } from 'react'
import RatingChart from '../RatingChart'
import ContestDetailPanel from '../ContestDetailPanel'

const TABS = ['Profile', 'Statistics', 'Contests', 'Topics']

// ── Rank color mapping ─────────────────────────────────────────────────────────
const RANK_COLORS = {
  'legendary grandmaster': '#000',
  'international grandmaster': '#ff0000',
  'grandmaster':              '#ff0000',
  'international master':     '#ff8c00',
  'master':                   '#ff8c00',
  'candidate master':         '#aa00aa',
  'expert':                   '#0000ff',
  'specialist':               '#03a89e',
  'pupil':                    '#008000',
  'newbie':                   '#808080',
  'unrated':                  '#606060',
}

function rankColor(rank = '') {
  const key = rank.toLowerCase()
  return RANK_COLORS[key] || '#808080'
}

const TIER_LABELS = [
  { label: '< 1200', key: 'solved_rating_under_1200', color: '#808080' },
  { label: '1200–1599', key: 'solved_rating_1200_1599', color: '#008000' },
  { label: '1600–1899', key: 'solved_rating_1600_1899', color: '#03a89e' },
  { label: '1900–2199', key: 'solved_rating_1900_2199', color: '#0000ff' },
  { label: '≥ 2200',   key: 'solved_rating_above_2200', color: '#ff8c00' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString()
}

function fmtDate(ts) {
  if (!ts) return '—'
  const d = new Date(Number(ts) * 1000)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function relTime(ts) {
  if (!ts) return ''
  const diff = (Date.now() / 1000 - Number(ts))
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  const d = Math.floor(diff / 86400)
  if (d < 30) return `${d}d ago`
  return fmtDate(ts)
}

function accountAge(ts) {
  if (!ts) return '—'
  const days = Math.floor((Date.now()/1000 - Number(ts)) / 86400)
  if (days < 365) return `${days} days`
  return `${(days/365).toFixed(1)} years`
}

function ratingToNextRank(rating) {
  const thresholds = [
    { at: 1200, name: 'Pupil'              },
    { at: 1400, name: 'Specialist'         },
    { at: 1600, name: 'Expert'             },
    { at: 1900, name: 'Candidate Master'   },
    { at: 2100, name: 'Master'             },
    { at: 2300, name: 'International Master' },
    { at: 2400, name: 'Grandmaster'        },
    { at: 2600, name: 'International Grandmaster' },
    { at: 3000, name: 'Legendary Grandmaster' },
  ]
  for (const t of thresholds) {
    if (rating < t.at) return { needed: t.at - rating, next: t.name }
  }
  return null
}

// ── Activity Heatmap ───────────────────────────────────────────────────────────
function Heatmap({ calendar }) {
  const data = useMemo(() => {
    if (!calendar) return {}
    return typeof calendar === 'string' ? JSON.parse(calendar) : calendar
  }, [calendar])

  const maxCount = useMemo(() =>
    Math.max(1, ...Object.values(data).map(Number)), [data])

  const weeks = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const start = new Date(today); start.setDate(start.getDate() - 363)
    start.setDate(start.getDate() - start.getDay())

    const allWeeks = []
    const cur = new Date(start)
    while (cur <= today) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const k = cur.toISOString().slice(0,10)
        week.push({ date: new Date(cur), count: data[k] || 0 })
        cur.setDate(cur.getDate() + 1)
      }
      allWeeks.push(week)
    }
    return allWeeks
  }, [data])

  const heat = (count) => {
    if (!count) return 0
    const p = count / maxCount
    if (p < .25) return 1
    if (p < .50) return 2
    if (p < .75) return 3
    return 4
  }

  return (
    <div className="lcp-heatmap">
      <div className="lcp-heatmap-inner">
        {weeks.map((week, wi) => (
          <div key={wi} className="lcp-heatmap-col">
            {week.map((day, di) => (
              <div key={di}
                className={`lcp-heatmap-cell heat-${heat(day.count)}`}
                title={`${day.date.toDateString()}: ${day.count} submission${day.count !== 1 ? 's' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Convert CF contest history rows to shared chart format ──────────────────
function cfToChartPoints(contests) {
  return [...(contests || [])]
    .filter(c => (c.new_rating ?? c.newRating) > 0 && c.timestamp_seconds)
    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
    .map(c => ({
      date:          c.timestamp_seconds * 1000,
      rating:        c.new_rating ?? c.newRating ?? 0,
      ratingBefore:  c.old_rating ?? c.oldRating ?? null,
      ratingChange:  c.rating_change ?? c.ratingChange ?? null,
      label:         c.contest_name ?? c.contestName ?? '',
      contestName:   c.contest_name ?? c.contestName ?? '',
      rank:          c.rank_achieved ?? c.rankAchieved ?? null,
      division:      c.division ?? null,
      problemsSolved: null,
      contestType:   null,
    }))
}


// ── Donut ──────────────────────────────────────────────────────────────────────
function TierDonut({ d }) {
  const tiers = TIER_LABELS.map(t => ({
    ...t,
    count: Number(d[t.key]) || 0
  }))
  const total = tiers.reduce((a, t) => a + t.count, 0)
  const R = 50, CX = 60, CY = 60, STROKE = 12
  const circumference = 2 * Math.PI * R

  let offset = 0
  return (
    <svg viewBox="0 0 120 120" width="120" height="120">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
      {tiers.map((t, i) => {
        if (t.count === 0) return null
        const len  = circumference * (t.count / Math.max(total, 1))
        const dash = `${len} ${circumference - len}`
        const off  = -circumference / 4 + offset
        offset += len
        return (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none"
            stroke={t.color} strokeWidth={STROKE}
            strokeDasharray={dash} strokeDashoffset={off}
            strokeLinecap="butt" />
        )
      })}
      <text x={CX} y={CY-6} textAnchor="middle" fill="var(--fg)" fontSize="16" fontWeight="700">{total}</text>
      <text x={CX} y={CY+10} textAnchor="middle" fill="var(--fg-muted)" fontSize="9">Solved</text>
    </svg>
  )
}

const LANG_COLORS = ['#1a8cff','#f89f1b','#22c55e','#a855f7','#ef4444','#06b6d4','#ec4899','#84cc16']

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CodeforcesProfile({ data, onBack }) {
  const [tab,              setTab]              = useState('Profile')
  const [selectedContest,  setSelectedContest]  = useState(null)
  const email = localStorage.getItem('email') || ''

  const { detail: d, contests } = data
  if (!d) return null

  // Parsed JSONB
  const langStats = useMemo(() => {
    if (!d.language_stats) return []
    const arr = typeof d.language_stats === 'string' ? JSON.parse(d.language_stats) : d.language_stats
    return arr.sort((a,b) => b.count - a.count).slice(0, 8)
  }, [d.language_stats])

  const tagStats = useMemo(() => {
    if (!d.tag_stats) return []
    const arr = typeof d.tag_stats === 'string' ? JSON.parse(d.tag_stats) : d.tag_stats
    return arr.sort((a,b) => b.count - a.count)
  }, [d.tag_stats])

  const recentAC = useMemo(() => {
    if (!d.recent_ac_submissions) return []
    return typeof d.recent_ac_submissions === 'string'
      ? JSON.parse(d.recent_ac_submissions) : d.recent_ac_submissions
  }, [d.recent_ac_submissions])

  const calData = useMemo(() => {
    if (!d.submission_calendar) return {}
    return typeof d.submission_calendar === 'string'
      ? JSON.parse(d.submission_calendar) : d.submission_calendar
  }, [d.submission_calendar])

  const totalSolvedFromTiers = TIER_LABELS.reduce((a, t) => a + (Number(d[t.key]) || 0), 0)
  const totalSolved = Number(d.total_solved) || totalSolvedFromTiers

  // Contest stats
  const sortedContests = useMemo(() =>
    [...(contests || [])].sort((a,b) => b.timestamp_seconds - a.timestamp_seconds),
    [contests]
  )
  // No pagination — show all

  const bestRank = useMemo(() =>
    Math.min(Infinity, ...(contests||[]).filter(c=>c.rank_achieved>0).map(c=>c.rank_achieved)) || 0,
    [contests]
  )
  const peakRating = useMemo(() =>
    Math.max(0, ...(contests||[]).map(c => c.new_rating || 0)),
    [contests]
  )
  const maxGain = useMemo(() => {
    const gains = (contests||[]).map(c => c.rating_change || 0).filter(x => x > 0)
    return gains.length ? Math.max(...gains) : 0
  }, [contests])

  const maxLang = langStats[0]?.count || 1
  const maxTag  = tagStats[0]?.count  || 1

  const nextRank = ratingToNextRank(Number(d.current_rating) || 0)

  const initials = [d.first_name, d.last_name]
    .filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0,2) ||
    (d.username || '?').slice(0,2).toUpperCase()

  const RANK_COLOR = rankColor(d.current_rank)

  return (
    <div className="lcp-root">
      {/* ── Top nav ── */}
      <div className="lcp-topbar">
        <button className="lcp-back" onClick={onBack}>←</button>
        <ul className="lcp-tabs" role="tablist">
          {TABS.map(t => (
            <li key={t}>
              <button role="tab" aria-selected={tab===t}
                className={`lcp-tab${tab===t?' active':''}`}
                onClick={() => setTab(t)}>{t}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── KPI strip ── */}
      <div className="lcp-kpis">
        {[
          { val: Math.round(d.current_rating) || '—', sub: 'Current Rating' },
          { val: Math.round(d.max_rating) || '—',     sub: 'Peak Rating' },
          { val: fmt(totalSolved),                    sub: 'Problems Solved' },
          { val: fmt(contests?.length),               sub: 'Rated Contests' },
          { val: bestRank ? `#${fmt(bestRank)}` : '—', sub: 'Best Rank' },
        ].map(k => (
          <div key={k.sub} className="lcp-kpi">
            <div className="lcp-kpi-val" style={{ color: k.sub === 'Current Rating' ? RANK_COLOR : undefined }}>
              {k.val}
            </div>
            <div className="lcp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ════ PROFILE TAB ════ */}
      {tab === 'Profile' && (
        <div className="lcp-body">
          <div className="lcp-profile-grid">
            {/* Left: avatar card */}
            <div className="lcp-avatar-card">
              {d.avatar_url
                ? <img src={d.avatar_url} alt={d.username} className="lcp-avatar" />
                : <div className="lcp-avatar-initials" style={{
                    background: `linear-gradient(135deg, ${RANK_COLOR}, #1a1a2e)`
                  }}>{initials}</div>
              }
              <p className="lcp-username">@{d.username}</p>
              {(d.first_name || d.last_name) && (
                <p className="lcp-realname">{[d.first_name, d.last_name].filter(Boolean).join(' ')}</p>
              )}

              {/* Rank badge */}
              <span className="lcp-badge-chip" style={{
                background: `${RANK_COLOR}18`,
                borderColor: `${RANK_COLOR}44`,
                color: RANK_COLOR
              }}>
                ★ {d.current_rank}
              </span>

              {nextRank && (
                <div style={{ width:'100%', padding:'8px 0' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--fg-muted)', marginBottom:4 }}>
                    {nextRank.needed} pts to {nextRank.next}
                  </div>
                  <div style={{ height:4, background:'var(--border)', borderRadius:2 }}>
                    <div style={{
                      height:'100%', borderRadius:2,
                      background: RANK_COLOR,
                      width: `${Math.max(5, 100 - (nextRank.needed / 200) * 100)}%`
                    }}/>
                  </div>
                </div>
              )}

              {d.organization && (
                <div className="lcp-meta-row">
                  <span className="lcp-meta-icon">🏢</span>
                  <span>{d.organization}</span>
                </div>
              )}
              {d.city && (
                <div className="lcp-meta-row">
                  <span className="lcp-meta-icon">📍</span>
                  <span>{[d.city, d.country].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {!d.city && d.country && (
                <div className="lcp-meta-row">
                  <span className="lcp-meta-icon">🌍</span>
                  <span>{d.country}</span>
                </div>
              )}

              {/* Quick stats */}
              <div style={{ width:'100%', marginTop:8 }}>
                <div className="lcp-stat-row">
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.contribution)}</div>
                    <div className="lcp-stat-box-label">Contribution</div>
                  </div>
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{accountAge(d.registration_seconds)}</div>
                    <div className="lcp-stat-box-label">Member For</div>
                  </div>
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.friend_of_count)}</div>
                    <div className="lcp-stat-box-label">Friend Of</div>
                  </div>
                </div>
              </div>

              {/* Max rank */}
              {d.max_rank && d.max_rank !== d.current_rank && (
                <div style={{ marginTop:8, fontSize:'0.78rem', color:'var(--fg-muted)' }}>
                  Peak rank: <strong style={{ color: rankColor(d.max_rank) }}>{d.max_rank}</strong>
                  {' '}({fmt(d.max_rating)})
                </div>
              )}

              {d.last_online_seconds && (
                <div style={{ marginTop:6, fontSize:'0.72rem', color:'var(--fg-muted)' }}>
                  Last online: {relTime(d.last_online_seconds)}
                </div>
              )}
            </div>

            {/* Right */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Difficulty breakdown */}
              <div className="lcp-card">
                <p className="lcp-card-title">Problem Difficulty Distribution</p>
                <div style={{ display:'flex', alignItems:'center', gap:24 }}>
                  <TierDonut d={d} />
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                    {TIER_LABELS.map(t => {
                      const count = Number(d[t.key]) || 0
                      return (
                        <div key={t.key} className="lcp-diff-row">
                          <span className="lcp-diff-label" style={{ color: t.color, width: 70 }}>
                            {t.label}
                          </span>
                          <div className="lcp-diff-bar-wrap">
                            <div className="lcp-diff-fill"
                              style={{
                                width: `${totalSolved > 0 ? (count/totalSolved)*100 : 0}%`,
                                background: t.color
                              }}/>
                          </div>
                          <span className="lcp-diff-count">{fmt(count)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Activity heatmap */}
              <div className="lcp-card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <p className="lcp-card-title" style={{ margin:0 }}>Submission Activity</p>
                  <span style={{ fontSize:'0.72rem', color:'var(--fg-muted)' }}>
                    {Object.keys(calData).length} active days
                  </span>
                </div>
                <Heatmap calendar={calData} />
              </div>

              {/* Recent AC */}
              {recentAC.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Recent Accepted</p>
                  <div className="lcp-sub-list">
                    {recentAC.slice(0,10).map((s, i) => (
                      <div key={i} className="lcp-sub-item">
                        <div className="lcp-sub-dot" />
                        <span className="lcp-sub-title">{s.problemName}</span>
                        {s.rating && (
                          <span style={{
                            fontSize:'0.72rem', fontWeight:600, padding:'2px 7px',
                            borderRadius:10, marginLeft:'auto', flexShrink:0,
                            background: `${RANK_COLOR}18`, color: RANK_COLOR
                          }}>{s.rating}</span>
                        )}
                        <span className="lcp-sub-time" style={{ marginLeft:8 }}>{relTime(s.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ STATISTICS TAB ════ */}
      {tab === 'Statistics' && (
        <div className="lcp-body">
          {/* Submission stats */}
          <div className="lcp-3col">
            {[
              { label: 'Total Submissions',  val: fmt(d.total_submissions) },
              { label: 'AC Submissions',     val: fmt(d.accepted_submissions) },
              { label: 'Acceptance Rate',    val: `${d.acceptance_rate ?? 0}%` },
              { label: 'Total Solved',       val: fmt(totalSolved) },
              { label: 'Highest Rated Prob', val: d.highest_rated_problem ? `${d.highest_rated_problem}★` : '—' },
              { label: 'Top Tag',            val: d.most_frequent_tag || '—' },
            ].map(s => (
              <div key={s.label} className="lcp-card" style={{ padding:'16px 18px' }}>
                <div style={{ fontSize:'1.2rem', fontWeight:700, color:'var(--fg)' }}>{s.val}</div>
                <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)', marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Difficulty distribution */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Solved by Difficulty</p>
              <div style={{ display:'flex', alignItems:'center', gap:24 }}>
                <TierDonut d={d} />
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                  {TIER_LABELS.map(t => {
                    const count = Number(d[t.key]) || 0
                    return (
                      <div key={t.key} className="lcp-diff-row">
                        <span className="lcp-diff-label" style={{ color: t.color, width: 80, fontSize:'0.7rem' }}>
                          {t.label}
                        </span>
                        <div className="lcp-diff-bar-wrap">
                          <div className="lcp-diff-fill" style={{
                            width: `${totalSolved>0?(count/totalSolved)*100:0}%`,
                            background: t.color
                          }}/>
                        </div>
                        <span className="lcp-diff-count">{fmt(count)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Rating chart */}
            <div className="lcp-card">
              <p className="lcp-card-title">Rating History</p>
              <RatingChart points={cfToChartPoints(contests)} platform="codeforces" height={280} />
              <div style={{ display:'flex', gap:20, marginTop:12, flexWrap:'wrap' }}>
                {[
                  { label:'Current',  val: Math.round(d.current_rating)||'—' },
                  { label:'Peak',     val: Math.round(d.max_rating)||'—' },
                  { label:'Best Gain',val: maxGain ? `+${maxGain}` : '—' },
                  { label:'Contests', val: contests?.length || 0 },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>{s.label}</div>
                    <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--fg)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Language + Activity */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Language Usage</p>
              {langStats.length > 0 ? (
                <div className="lcp-lang-list">
                  {langStats.map((l, i) => (
                    <div key={l.lang} className="lcp-lang-row">
                      <div className="lcp-lang-top">
                        <span className="lcp-lang-name">{l.lang}</span>
                        <span className="lcp-lang-count">{l.count} submissions</span>
                      </div>
                      <div className="lcp-lang-bar">
                        <div className="lcp-lang-fill" style={{
                          width:`${(l.count/maxLang)*100}%`,
                          background: LANG_COLORS[i % LANG_COLORS.length]
                        }}/>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No language data.</p>}
            </div>

            <div className="lcp-card">
              <p className="lcp-card-title">Submission Activity</p>
              <Heatmap calendar={calData} />
              <div style={{ display:'flex', gap:20, marginTop:12 }}>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Active Days</div>
                  <div style={{ fontSize:'1rem', fontWeight:700 }}>{Object.keys(calData).length}</div>
                </div>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Acceptance Rate</div>
                  <div style={{ fontSize:'1rem', fontWeight:700 }}>{d.acceptance_rate ?? 0}%</div>
                </div>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Member For</div>
                  <div style={{ fontSize:'1rem', fontWeight:700 }}>{accountAge(d.registration_seconds)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ CONTESTS TAB ════ */}
      {tab === 'Contests' && (
        <div className="lcp-body">
          {/* KPI strip */}
          <div className="lcp-kpis" style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
            {[
              { val: Math.round(d.current_rating)||'—', sub: 'Current Rating' },
              { val: Math.round(d.max_rating)||'—',     sub: 'Peak Rating' },
              { val: fmt(contests?.length),             sub: 'Total Contests' },
              { val: bestRank ? `#${fmt(bestRank)}` : '—', sub: 'Best Rank' },
            ].map(k => (
              <div key={k.sub} className="lcp-kpi">
                <div className="lcp-kpi-val">{k.val}</div>
                <div className="lcp-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Rating trend */}
          <div className="lcp-card">
            <p className="lcp-card-title">Rating Trend</p>
            <RatingChart points={cfToChartPoints(contests)} platform="codeforces" height={300} />
          </div>

          {/* Contest history table */}
          <div className="lcp-card">
            <p className="lcp-card-title">Contest History</p>
            {pageContests.length === 0
              ? <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No contest data yet.</p>
              : (
                <>
                  <div className="lcp-table-wrap">
                    <table className="lcp-table">
                      <thead>
                        <tr>
                          <th>Contest</th>
                          <th>Rank</th>
                          <th>Old Rating</th>
                          <th>Change</th>
                          <th>New Rating</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedContests.map((c, i) => {
                          const delta = c.rating_change || 0
                          const isUp  = delta >= 0
                          return (
                            <tr
                              key={i}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedContest(c)}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,140,255,0.06)'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}
                            >
                              <td>
                                <div style={{ fontWeight:500 }}>{c.contest_name}</div>
                                {c.division && (
                                  <span style={{
                                    fontSize:'0.68rem', background:'rgba(26,140,255,.12)',
                                    color:'#1a8cff', padding:'1px 7px', borderRadius:8
                                  }}>{c.division}</span>
                                )}
                              </td>
                              <td>#{fmt(c.rank_achieved)}</td>
                              <td>{fmt(c.old_rating)}</td>
                              <td>
                                <span className={`rating-pill ${isUp?'up':'down'}`}>
                                  {isUp?'+':''}{delta}
                                </span>
                              </td>
                              <td style={{ fontWeight:600 }}>{fmt(c.new_rating)}</td>
                              <td style={{ color:'var(--fg-muted)', fontSize:'0.75rem' }}>
                                {fmtDate(c.timestamp_seconds)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize:'0.72rem', color:'var(--fg-muted)', marginTop:8 }}>
                    {sortedContests.length} contest{sortedContests.length !== 1 ? 's' : ''} total
                    {' · '}<span style={{ color: '#1a8cff' }}>Click any row to view contest details</span>
                  </p>
                </>
              )
            }
          </div>
        </div>
      )}

      {/* ════ TOPICS TAB ════ */}
      {tab === 'Topics' && (
        <div className="lcp-body">
          <div className="lcp-2col">
            {/* Top tags */}
            <div className="lcp-card">
              <p className="lcp-card-title">Problems by Topic</p>
              {tagStats.length > 0 ? (
                <div className="lcp-lang-list">
                  {tagStats.slice(0, 20).map((t, i) => (
                    <div key={t.tag} className="lcp-lang-row">
                      <div className="lcp-lang-top">
                        <span className="lcp-lang-name">{t.tag}</span>
                        <span className="lcp-lang-count">{t.count} solved</span>
                      </div>
                      <div className="lcp-lang-bar">
                        <div className="lcp-lang-fill" style={{
                          width:`${(t.count/maxTag)*100}%`,
                          background: LANG_COLORS[i % LANG_COLORS.length]
                        }}/>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No topic data yet.</p>}
            </div>

            {/* Tag chips */}
            <div className="lcp-card">
              <p className="lcp-card-title">Skill Coverage</p>
              {tagStats.length > 0 ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {tagStats.slice(0, 30).map((t, i) => (
                    <div key={t.tag} style={{
                      display:'flex', alignItems:'center', gap:5,
                      padding:'5px 12px', borderRadius:20,
                      background: `${LANG_COLORS[i % LANG_COLORS.length]}18`,
                      border: `1px solid ${LANG_COLORS[i % LANG_COLORS.length]}44`,
                    }}>
                      <span style={{ fontSize:'0.78rem', fontWeight:600,
                        color: LANG_COLORS[i % LANG_COLORS.length] }}>{t.tag}</span>
                      <span style={{ fontSize:'0.68rem', color:'var(--fg-muted)',
                        background:'var(--border)', borderRadius:10, padding:'1px 5px' }}>{t.count}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No tag data yet.</p>}

              {/* Language breakdown in topics tab */}
              {langStats.length > 0 && (
                <>
                  <p className="lcp-card-title" style={{ marginTop:24 }}>Languages Used</p>
                  <div className="lcp-lang-list">
                    {langStats.slice(0,6).map((l,i) => (
                      <div key={l.lang} className="lcp-lang-row">
                        <div className="lcp-lang-top">
                          <span className="lcp-lang-name">{l.lang}</span>
                          <span className="lcp-lang-count">{l.count}</span>
                        </div>
                        <div className="lcp-lang-bar">
                          <div className="lcp-lang-fill" style={{
                            width:`${(l.count/maxLang)*100}%`,
                            background: LANG_COLORS[i % LANG_COLORS.length]
                          }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Difficulty breakdown */}
          <div className="lcp-card">
            <p className="lcp-card-title">Solved by Rating Tier</p>
            <div style={{ display:'flex', alignItems:'center', gap:32 }}>
              <TierDonut d={d} />
              <div style={{ flex:1 }}>
                <div className="lcp-diff-bars" style={{ gap:12 }}>
                  {TIER_LABELS.map(t => {
                    const count = Number(d[t.key]) || 0
                    return (
                      <div key={t.key} className="lcp-diff-row">
                        <span className="lcp-diff-label" style={{ color:t.color, width:80, fontSize:'0.72rem' }}>{t.label}</span>
                        <div className="lcp-diff-bar-wrap">
                          <div className="lcp-diff-fill" style={{
                            width:`${totalSolved>0?(count/totalSolved)*100:0}%`,
                            background: t.color
                          }}/>
                        </div>
                        <span className="lcp-diff-count">{fmt(count)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Contest detail panel */}
      {selectedContest && (
        <ContestDetailPanel
          contest={selectedContest}
          platform="codeforces"
          email={email}
          onClose={() => setSelectedContest(null)}
        />
      )}
    </div>
  )
}
