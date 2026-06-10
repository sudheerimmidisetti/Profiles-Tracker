// frontend/student/src/components/platform-profiles/CodeChefProfile.jsx
// Full CodeChef GitHub-style profile — 4 tabs: Profile | Statistics | Contests | Badges
import { useState, useMemo } from 'react'
import RatingChart from '../RatingChart'
import ContestDetailPanel from '../ContestDetailPanel'

const TABS = ['Profile', 'Statistics', 'Contests', 'Badges']

// ── Star / rating metadata ────────────────────────────────────────────────────
const STAR_BANDS = [
  { min: 2500, stars: 7, label: '7★',   color: '#ff0000' },
  { min: 2200, stars: 6, label: '6★',   color: '#ff7f00' },
  { min: 2000, stars: 5, label: '5★',   color: '#9b59b6' },
  { min: 1800, stars: 4, label: '4★',   color: '#3498db' },
  { min: 1600, stars: 3, label: '3★',   color: '#1abc9c' },
  { min: 1400, stars: 2, label: '2★',   color: '#2ecc71' },
  { min:    1, stars: 1, label: '1★',   color: '#95a5a6' },
  { min:    0, stars: 0, label: 'Unrated', color: '#606060' },
]

function starInfo(rating) {
  const r = Number(rating) || 0
  for (const b of STAR_BANDS) {
    if (r >= b.min) return b
  }
  return STAR_BANDS[STAR_BANDS.length - 1]
}

function nextBand(rating) {
  const r = Number(rating) || 0
  for (let i = STAR_BANDS.length - 2; i >= 0; i--) {
    if (r < STAR_BANDS[i].min) {
      return { needed: STAR_BANDS[i].min - r, label: STAR_BANDS[i].label, min: STAR_BANDS[i].min }
    }
  }
  return null
}

// Badge tier icons (emoji fallbacks, since we may not have CDN urls)
const BADGE_TIER_EMOJI = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎', diamond: '💠' }
const BADGE_TIER_COLOR = {
  bronze:   '#cd7f32',
  silver:   '#c0c0c0',
  gold:     '#ffd700',
  platinum: '#e5e4e2',
  diamond:  '#b9f2ff',
}
const BADGE_TYPE_LABEL = {
  contest_contender: 'Contest Contender',
  problem_solver:    'Problem Solver',
  daily_streak:      'Daily Streak',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n) { return (!n && n !== 0) ? '—' : Number(n).toLocaleString() }

function fmtDate(str) {
  if (!str) return '—'
  // Use only YYYY-MM-DD to avoid UTC→local timezone shift adding +1 day
  const dateOnly = String(str).slice(0, 10)
  const d = new Date(dateOnly + 'T00:00:00')
  if (isNaN(d)) return str
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseJSON(val) {
  if (!val) return null
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return null } }
  return val
}

