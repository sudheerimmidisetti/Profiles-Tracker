// frontend/student/src/components/platform-profiles/LeetCodeProfile.jsx
// Full LeetCode GitHub-style profile with 5 tabs:
//   Profile | Statistics | Contests | Badges | Topics
import { useState, useMemo } from 'react'
import RatingChart from '../RatingChart'
import ContestDetailPanel from '../ContestDetailPanel'
import ActivityHeatmap from '../ActivityHeatmap'

const TABS = ['Profile', 'Statistics', 'Contests', 'Badges', 'Topics']

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString()
}

function relativeTime(ts) {
  if (!ts) return ''
  const d = typeof ts === 'string' ? new Date(ts) : new Date(Number(ts) * 1000)
  const diff = (Date.now() - d) / 1000
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(sec) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`
}

// Heatmap now uses shared ActivityHeatmap component (imported above)

// ── Convert LC contest history to shared chart format ─────────────────────────
function lcToChartPoints(contests) {
  return [...(contests || [])]
    .filter(c => c.rating_after_contest > 0 && c.contest_time)
    .sort((a, b) => a.contest_time - b.contest_time)
    .map((c, idx, arr) => {
      const ratingBefore = idx > 0 ? arr[idx - 1].rating_after_contest : null
      return {
        date:          c.contest_time * 1000,
        rating:        c.rating_after_contest,
        ratingBefore,
        ratingChange:  ratingBefore != null ? c.rating_after_contest - ratingBefore : null,
        label:         c.contest_title ?? '',
        contestName:   c.contest_title ?? '',
        rank:          c.rank_achieved ?? null,
        division:      null,
        problemsSolved: c.problems_solved != null
          ? `${c.problems_solved}${c.total_problems ? ' / ' + c.total_problems : ''}`
          : null,
        contestType:   null,
        finishTime:    c.finish_time_seconds ? fmtTime(c.finish_time_seconds) : null,
        totalFinished: null,
      }
    })
}

// ── Problem Donut ─────────────────────────────────────────────────────────────
function ProblemDonut({ easy, medium, hard, total }) {
  const R = 50, CX = 60, CY = 60, STROKE = 12
  const circumference = 2 * Math.PI * R
  const easyPct  = total > 0 ? easy  / total : 0
  const medPct   = total > 0 ? medium / total : 0
  const hardPct  = total > 0 ? hard  / total : 0

  const easyLen  = circumference * easyPct
  const medLen   = circumference * medPct
  const hardLen  = circumference * hardPct

  let offset = 0
  const segs = [
    { color: '#22c55e', len: easyLen  },
    { color: '#f89f1b', len: medLen   },
    { color: '#ef4444', len: hardLen  },
  ]

  return (
    <svg viewBox="0 0 120 120" width="120" height="120">
      {/* Background circle */}
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke="var(--border)" strokeWidth={STROKE} />
      {segs.map((s, i) => {
        const dash = `${s.len} ${circumference - s.len}`
        const off  = -circumference / 4 + offset
        offset += s.len
        if (s.len === 0) return null
        return (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none"
            stroke={s.color} strokeWidth={STROKE}
            strokeDasharray={dash} strokeDashoffset={off}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        )
      })}
      {/* Center text */}
      <text x={CX} y={CY - 6} textAnchor="middle"
        fill="var(--fg)" fontSize="16" fontWeight="700">{total}</text>
      <text x={CX} y={CY + 10} textAnchor="middle"
        fill="var(--fg-muted)" fontSize="9">Solved</text>
    </svg>
  )
}

// ── Language Bar colors (deterministic by index) ──────────────────────────────
const LANG_COLORS = ['#f89f1b','#1a8cff','#22c55e','#a855f7','#ef4444','#06b6d4','#ec4899','#84cc16']

// ── Badge emoji fallbacks ─────────────────────────────────────────────────────
function BadgeIcon({ icon, name, size = 40 }) {
  if (icon) {
    return <img src={icon} alt={name} style={{ width: size, height: size, objectFit: 'contain' }}
      onError={e => { e.target.style.display = 'none' }} />
  }
  const icons = { Guardian: '🏅', Knight: '⚔️', 'Annual Badge': '🏆', '100 Day Streak': '🔥', default: '🎖️' }
  const match = Object.keys(icons).find(k => name?.includes(k)) || 'default'
  return <span style={{ fontSize: size * 0.7 }}>{icons[match]}</span>
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LeetCodeProfile({ data, onBack }) {
  const [tab,             setTab]             = useState('Profile')
  const [selectedContest, setSelectedContest] = useState(null)
  const email = localStorage.getItem('email') || ''

  const { detail, contests } = data
  const d = detail || {}

  // Parsed JSONB
  const langStats    = useMemo(() => {
    if (!d.language_stats) return []
    const arr = typeof d.language_stats === 'string' ? JSON.parse(d.language_stats) : d.language_stats
    return [...arr].sort((a,b) => b.problemsSolved - a.problemsSolved).slice(0, 8)
  }, [d.language_stats])

  const skillTags = useMemo(() => {
    if (!d.skill_tags) return { advanced: [], intermediate: [], fundamental: [] }
    return typeof d.skill_tags === 'string' ? JSON.parse(d.skill_tags) : d.skill_tags
  }, [d.skill_tags])

  const badges = useMemo(() => {
    if (!d.badges) return []
    return typeof d.badges === 'string' ? JSON.parse(d.badges) : d.badges
  }, [d.badges])

  const upcomingBadges = useMemo(() => {
    if (!d.upcoming_badges) return []
    return typeof d.upcoming_badges === 'string' ? JSON.parse(d.upcoming_badges) : d.upcoming_badges
  }, [d.upcoming_badges])

  const activeBadge = useMemo(() => {
    if (!d.active_badge) return null
    return typeof d.active_badge === 'string' ? JSON.parse(d.active_badge) : d.active_badge
  }, [d.active_badge])

  const recentAc = useMemo(() => {
    if (!d.recent_ac_submissions) return []
    return typeof d.recent_ac_submissions === 'string'
      ? JSON.parse(d.recent_ac_submissions) : d.recent_ac_submissions
  }, [d.recent_ac_submissions])

  const maxLang = langStats[0]?.problemsSolved || 1

  // Sorted contests for table pagination
  const sortedContests = useMemo(() =>
    [...(contests || [])].sort((a, b) => b.contest_time - a.contest_time),
    [contests]
  )
  // No pagination — show all

  // Top skill cards (top 6 by solved count)
  const topSkills = useMemo(() => [
    ...skillTags.advanced,
    ...skillTags.intermediate,
    ...skillTags.fundamental,
  ].sort((a,b) => b.problemsSolved - a.problemsSolved).slice(0, 6), [skillTags])

  const initials = d.real_name
    ? d.real_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
    : (d.username || '?').slice(0,2).toUpperCase()

  const peakRating = useMemo(() =>
    Math.round(Math.max(0, ...(contests||[]).map(c => c.rating_after_contest || 0))),
    [contests]
  )
  const avgRank = useMemo(() => {
    const ranks = (contests||[]).filter(c=>c.rank_achieved>0).map(c=>c.rank_achieved)
    return ranks.length ? Math.round(ranks.reduce((a,b)=>a+b,0)/ranks.length) : 0
  }, [contests])
  const bestRank = useMemo(() =>
    Math.min(Infinity, ...(contests||[]).filter(c=>c.rank_achieved>0).map(c=>c.rank_achieved)) || 0,
    [contests]
  )

  return (
    <div className="lcp-root">
      {/* ── Top navigation bar ── */}
      <div className="lcp-topbar">
        <button className="lcp-back" onClick={onBack} aria-label="Go back">←</button>
        <ul className="lcp-tabs" role="tablist">
          {TABS.map(t => (
            <li key={t}>
              <button
                role="tab"
                aria-selected={tab === t}
                className={`lcp-tab${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >{t}</button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── KPI strip ── */}
      <div className="lcp-kpis">
        {[
          { val: fmt(d.total_solved),          sub: 'Total Solved',     pct: null },
          { val: fmt(d.acceptance_rate) + '%', sub: 'Acceptance Rate',  pct: Number(d.acceptance_rate) },
          { val: fmt(d.contest_rating),         sub: 'Contest Rating',   pct: null },
          { val: d.global_ranking ? `#${fmt(d.global_ranking)}` : '—', sub: 'Global Rank', pct: null },
          { val: `${d.streak ?? 0} Days`,       sub: 'Current Streak',  pct: null },
        ].map(k => (
          <div key={k.sub} className="lcp-kpi">
            <div className="lcp-kpi-val">{k.val}</div>
            <div className="lcp-kpi-sub">{k.sub}</div>
            {k.pct !== null && (
              <div className="lcp-kpi-bar">
                <div className="lcp-kpi-fill" style={{ width: `${Math.min(k.pct, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ════════════════════ PROFILE TAB ════════════════════ */}
      {tab === 'Profile' && (
        <div className="lcp-body">
          <div className="lcp-profile-grid">
            {/* Left: avatar card */}
            <div className="lcp-avatar-card">
              {d.avatar_url
                ? <img src={d.avatar_url} alt={d.username} className="lcp-avatar" />
                : <div className="lcp-avatar-initials">{initials}</div>
              }
              <p className="lcp-username">@{d.username}</p>
              {d.real_name && <p className="lcp-realname">{d.real_name}</p>}

              {d.contest_badge_name && (
                <span className="lcp-badge-chip">🏅 {d.contest_badge_name}</span>
              )}

              {d.company && (
                <div className="lcp-meta-row">
                  <span className="lcp-meta-icon">💼</span>
                  <span>{d.company}{d.job_title ? ` · ${d.job_title}` : ''}</span>
                </div>
              )}
              {d.school && (
                <div className="lcp-meta-row">
                  <span className="lcp-meta-icon">🎓</span>
                  <span>{d.school}</span>
                </div>
              )}
              {d.country && (
                <div className="lcp-meta-row">
                  <span className="lcp-meta-icon">🌍</span>
                  <span>{d.country}</span>
                </div>
              )}
              {d.about_me && <p className="lcp-about">{d.about_me}</p>}

              {/* Quick stats */}
              <div style={{ width: '100%', marginTop: 8 }}>
                <div className="lcp-stat-row">
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.streak)}</div>
                    <div className="lcp-stat-box-label">🔥 Streak</div>
                  </div>
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.total_active_days)}</div>
                    <div className="lcp-stat-box-label">Active Days</div>
                  </div>
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.reputation)}</div>
                    <div className="lcp-stat-box-label">Reputation</div>
                  </div>
                </div>
              </div>

              {/* Language donut */}
              {langStats.length > 0 && (
                <>
                  <p className="lcp-card-title" style={{ marginTop: 16, marginBottom: 8 }}>
                    Language Stats
                  </p>
                  <div className="lcp-donut-wrap" style={{ width: '100%' }}>
                    <ProblemDonut
                      easy={langStats[0]?.problemsSolved || 0}
                      medium={langStats[1]?.problemsSolved || 0}
                      hard={langStats.slice(2).reduce((a,b) => a + b.problemsSolved, 0)}
                      total={langStats.reduce((a,b) => a + b.problemsSolved, 0)}
                    />
                    <div className="lcp-donut-legend">
                      {langStats.slice(0, 5).map((l, i) => (
                        <div key={l.languageName} className="lcp-donut-item">
                          <div className="lcp-donut-dot" style={{ background: LANG_COLORS[i] }} />
                          <span>{l.languageName}</span>
                          <strong style={{ marginLeft: 'auto' }}>{l.problemsSolved}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: solving + calendar + recent AC */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Solving card */}
              <div className="lcp-card">
                <p className="lcp-card-title">Solving Stats</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <ProblemDonut
                    easy={Number(d.easy_solved) || 0}
                    medium={Number(d.medium_solved) || 0}
                    hard={Number(d.hard_solved) || 0}
                    total={Number(d.total_solved) || 0}
                  />
                  <div className="lcp-diff-bars" style={{ flex: 1 }}>
                    {[
                      { label: 'Easy',   count: Number(d.easy_solved)||0,   cls: 'diff-easy',   max: Number(d.total_solved)||1 },
                      { label: 'Medium', count: Number(d.medium_solved)||0, cls: 'diff-medium',  max: Number(d.total_solved)||1 },
                      { label: 'Hard',   count: Number(d.hard_solved)||0,   cls: 'diff-hard',    max: Number(d.total_solved)||1 },
                    ].map(r => (
                      <div key={r.label} className="lcp-diff-row">
                        <span className="lcp-diff-label" style={{
                          color: r.cls === 'diff-easy' ? '#22c55e' : r.cls === 'diff-medium' ? '#f89f1b' : '#ef4444'
                        }}>{r.label}</span>
                        <div className="lcp-diff-bar-wrap">
                          <div className={`lcp-diff-fill ${r.cls}`}
                            style={{ width: `${r.max > 0 ? (r.count/r.max)*100 : 0}%` }} />
                        </div>
                        <span className="lcp-diff-count">{fmt(r.count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Activity calendar */}
              <div className="lcp-card">
                <ActivityHeatmap
                  calendar={d.contribution_calendar}
                  color="#f89f1b"
                  platformLabel="LeetCode"
                  platform="leetcode"
                  recentSubmissions={recentAc}
                  title="Activity Calendar"
                />

              </div>


              {/* Recent AC submissions */}
              {recentAc.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Recent Accepted</p>
                  <div className="lcp-sub-list">
                    {recentAc.slice(0, 10).map((s, i) => (
                      <div key={i} className="lcp-sub-item">
                        <div className="lcp-sub-dot" />
                        <a
                          href={`https://leetcode.com/problems/${s.titleSlug}`}
                          target="_blank" rel="noopener noreferrer"
                          className="lcp-sub-title"
                          style={{ textDecoration: 'none', color: 'var(--fg)' }}
                        >{s.title}</a>
                        <span className="lcp-sub-time">{relativeTime(s.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ STATISTICS TAB ════════════════════ */}
      {tab === 'Statistics' && (
        <div className="lcp-body">
          {/* Problem distribution */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Problem Distribution</p>
              <div className="lcp-donut-wrap">
                <ProblemDonut
                  easy={Number(d.easy_solved)||0}
                  medium={Number(d.medium_solved)||0}
                  hard={Number(d.hard_solved)||0}
                  total={Number(d.total_solved)||0}
                />
                <div className="lcp-donut-legend">
                  {[
                    { label: 'Easy',   count: d.easy_solved,   color: '#22c55e' },
                    { label: 'Medium', count: d.medium_solved,  color: '#f89f1b' },
                    { label: 'Hard',   count: d.hard_solved,   color: '#ef4444' },
                  ].map(e => (
                    <div key={e.label} className="lcp-donut-item">
                      <div className="lcp-donut-dot" style={{ background: e.color }} />
                      <span>{e.label}</span>
                      <strong style={{ marginLeft: 'auto', color: e.color }}>{fmt(e.count)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lcp-diff-bars" style={{ marginTop: 16 }}>
                {[
                  { label: 'Easy',   count: Number(d.easy_solved)||0,   cls: 'diff-easy' },
                  { label: 'Medium', count: Number(d.medium_solved)||0, cls: 'diff-medium' },
                  { label: 'Hard',   count: Number(d.hard_solved)||0,   cls: 'diff-hard' },
                ].map(r => (
                  <div key={r.label} className="lcp-diff-row">
                    <span className="lcp-diff-label" style={{
                      color: r.cls === 'diff-easy' ? '#22c55e' : r.cls === 'diff-medium' ? '#f89f1b' : '#ef4444'
                    }}>{r.label}</span>
                    <div className="lcp-diff-bar-wrap">
                      <div className={`lcp-diff-fill ${r.cls}`}
                        style={{ width: `${Number(d.total_solved) > 0 ? (r.count / Number(d.total_solved)) * 100 : 0}%` }} />
                    </div>
                    <span className="lcp-diff-count">{fmt(r.count)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Contest performance summary */}
              <div className="lcp-card">
                <p className="lcp-card-title">Contest Performance</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Contest Rating', val: Math.round(d.contest_rating) || '—' },
                    { label: 'Peak Rating',    val: peakRating || '—' },
                    { label: 'Attended',       val: d.attended_contests_count || '—' },
                    { label: 'Best Rank',      val: bestRank ? `#${fmt(bestRank)}` : '—' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '10px 0' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--fg)' }}>{fmt(s.val)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {d.top_percentage > 0 && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(248,159,27,.08)', borderRadius: 8, border: '1px solid rgba(248,159,27,.2)' }}>
                    <span style={{ fontSize: '0.8rem', color: '#f89f1b' }}>
                      🏆 Top <strong>{Number(d.top_percentage).toFixed(1)}%</strong> globally
                    </span>
                  </div>
                )}
              </div>

              {/* Activity */}
              <div className="lcp-card">
                <p className="lcp-card-title">Activity</p>
                <ActivityHeatmap
                  calendar={d.contribution_calendar}
                  color="#f89f1b"
                  platformLabel="LeetCode"
                  platform="leetcode"
                  recentSubmissions={recentAc}
                />

                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>Current Streak</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>{d.streak ?? 0} Days</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>Active Days</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>{d.total_active_days ?? 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>Acceptance Rate</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>{d.acceptance_rate ?? 0}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Language breakdown */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Language Breakdown</p>
              {langStats.length > 0 ? (
                <div className="lcp-lang-list">
                  {langStats.map((l, i) => (
                    <div key={l.languageName} className="lcp-lang-row">
                      <div className="lcp-lang-top">
                        <span className="lcp-lang-name">{l.languageName}</span>
                        <span className="lcp-lang-count">{l.problemsSolved} solved</span>
                      </div>
                      <div className="lcp-lang-bar">
                        <div className="lcp-lang-fill" style={{
                          width: `${(l.problemsSolved / maxLang) * 100}%`,
                          background: LANG_COLORS[i % LANG_COLORS.length]
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>No language data yet.</p>}
            </div>

            {/* Top skills */}
            <div className="lcp-card">
              <p className="lcp-card-title">Top Skills</p>
              {topSkills.length > 0 ? (
                <div className="lcp-lang-list">
                  {topSkills.map((t, i) => (
                    <div key={t.tagName} className="lcp-lang-row">
                      <div className="lcp-lang-top">
                        <span className="lcp-lang-name">{t.tagName}</span>
                        <span className="lcp-lang-count">{t.problemsSolved} solved</span>
                      </div>
                      <div className="lcp-lang-bar">
                        <div className="lcp-lang-fill" style={{
                          width: `${(t.problemsSolved / (topSkills[0]?.problemsSolved || 1)) * 100}%`,
                          background: LANG_COLORS[i % LANG_COLORS.length]
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>No skill data yet.</p>}
            </div>
          </div>

          {/* Contest rating history chart */}
          <div className="lcp-card">
            <p className="lcp-card-title">Contest Rating History</p>
            <RatingChart points={lcToChartPoints(contests)} platform="leetcode" height={280} />
            <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Current Rating', val: Math.round(d.contest_rating) || '—' },
                { label: 'Peak Rating',    val: peakRating || '—' },
                { label: 'Average Rank',   val: avgRank ? `#${fmt(avgRank)}` : '—' },
                { label: 'Top %',          val: d.top_percentage ? `${Number(d.top_percentage).toFixed(1)}%` : '—' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>{s.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ CONTESTS TAB ════════════════════ */}
      {tab === 'Contests' && (
        <div className="lcp-body">
          {/* Stats row */}
          <div className="lcp-kpis" style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {[
              { val: fmt(d.attended_contests_count), sub: 'Total Contests' },
              { val: d.top_percentage ? `${Number(d.top_percentage).toFixed(1)}%` : '—', sub: 'Top %' },
              { val: Math.round(d.contest_rating) || '—', sub: 'Contest Rating' },
              { val: bestRank ? `#${fmt(bestRank)}` : '—', sub: 'Best Rank' },
            ].map(k => (
              <div key={k.sub} className="lcp-kpi">
                <div className="lcp-kpi-val">{k.val}</div>
                <div className="lcp-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Rating trend chart */}
          <div className="lcp-card">
            <p className="lcp-card-title">Contest Rating Trend</p>
            <RatingChart points={lcToChartPoints(contests)} platform="leetcode" height={300} />
            <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Current Rating', val: Math.round(d.contest_rating) || '—' },
                { label: 'Peak Rating',    val: peakRating || '—' },
                { label: 'Average Rank',   val: avgRank ? `#${fmt(avgRank)}` : '—' },
                { label: 'Top % Avg',      val: d.top_percentage ? `${Number(d.top_percentage).toFixed(1)}%` : '—' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>{s.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contest history table */}
          <div className="lcp-card">
            <p className="lcp-card-title">Contest History</p>
            {sortedContests.length === 0
              ? <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>No contest data yet.</p>
              : (
                <>
                  <div className="lcp-table-wrap">
                    <table className="lcp-table">
                      <thead>
                        <tr>
                          <th>Contest</th>
                          <th>Rating</th>
                          <th>Ranking</th>
                          <th>Solved</th>
                          <th>Finish Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedContests.map((c, i) => {
                          const isUp = c.trend_direction === 'UP'
                          return (
                            <tr
                              key={i}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedContest(c)}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.06)'}
                              onMouseLeave={e => e.currentTarget.style.background = ''}
                            >
                              <td>
                                <div style={{ fontWeight: 500 }}>{c.contest_title}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
                                  {fmtDate(c.contest_time ? new Date(Number(c.contest_time) * 1000) : null)}
                                </div>
                              </td>
                              <td>
                                <span className={`rating-pill ${isUp ? 'up' : 'down'}`}>
                                  {isUp ? '▲' : '▼'} {Math.round(c.rating_after_contest)}
                                </span>
                              </td>
                              <td>#{fmt(c.rank_achieved)}</td>
                              <td>{c.problems_solved} / {c.total_problems || '?'}</td>
                              <td>{fmtTime(c.finish_time_seconds)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 8 }}>
                    {sortedContests.length} contest{sortedContests.length !== 1 ? 's' : ''} total
                    {' · '}<span style={{ color: '#22c55e' }}>Click any row to view contest details</span>
                  </p>
                </>
              )
            }
          </div>
        </div>
      )}

      {/* ════════════════════ BADGES TAB ════════════════════ */}
      {tab === 'Badges' && (
        <div className="lcp-body">
          <div className="lcp-2col">
            <div>
              {/* Earned badges */}
              <div className="lcp-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <p className="lcp-card-title" style={{ margin: 0 }}>Earned Badges</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{badges.length} total</span>
                </div>
                {badges.length > 0 ? (
                  <div className="lcp-badges-grid">
                    {badges.map((b, i) => (
                      <div key={i} className="lcp-badge-card">
                        <BadgeIcon icon={b.icon} name={b.displayName || b.name} size={48} />
                        <div className="lcp-badge-name">{b.displayName || b.name}</div>
                        <div className="lcp-badge-date">{fmtDate(b.creationDate)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>No badges earned yet.</p>
                )}
              </div>

              {/* Upcoming badges */}
              {upcomingBadges.length > 0 && (
                <div className="lcp-card" style={{ marginTop: 16 }}>
                  <p className="lcp-card-title">Upcoming Badges</p>
                  <div className="lcp-upcoming-list">
                    {upcomingBadges.map((b, i) => (
                      <div key={i} className="lcp-upcoming-item">
                        <div className="lcp-upcoming-icon">
                          <BadgeIcon icon={b.icon} name={b.name} size={32} />
                        </div>
                        <div className="lcp-upcoming-info">
                          <div className="lcp-upcoming-name">{b.name}</div>
                          {b.progress !== undefined && (
                            <>
                              <div className="lcp-upcoming-prog">{b.progress} / 100</div>
                              <div className="lcp-upcoming-bar">
                                <div className="lcp-upcoming-fill" style={{ width: `${Math.min(b.progress, 100)}%` }} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active badge */}
            <div>
              {activeBadge && (
                <div className="lcp-card" style={{ textAlign: 'center' }}>
                  <p className="lcp-card-title">Active Badge</p>
                  <div style={{ padding: '24px 0' }}>
                    <BadgeIcon icon={activeBadge.icon} name={activeBadge.name} size={80} />
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg)', marginTop: 12 }}>
                      {activeBadge.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 6, lineHeight: 1.5 }}>
                      Your currently displayed badge on LeetCode.
                    </div>
                  </div>
                </div>
              )}

              {d.contest_badge_name && (
                <div className="lcp-card" style={{ marginTop: 16 }}>
                  <p className="lcp-card-title">Contest Badge</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                    <span style={{ fontSize: '2rem' }}>🏅</span>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--fg)' }}>{d.contest_badge_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 4 }}>
                        Awarded based on contest rating tier
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ TOPICS TAB ════════════════════ */}
      {tab === 'Topics' && (
        <div className="lcp-body">
          <div className="lcp-topics-grid">
            {/* Skill cards */}
            <div>
              <div className="lcp-card">
                <p className="lcp-card-title">Top Skill Cards</p>
                {topSkills.length > 0 ? (
                  <div className="lcp-skill-cards">
                    {topSkills.map((t, i) => (
                      <div key={t.tagName} className="lcp-skill-card">
                        <div className="lcp-skill-card-name">{t.tagName}</div>
                        <div className="lcp-skill-card-count">{t.problemsSolved} Solved</div>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>No skill data yet.</p>}
              </div>
            </div>

            {/* Topic list by tier */}
            <div className="lcp-card">
              <p className="lcp-card-title">Problems by Topic</p>
              {['advanced', 'intermediate', 'fundamental'].map(tier => {
                const items = skillTags[tier] || []
                if (items.length === 0) return null
                return (
                  <div key={tier} className="lcp-topic-tier">
                    <span className={`lcp-tier-label tier-${tier}`}>
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </span>
                    {items
                      .sort((a,b) => b.problemsSolved - a.problemsSolved)
                      .slice(0, 8)
                      .map(t => (
                        <div key={t.tagName} className="lcp-topic-item">
                          <span className="lcp-topic-name">{t.tagName}</span>
                          <span className="lcp-topic-count">{t.problemsSolved}</span>
                        </div>
                      ))
                    }
                  </div>
                )
              })}
              {!skillTags.advanced?.length && !skillTags.intermediate?.length && !skillTags.fundamental?.length && (
                <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem' }}>No topic data yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Contest detail panel */}
      {selectedContest && (
        <ContestDetailPanel
          contest={selectedContest}
          platform="leetcode"
          email={email}
          onClose={() => setSelectedContest(null)}
        />
      )}
    </div>
  )
}