// ── Activity Heatmap (reused pattern) ─────────────────────────────────────────
function Heatmap({ heatMap }) {
  const data = useMemo(() => {
    const raw = parseJSON(heatMap) || []
    const map = {}
    if (Array.isArray(raw)) {
      raw.forEach(h => { if (h.date) map[h.date] = Number(h.count || h.submissionCount || 0) })
    } else {
      Object.entries(raw).forEach(([k, v]) => { map[k] = Number(v) })
    }
    return map
  }, [heatMap])

  const maxCount = useMemo(() => Math.max(1, ...Object.values(data).map(Number)), [data])

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

  const heat = count => {
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

// ── Convert CC contest history to shared chart format ─────────────────────────
function ccToChartPoints(contests) {
  // Parse only the date part to avoid UTC→local timezone shift
  // e.g. '2024-02-21 22:00:08' stored as UTC → Feb 22 IST → wrong.
  // By using just '2024-02-21' we get midnight local time → correct date.
  const dateOnly = str => {
    if (!str) return 0
    const d = String(str).slice(0, 10)  // 'YYYY-MM-DD'
    return new Date(d + 'T00:00:00').getTime()  // local midnight
  }

  const sorted = [...(contests || [])]
    .filter(c => c.rating_after_contest > 0 && c.contest_date)
    .sort((a, b) => dateOnly(a.contest_date) - dateOnly(b.contest_date))

  return sorted.map((c, idx) => {
    const ratingBefore = idx > 0 ? sorted[idx - 1].rating_after_contest : null
    const si = starInfo(c.rating_after_contest)
    return {
      date:          dateOnly(c.contest_date),
      rating:        c.rating_after_contest,
      ratingBefore,
      ratingChange:  c.rating_change ?? null,
      label:         c.contest_name ?? '',
      contestName:   c.contest_name ?? '',
      rank:          c.rank_achieved ?? null,
      division:      c.division ?? null,
      problemsSolved: c.problems_solved_count ?? null,
      contestType:   c.contest_type ?? null,
      stars:         si.stars,
    }
  })
}


// ── Star ring ─────────────────────────────────────────────────────────────────
function StarRing({ rating, starsLabel, starColor }) {
  const max = 2500
  const pct = Math.min(1, (Number(rating) || 0) / max)
  const R = 52, CX = 64, CY = 64, STROKE = 10
  const circumference = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 128 128" width="128" height="128">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={starColor} strokeWidth={STROKE}
        strokeDasharray={`${circumference * pct} ${circumference * (1 - pct)}`}
        strokeDashoffset={-circumference / 4}
        strokeLinecap="round" />
      <text x={CX} y={CY - 8} textAnchor="middle" fill={starColor} fontSize="20" fontWeight="800">
        {starsLabel}
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fill="var(--fg)" fontSize="15" fontWeight="700">
        {fmt(rating)}
      </text>
      <text x={CX} y={CY + 26} textAnchor="middle" fill="var(--fg-muted)" fontSize="9">
        Rating
      </text>
    </svg>
  )
}

const TYPE_COLORS = {
  'Starters':        '#f89f1b',
  'Cook-Off':        '#e74c3c',
  'Lunchtime':       '#2ecc71',
  'Long Challenge':  '#3498db',
  'SnackDown':       '#9b59b6',
  'FlashCook':       '#1abc9c',
  'Contest':         '#95a5a6',
}

const PAGE_SIZE = 10

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CodeChefProfile({ data, onBack }) {
  const [tab,             setTab]             = useState('Profile')
  const [selectedContest, setSelectedContest] = useState(null)
  const PAGE_SIZE = 10   // kept for the Contests tab preview in Statistics
  const email = localStorage.getItem('email') || ''

  const { detail: d, contests } = data
  if (!d) return null

  // Parsed JSONB
  const badges      = useMemo(() => parseJSON(d.badges)      || [], [d.badges])
  const heatMap     = d.heat_map
  const ratingGraph = useMemo(() => parseJSON(d.rating_graph) || [], [d.rating_graph])

  // Star info
  const si     = starInfo(d.current_rating)
  const nextStar = nextBand(d.current_rating)

  // Total solved
  const totalSolved = Number(d.total_solved) || 0

  // Contest stats derived
  const sortedContests = useMemo(() =>
    [...(contests || [])].sort((a, b) => {
      if (a.contest_date && b.contest_date) return new Date(b.contest_date) - new Date(a.contest_date)
      return 0
    }),
    [contests]
  )
  const pageCount    = Math.ceil(sortedContests.length / PAGE_SIZE)
  const pageContests = sortedContests.slice(0, PAGE_SIZE)   // just for Contests preview

  const maxRatingContest = useMemo(() =>
    Math.max(0, ...(contests||[]).map(c => c.rating_after_contest||0)), [contests])
  const bestRank    = Number(d.best_rank) || 0
  const contestsParticipated = Number(d.contests_participated) || (contests||[]).length
  const winRate     = Number(d.win_rate) || 0

  // Problem breakdown
  const starters = Number(d.starters_solved)  || 0
  const practice = Number(d.practice_solved)   || 0
  const peer     = Number(d.peer_solved)        || 0

  // Heatmap stats
  const heatParsed = useMemo(() => {
    const raw = parseJSON(heatMap) || []
    if (Array.isArray(raw)) {
      return raw.filter(h => h.date && (h.count || h.submissionCount))
    }
    return Object.entries(raw).map(([date, count]) => ({ date, count }))
  }, [heatMap])
  const activeDays  = heatParsed.filter(h => (h.count || h.submissionCount) > 0).length
  const totalSubsHM = heatParsed.reduce((a, h) => a + Number(h.count || h.submissionCount || 0), 0)

  const initials = ((d.display_name || d.username) || '?')
    .split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)

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
          { val: fmt(d.current_rating),             sub: 'Current Rating' },
          { val: fmt(d.highest_rating),              sub: 'Peak Rating' },
          { val: fmt(totalSolved),                   sub: 'Problems Solved' },
          { val: fmt(contestsParticipated),          sub: 'Rated Contests' },
          { val: bestRank ? `#${fmt(bestRank)}` : '—', sub: 'Best Rank' },
        ].map(k => (
          <div key={k.sub} className="lcp-kpi">
            <div className="lcp-kpi-val" style={{
              color: k.sub === 'Current Rating' ? si.color : undefined
            }}>{k.val}</div>
            <div className="lcp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ════ PROFILE TAB ════ */}
      {tab === 'Profile' && (
        <div className="lcp-body">
          <div className="lcp-profile-grid">
            {/* Avatar card */}
            <div className="lcp-avatar-card">
              {d.avatar_url
                ? <img src={d.avatar_url} alt={d.username} className="lcp-avatar" />
                : <div className="lcp-avatar-initials" style={{
                    background: `linear-gradient(135deg, ${si.color}, #1a1a2e)`
                  }}>{initials}</div>
              }
              <p className="lcp-username">@{d.username}</p>
              {d.display_name && d.display_name !== d.username && (
                <p className="lcp-realname">{d.display_name}</p>
              )}

              {/* Star badge */}
              <div style={{ margin: '8px 0' }}>
                <StarRing
                  rating={d.current_rating}
                  starsLabel={si.label}
                  starColor={si.color}
                />
              </div>

              {/* Progress to next star */}
              {nextStar && (
                <div style={{ width:'100%', padding:'4px 0 8px' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--fg-muted)', marginBottom:4 }}>
                    {nextStar.needed} pts to {nextStar.label}
                  </div>
                  <div style={{ height:4, background:'var(--border)', borderRadius:2 }}>
                    <div style={{
                      height:'100%', borderRadius:2, background: si.color,
                      width:`${Math.max(5, ((Number(d.current_rating)||0) - (nextStar.min - 200)) / 200 * 100)}%`
                    }}/>
                  </div>
                </div>
              )}

              {/* Division chip */}
              <span className="lcp-badge-chip" style={{
                background: `${si.color}18`, borderColor: `${si.color}44`, color: si.color
              }}>
                {d.current_division || 'Div 3'}
              </span>

              {d.institution && (
                <div className="lcp-meta-row"><span className="lcp-meta-icon">🏫</span>{d.institution}</div>
              )}
              {d.country && (
                <div className="lcp-meta-row"><span className="lcp-meta-icon">🌍</span>{d.country}</div>
              )}
              {d.student_or_pro && (
                <div className="lcp-meta-row"><span className="lcp-meta-icon">👤</span>{d.student_or_pro}</div>
              )}
              {d.is_pro_user && (
                <div className="lcp-meta-row" style={{ color:'#f89f1b' }}>
                  <span className="lcp-meta-icon">⭐</span>Pro User
                </div>
              )}

              {/* Quick stats */}
              <div style={{ width:'100%', marginTop:8 }}>
                <div className="lcp-stat-row">
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.global_rank)}</div>
                    <div className="lcp-stat-box-label">Global Rank</div>
                  </div>
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.country_rank)}</div>
                    <div className="lcp-stat-box-label">Country Rank</div>
                  </div>
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{winRate.toFixed(0)}%</div>
                    <div className="lcp-stat-box-label">Win Rate</div>
                  </div>
                </div>
              </div>

              {/* Peak rating note */}
              {d.highest_rating > d.current_rating && (
                <div style={{ marginTop:8, fontSize:'0.78rem', color:'var(--fg-muted)' }}>
                  Peak: <strong style={{ color: starInfo(d.highest_rating).color }}>
                    {starInfo(d.highest_rating).label}
                  </strong> ({fmt(d.highest_rating)})
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Problem breakdown */}
              <div className="lcp-card">
                <p className="lcp-card-title">Problems Solved</p>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
                  {[
                    { label:'Contest', val: starters, color:'#f89f1b' },
                    { label:'Practice', val: practice, color:'#2ecc71' },
                    { label:'Peer', val: peer, color:'#3498db' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex:1, minWidth:80, padding:'12px 16px', borderRadius:10,
                      background:`${s.color}12`, border:`1px solid ${s.color}33`,
                      textAlign:'center'
                    }}>
                      <div style={{ fontSize:'1.4rem', fontWeight:800, color:s.color }}>{fmt(s.val)}</div>
                      <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)', marginTop:3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Bar breakdown */}
                {totalSolved > 0 && (
                  <div className="lcp-diff-row">
                    <div style={{ width:'100%', height:8, borderRadius:4, background:'var(--border)', overflow:'hidden', display:'flex' }}>
                      {[
                        { val:starters, color:'#f89f1b' },
                        { val:practice, color:'#2ecc71' },
                        { val:peer,     color:'#3498db' },
                      ].map((s,i) => (
                        <div key={i} style={{
                          width:`${(s.val / totalSolved)*100}%`,
                          background: s.color, transition:'width .4s'
                        }}/>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* DSA Rating card */}
              {Number(d.dsa_rating) > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">DSA Rating</p>
                  <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#1a8cff' }}>
                        {fmt(d.dsa_rating)}
                      </div>
                      <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Current</div>
                    </div>
                    <div>
                      <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--fg)' }}>
                        {fmt(d.dsa_highest_rating)}
                      </div>
                      <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Peak</div>
                    </div>
                    {d.dsa_global_rank && (
                      <div>
                        <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--fg)' }}>
                          #{fmt(d.dsa_global_rank)}
                        </div>
                        <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Global Rank</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Activity heatmap */}
              <div className="lcp-card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <p className="lcp-card-title" style={{ margin:0 }}>Submission Activity</p>
                  <span style={{ fontSize:'0.72rem', color:'var(--fg-muted)' }}>
                    {activeDays} active days · {fmt(totalSubsHM)} submissions
                  </span>
                </div>
                <Heatmap heatMap={heatMap} />
              </div>

              {/* Recent contests preview */}
              {sortedContests.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Recent Contests</p>
                  <div className="lcp-sub-list">
                    {sortedContests.slice(0, 5).map((c, i) => {
                      const delta = c.rating_change || 0
                      const tColor = TYPE_COLORS[c.contest_type] || '#95a5a6'
                      return (
                        <div key={i} className="lcp-sub-item" style={{ alignItems:'center' }}>
                          <div className="lcp-sub-dot" style={{ background: tColor }} />
                          <span className="lcp-sub-title">{c.contest_name}</span>
                          {c.contest_type && (
                            <span style={{
                              fontSize:'0.68rem', padding:'1px 7px', borderRadius:8, marginLeft:6,
                              background:`${tColor}18`, color:tColor, flexShrink:0
                            }}>{c.contest_type}</span>
                          )}
                          <span className={`rating-pill ${delta >= 0 ? 'up' : 'down'}`} style={{ marginLeft:'auto' }}>
                            {delta >= 0 ? '+' : ''}{delta}
                          </span>
                        </div>
                      )
                    })}
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
          {/* 6-stat mini cards */}
          <div className="lcp-3col">
            {[
              { label:'Current Rating',   val: fmt(d.current_rating) },
              { label:'Peak Rating',      val: fmt(d.highest_rating) },
              { label:'Total Solved',     val: fmt(totalSolved) },
              { label:'Rated Contests',   val: fmt(contestsParticipated) },
              { label:'Best Rank',        val: bestRank ? `#${fmt(bestRank)}` : '—' },
              { label:'Win Rate',         val: `${winRate.toFixed(1)}%` },
            ].map(s => (
              <div key={s.label} className="lcp-card" style={{ padding:'16px 18px' }}>
                <div style={{ fontSize:'1.2rem', fontWeight:700, color:'var(--fg)' }}>{s.val}</div>
                <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)', marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="lcp-2col">
            {/* Problem breakdown */}
            <div className="lcp-card">
              <p className="lcp-card-title">Problems by Category</p>
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12 }}>
                <StarRing rating={d.current_rating} starsLabel={si.label} starColor={si.color} />
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { label:'Contest/Starters', val:starters, color:'#f89f1b' },
                    { label:'Practice',         val:practice, color:'#2ecc71' },
                    { label:'Peer',             val:peer,     color:'#3498db' },
                  ].map(s => (
                    <div key={s.label} className="lcp-diff-row">
                      <span className="lcp-diff-label" style={{ color:s.color, width:100, fontSize:'0.72rem' }}>
                        {s.label}
                      </span>
                      <div className="lcp-diff-bar-wrap">
                        <div className="lcp-diff-fill" style={{
                          width:`${totalSolved > 0 ? (s.val/totalSolved)*100 : 0}%`,
                          background:s.color
                        }}/>
                      </div>
                      <span className="lcp-diff-count">{fmt(s.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rating chart */}
            <div className="lcp-card">
              <p className="lcp-card-title">Rating History</p>
              <RatingChart points={ccToChartPoints(sortedContests)} platform="codechef" height={280} />
              <div style={{ display:'flex', gap:20, marginTop:12, flexWrap:'wrap' }}>
                {[
                  { label:'Current',  val: fmt(d.current_rating) },
                  { label:'Peak',     val: fmt(d.highest_rating) },
                  { label:'Contests', val: fmt(contestsParticipated) },
                  { label:'Win Rate', val: `${winRate.toFixed(1)}%` },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>{s.label}</div>
                    <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--fg)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Heatmap + DSA */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Submission Activity</p>
              <Heatmap heatMap={heatMap} />
              <div style={{ display:'flex', gap:20, marginTop:12 }}>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Active Days</div>
                  <div style={{ fontSize:'1rem', fontWeight:700 }}>{activeDays}</div>
                </div>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Submissions</div>
                  <div style={{ fontSize:'1rem', fontWeight:700 }}>{fmt(totalSubsHM)}</div>
                </div>
              </div>
            </div>
            <div className="lcp-card">
              <p className="lcp-card-title">DSA Track</p>
              {Number(d.dsa_rating) > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {[
                    { label:'DSA Rating',   val: fmt(d.dsa_rating),         color:'#1a8cff' },
                    { label:'DSA Peak',     val: fmt(d.dsa_highest_rating), color:'var(--fg)' },
                    { label:'Global Rank',  val: d.dsa_global_rank ? `#${fmt(d.dsa_global_rank)}` : '—', color:'var(--fg)' },
                    { label:'Country Rank', val: d.dsa_country_rank ? `#${fmt(d.dsa_country_rank)}` : '—', color:'var(--fg)' },
                  ].map(s => (
                    <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:'0.8rem', color:'var(--fg-muted)' }}>{s.label}</span>
                      <span style={{ fontSize:'1rem', fontWeight:700, color:s.color }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No DSA contest data yet.</p>
              )}
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
              { val: fmt(d.current_rating),    sub: 'Current Rating' },
              { val: fmt(d.highest_rating),    sub: 'Peak Rating' },
              { val: fmt(contestsParticipated), sub: 'Total Contests' },
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
            <RatingChart points={ccToChartPoints(sortedContests)} platform="codechef" height={300} />
          </div>

          {/* Contest table */}
          <div className="lcp-card">
            <p className="lcp-card-title">Contest History</p>
            {sortedContests.length === 0
              ? <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No contest data yet.</p>
              : (
                <>
                  <div className="lcp-table-wrap">
                    <table className="lcp-table">
                      <thead>
                        <tr>
                          <th>Contest</th>
                          <th>Rank</th>
                          <th>Change</th>
                          <th>New Rating</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedContests.map((c, i) => {
                          const delta   = c.rating_change || 0
                          const isUp    = delta >= 0
                          const tColor  = TYPE_COLORS[c.contest_type] || '#95a5a6'
                          return (
                            <tr
                              key={i}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedContest(c)}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,159,27,0.06)'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}
                            >
                              <td>
                                <div style={{ fontWeight:500 }}>{c.contest_name}</div>
                                {c.contest_type && (
                                  <span style={{
                                    fontSize:'0.68rem', background:`${tColor}18`,
                                    color:tColor, padding:'1px 7px', borderRadius:8
                                  }}>{c.contest_type}</span>
                                )}
                                {c.division && (
                                  <span style={{
                                    fontSize:'0.68rem', background:'rgba(26,140,255,.12)',
                                    color:'#1a8cff', padding:'1px 7px', borderRadius:8, marginLeft:4
                                  }}>{c.division}</span>
                                )}
                              </td>
                              <td>#{fmt(c.rank_achieved)}</td>
                              <td>
                                <span className={`rating-pill ${isUp?'up':'down'}`}>
                                  {isUp ? '+' : ''}{delta}
                                </span>
                              </td>
                              <td style={{ fontWeight:600 }}>{fmt(c.rating_after_contest)}</td>
                              <td style={{ color:'var(--fg-muted)', fontSize:'0.75rem' }}>
                                {fmtDate(c.contest_date)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize:'0.72rem', color:'var(--fg-muted)', marginTop:8 }}>
                    {sortedContests.length} contest{sortedContests.length !== 1 ? 's' : ''} total
                    {' · '}<span style={{ color: '#f89f1b' }}>Click any row to view contest details</span>
                  </p>
                </>
              )
            }
          </div>
        </div>
      )}

      {/* ════ BADGES TAB ════ */}
      {tab === 'Badges' && (
        <div className="lcp-body">
          {/* Star progression */}
          <div className="lcp-card">
            <p className="lcp-card-title">Star Rating Progression</p>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
              {STAR_BANDS.slice(0, -1).reverse().map(b => {
                const achieved = (Number(d.current_rating) || 0) >= b.min
                return (
                  <div key={b.label} style={{
                    padding:'8px 14px', borderRadius:10, textAlign:'center',
                    background: achieved ? `${b.color}18` : 'var(--border)',
                    border:`2px solid ${achieved ? b.color : 'transparent'}`,
                    opacity: achieved ? 1 : 0.5,
                    transition:'all .2s'
                  }}>
                    <div style={{ fontSize:'1.1rem', fontWeight:800, color:achieved ? b.color : 'var(--fg-muted)' }}>
                      {b.label}
                    </div>
                    <div style={{ fontSize:'0.65rem', color:'var(--fg-muted)', marginTop:2 }}>
                      {b.min === 1 ? '1–1399' : `${b.min}+`}
                    </div>
                  </div>
                )
              })}
            </div>
            {nextStar && (
              <div style={{ padding:'12px 16px', borderRadius:10, background:'var(--border)', marginTop:4 }}>
                <div style={{ fontSize:'0.78rem', color:'var(--fg-muted)', marginBottom:6 }}>
                  Progress to {nextStar.label}
                </div>
                <div style={{ height:8, background:'rgba(255,255,255,.08)', borderRadius:4 }}>
                  <div style={{
                    height:'100%', borderRadius:4, background:si.color,
                    width:`${Math.max(5, ((Number(d.current_rating)||0) % 200) / 200 * 100)}%`,
                    transition:'width .4s'
                  }}/>
                </div>
                <div style={{ fontSize:'0.72rem', color:'var(--fg-muted)', marginTop:6 }}>
                  {nextStar.needed} more rating points needed
                </div>
              </div>
            )}
          </div>

          {/* Earned badges */}
          <div className="lcp-card">
            <p className="lcp-card-title">Earned Badges</p>
            {badges.length > 0 ? (
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {badges.map((b, i) => {
                  const tierColor = BADGE_TIER_COLOR[b.tier] || '#888'
                  return (
                    <div key={i} style={{
                      display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                      padding:'16px 20px', borderRadius:14, textAlign:'center',
                      background:`${tierColor}12`,
                      border:`2px solid ${tierColor}44`,
                      minWidth:140,
                    }}>
                      <div style={{ fontSize:'2.4rem' }}>
                        {BADGE_TIER_EMOJI[b.tier] || '🏅'}
                      </div>
                      <div style={{ fontSize:'0.85rem', fontWeight:700, color:tierColor }}>
                        {b.tier ? b.tier.charAt(0).toUpperCase() + b.tier.slice(1) : ''}
                      </div>
                      <div style={{ fontSize:'0.75rem', color:'var(--fg)', fontWeight:600 }}>
                        {BADGE_TYPE_LABEL[b.type] || b.type || 'Badge'}
                      </div>
                      {b.description && (
                        <div style={{ fontSize:'0.68rem', color:'var(--fg-muted)', maxWidth:140 }}>
                          {b.description}
                        </div>
                      )}
                      {b.currentProgress > 0 && (
                        <div style={{
                          fontSize:'0.72rem', fontWeight:700, color:tierColor,
                          background:`${tierColor}22`, padding:'2px 10px', borderRadius:10
                        }}>
                          {fmt(b.currentProgress)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>
                No badge data available yet — will appear after next sync.
              </p>
            )}
          </div>

          {/* DSA + rank summary */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Rankings</p>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label:'Global Rank',        val: d.global_rank  ? `#${fmt(d.global_rank)}`  : '—', color:'#f89f1b' },
                  { label:'Country Rank',       val: d.country_rank ? `#${fmt(d.country_rank)}` : '—', color:'#2ecc71' },
                  { label:'DSA Global Rank',    val: d.dsa_global_rank  ? `#${fmt(d.dsa_global_rank)}`  : '—', color:'#1a8cff' },
                  { label:'DSA Country Rank',   val: d.dsa_country_rank ? `#${fmt(d.dsa_country_rank)}` : '—', color:'#1a8cff' },
                  { label:'Best Contest Rank',  val: bestRank ? `#${fmt(bestRank)}` : '—', color:'#a855f7' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'0.8rem', color:'var(--fg-muted)' }}>{s.label}</span>
                    <span style={{ fontSize:'1.05rem', fontWeight:700, color:s.color }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lcp-card">
              <p className="lcp-card-title">Activity Summary</p>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label:'Rated Contests',   val: fmt(contestsParticipated) },
                  { label:'Win Rate',         val: `${winRate.toFixed(1)}%` },
                  { label:'Active Days (HM)', val: fmt(activeDays) },
                  { label:'Total Solved',     val: fmt(totalSolved) },
                  { label:'Division',         val: d.current_division || '—' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'0.8rem', color:'var(--fg-muted)' }}>{s.label}</span>
                    <span style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--fg)' }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Contest detail panel */}
      {selectedContest && (
        <ContestDetailPanel
          contest={selectedContest}
          platform="codechef"
          email={email}
          onClose={() => setSelectedContest(null)}
        />
      )}
    </div>
  )
}
