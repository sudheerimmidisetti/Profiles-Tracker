// frontend/student/src/components/platform-profiles/HackerRankProfile.jsx
// Full HackerRank profile — 4 tabs: Profile | Badges | Tracks | Submissions
import { useState, useMemo } from 'react'
import './HackerRankProfile.css'

const TABS = ['Profile', 'Badges', 'Tracks', 'Submissions']

// ── Constants ─────────────────────────────────────────────────────────────────
const BADGE_META = {
  problem_solving:  { label: 'Problem Solving', icon: '🧩', color: '#1a8cff', maxStars: 6, thresholds: [30,100,200,475,850,2200] },
  algorithms:       { label: 'Algorithms',      icon: '⚙️',  color: '#22c55e', maxStars: 5, thresholds: [30,100,200,475,850] },
  python:           { label: 'Python',           icon: '🐍', color: '#f59e0b', maxStars: 5, thresholds: [35,70,110,220,400] },
  java:             { label: 'Java',             icon: '☕', color: '#ef4444', maxStars: 5, thresholds: [25,50,80,150,250] },
  cpp:              { label: 'C++',              icon: '⚡', color: '#06b6d4', maxStars: 5, thresholds: [10,40,70,150,250] },
  sql:              { label: 'SQL',              icon: '🗄️',  color: '#8b5cf6', maxStars: 5, thresholds: [80,175,300,450,650] },
  javascript:       { label: 'JavaScript',       icon: '🟨', color: '#eab308', maxStars: 5, thresholds: [30,70,110,220,400] },
  ruby:             { label: 'Ruby',             icon: '💎', color: '#ec4899', maxStars: 5, thresholds: [35,100,200,350,550] },
  '30daysofcode':   { label: '30 Days of Code',  icon: '📅', color: '#f89f1b', maxStars: 5, thresholds: [2,7,15,22,30] },
  shell:            { label: 'Linux Shell',       icon: '🐚', color: '#64748b', maxStars: 5, thresholds: [10,40,80,150,250] },
  regex:            { label: 'Regex',             icon: '🔍', color: '#a855f7', maxStars: 5, thresholds: [20,40,80,150,250] },
  'data-structures':{ label: 'Data Structures',  icon: '🌲', color: '#10b981', maxStars: 5, thresholds: [30,100,200,475,850] },
}

const TRACK_ORDER = [
  'algorithms','data-structures','mathematics','python','java','cpp','javascript',
  'sql','shell','fp','regex','ai','security','ruby','c','30daysofcode'
]

const LANG_COLORS = ['#1a8cff','#f89f1b','#22c55e','#a855f7','#ef4444','#06b6d4','#ec4899','#84cc16','#f59e0b','#64748b']
const CERT_COLORS  = { basic: '#22c55e', intermediate: '#f89f1b', advanced: '#ef4444' }
const CERT_LABELS  = { basic: 'Basic',   intermediate: 'Intermediate',  advanced: 'Advanced' }

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = n   => (!n && n !== 0) ? '—' : Number(n).toLocaleString()
const parseJ  = v   => { if (!v) return null; if (typeof v === 'string') { try { return JSON.parse(v) } catch { return null } } return v }
const fmtDate = s   => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) }
const relTime = s   => {
  if (!s) return '—'
  const diff = (Date.now() - new Date(s)) / 1000
  if (diff < 60)     return 'Just now'
  if (diff < 3600)   return `${Math.floor(diff/60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
  return fmtDate(s)
}

// ── Star row ──────────────────────────────────────────────────────────────────
function Stars({ count, max = 5, color = '#1a8cff', size = 14 }) {
  return (
    <span className="hr-stars">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < count ? color : 'rgba(255,255,255,.15)', fontSize: size }}>★</span>
      ))}
    </span>
  )
}

// ── Points donut ──────────────────────────────────────────────────────────────
function Donut({ value, max = 2000, color = '#1a8cff', label = 'Points', size = 100 }) {
  const pct  = Math.min(1, (value || 0) / max)
  const R    = size * 0.38, cx = size / 2, cy = size / 2, sw = size * 0.085
  const circ = 2 * Math.PI * R
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="hr-donut">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeDashoffset={-circ / 4} strokeLinecap="round" />
      <text x={cx} y={cy - 5} textAnchor="middle" fill={color} fontSize={size * 0.14} fontWeight="800">
        {fmt(Math.round(value))}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize={size * 0.09}>
        {label}
      </text>
    </svg>
  )
}

const PAGE_SIZE = 15

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HackerRankProfile({ data, onBack }) {
  const [tab,  setTab]  = useState('Profile')
  const [page, setPage] = useState(0)

  const { detail: rawDetail, submissions, base } = data
  const d = { ...(base || {}), ...(rawDetail || {}) }
  if (!d || !d.username) return null

  const badges      = useMemo(() => parseJ(d.badges)      || [], [d.badges])
  const certs       = useMemo(() => parseJ(d.certificates) || [], [d.certificates])
  const trackScores = useMemo(() => parseJ(d.track_scores) || [], [d.track_scores])

  const trackMap = useMemo(() => {
    const m = {}
    trackScores.forEach(t => { m[t.track] = t })
    return m
  }, [trackScores])

  const badgeMap = useMemo(() => {
    const m = {}
    badges.forEach(b => { m[b.type || b.badge_id] = b })
    return m
  }, [badges])

  const totalPoints     = parseFloat(d.total_points)         || 0
  const eloRating       = parseFloat(d.elo_rating)           || 1500
  const leaderboardRank = parseInt(d.leaderboard_rank)       || 0
  const contestsEntered = parseInt(d.contests_participated)  || 0
  const level           = parseInt(d.level)                  || 0

  const sortedSubs = useMemo(() => [...(submissions||[])].sort((a,b) => {
    if (!a.submitted_at && !b.submitted_at) return 0
    if (!a.submitted_at) return 1
    if (!b.submitted_at) return -1
    return new Date(b.submitted_at) - new Date(a.submitted_at)
  }), [submissions])

  const pageCount = Math.ceil(sortedSubs.length / PAGE_SIZE)
  const pageSubs  = sortedSubs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const langStats = useMemo(() => {
    const m = {}
    sortedSubs.forEach(s => { if (s.language) m[s.language] = (m[s.language]||0)+1 })
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,8).map(([lang,count]) => ({lang,count}))
  }, [sortedSubs])
  const maxLang = langStats[0]?.count || 1

  const domainStars = [
    { slug:'problem_solving', stars: d.problem_solving_stars||0, score: d.problem_solving_score||0 },
    { slug:'python',          stars: d.python_stars||0,          score: Math.round(parseFloat(d.algorithms_score||0)) },
    { slug:'java',            stars: d.java_stars||0,            score: 0 },
    { slug:'cpp',             stars: d.cpp_stars||0,             score: 0 },
    { slug:'sql',             stars: d.sql_stars||0,             score: d.sql_score||0 },
    { slug:'javascript',      stars: d.js_stars||0,              score: 0 },
  ].filter(b => b.stars > 0 || b.score > 0)

  const gold   = parseInt(d.medals_gold)   || 0
  const silver = parseInt(d.medals_silver) || 0
  const bronze = parseInt(d.medals_bronze) || 0
  const hasLinks = d.linkedin_url || d.github_url || d.website || d.twitter_url
  const initials = ((d.display_name || d.username) || '?').split(' ').map(s => s[0]).join('').toUpperCase().slice(0,2)

  return (
    <div className="lcp-root">
      {/* ── Top nav ── */}
      <div className="lcp-topbar">
        <button className="lcp-back" onClick={onBack}>←</button>
        <ul className="lcp-tabs" role="tablist">
          {TABS.map(t => (
            <li key={t}>
              <button role="tab" aria-selected={tab === t}
                className={`lcp-tab${tab === t ? ' active' : ''}`}
                onClick={() => { setTab(t); setPage(0) }}>{t}</button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── KPI strip ── */}
      <div className="lcp-kpis">
        {[
          { val: fmt(Math.round(totalPoints)),                sub: 'Total Points' },
          { val: fmt(eloRating.toFixed(0)),                  sub: 'ELO Rating'   },
          { val: leaderboardRank ? `#${fmt(leaderboardRank)}` : '—', sub: 'Leaderboard' },
          { val: fmt(sortedSubs.length),                     sub: 'Solved'       },
          { val: certs.length || '—',                        sub: 'Certificates' },
        ].map(k => (
          <div key={k.sub} className="lcp-kpi">
            <div className="lcp-kpi-val">{k.val}</div>
            <div className="lcp-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ════ PROFILE TAB ════ */}
      {tab === 'Profile' && (
        <div className="lcp-body">
          <div className="hr-profile-grid">
            {/* ── Left: Identity card ── */}
            <div className="hr-identity-card">
              {/* Avatar */}
              <div className="hr-avatar-wrap">
                {d.avatar_url
                  ? <img src={d.avatar_url} alt={d.username} className="hr-avatar" />
                  : <div className="hr-avatar-initials">{initials}</div>
                }
              </div>
              <div className="hr-name">{d.display_name || d.username}</div>
              <div className="hr-handle">@{d.username}</div>
              {d.jobs_headline && <p className="hr-headline">{d.jobs_headline}</p>}

              {/* Donut */}
              <div className="hr-donut-wrap">
                <Donut value={totalPoints} max={2000} color="#1a8cff" label="Points" size={110} />
              </div>

              {/* Level + medals inline */}
              <div className="hr-chips">
                {level > 0 && <span className="hr-chip hr-chip-blue">Level {level}</span>}
                {gold   > 0 && <span className="hr-chip hr-chip-gold">🥇 {gold}</span>}
                {silver > 0 && <span className="hr-chip hr-chip-silver">🥈 {silver}</span>}
                {bronze > 0 && <span className="hr-chip hr-chip-bronze">🥉 {bronze}</span>}
              </div>

              {/* Bio */}
              {d.about && <p className="hr-bio">{d.about.length > 160 ? d.about.slice(0,157)+'…' : d.about}</p>}

              {/* Meta */}
              <div className="hr-meta-list">
                {d.school  && <div className="hr-meta-row">🎓 {d.school}</div>}
                {(d.city || d.country) && <div className="hr-meta-row">📍 {[d.city,d.country].filter(Boolean).join(', ')}</div>}
                {d.graduation_year && <div className="hr-meta-row">🎓 Graduating {d.graduation_year}</div>}
                {d.created_at_hr && <div className="hr-meta-row">📅 Joined {fmtDate(d.created_at_hr)}</div>}
              </div>

              {/* Social links */}
              {hasLinks && (
                <div className="hr-socials">
                  {[
                    { url: d.github_url,   icon: '🐙', label: 'GitHub' },
                    { url: d.linkedin_url, icon: '💼', label: 'LinkedIn' },
                    { url: d.twitter_url,  icon: '𝕏',  label: 'Twitter' },
                    { url: d.website,      icon: '🌐', label: 'Website' },
                  ].filter(s => s.url).map(s => (
                    <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="hr-social-link">
                      {s.icon}
                    </a>
                  ))}
                </div>
              )}

              {/* Followers */}
              <div className="hr-follow-row">
                <div className="hr-follow-item">
                  <div className="hr-follow-val">{fmt(d.followers_count)}</div>
                  <div className="hr-follow-label">Followers</div>
                </div>
                <div className="hr-follow-divider" />
                <div className="hr-follow-item">
                  <div className="hr-follow-val">{fmt(d.following_count)}</div>
                  <div className="hr-follow-label">Following</div>
                </div>
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="hr-right-col">
              {/* Badge Stars preview */}
              {domainStars.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Badge Stars</p>
                  <div className="hr-star-list">
                    {domainStars.map(b => {
                      const meta = BADGE_META[b.slug] || { label: b.slug, color: '#888', maxStars: 5 }
                      return (
                        <div key={b.slug} className="hr-star-row">
                          <span className="hr-star-icon">{meta.icon || '🏅'}</span>
                          <span className="hr-star-label">{meta.label}</span>
                          <Stars count={b.stars} max={meta.maxStars} color={meta.color} size={13} />
                          <span className="hr-star-score">
                            {b.score > 0 ? `${fmt(b.score)} pts` : `${b.stars}★`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Certificates preview */}
              {certs.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Certificates ({certs.length})</p>
                  <div className="hr-cert-list">
                    {certs.slice(0, 6).map((c, i) => {
                      const col = CERT_COLORS[c.level] || '#888'
                      return (
                        <div key={i} className="hr-cert-row">
                          <div className="hr-cert-dot" style={{ background: col }} />
                          <span className="hr-cert-title">{c.title}</span>
                          <span className="hr-cert-level" style={{ color: col, background: `${col}18` }}>
                            {CERT_LABELS[c.level] || c.level}
                          </span>
                          {c.issued_at && <span className="hr-cert-date">{fmtDate(c.issued_at)}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recent challenges */}
              {sortedSubs.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Recent Challenges</p>
                  <div className="hr-recent-list">
                    {sortedSubs.slice(0, 8).map((s, i) => {
                      const ok = (s.status||'').toLowerCase().includes('accept') || (s.status||'').toLowerCase() === 'solved'
                      return (
                        <div key={i} className="hr-recent-row">
                          <div className="hr-recent-dot" style={{ background: ok ? '#22c55e' : '#ef4444' }} />
                          <span className="hr-recent-name">{s.challenge_name}</span>
                          {s.track && <span className="hr-track-pill">{s.track}</span>}
                          <span className="hr-recent-time">{relTime(s.submitted_at)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Languages */}
              {langStats.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Languages Used</p>
                  <div className="hr-lang-grid">
                    {langStats.map((l, i) => (
                      <div key={l.lang} className="hr-lang-item">
                        <div className="hr-lang-bar-wrap">
                          <div className="hr-lang-bar" style={{
                            width: `${(l.count / maxLang) * 100}%`,
                            background: LANG_COLORS[i % LANG_COLORS.length]
                          }} />
                        </div>
                        <div className="hr-lang-info">
                          <span className="hr-lang-name">{l.lang}</span>
                          <span className="hr-lang-count">{l.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ BADGES TAB ════ */}
      {tab === 'Badges' && (
        <div className="lcp-body">
          {/* Domain badge gallery */}
          <div className="lcp-card">
            <p className="lcp-card-title">Domain Badges</p>
            <div className="hr-badge-grid">
              {Object.entries(BADGE_META).map(([slug, meta]) => {
                const dbBadge  = badgeMap[slug] || {}
                const stars    = parseInt(dbBadge.stars || 0, 10)
                const pts      = parseFloat(dbBadge.current_points || 0)
                const nextPts  = parseFloat(dbBadge.next_level_points || meta.thresholds[stars] || 0)
                const earned   = stars > 0
                const progress = nextPts > 0 ? Math.min(1, pts / nextPts) : (stars >= meta.maxStars ? 1 : 0)

                return (
                  <div key={slug} className={`hr-badge-card ${earned ? 'hr-badge-earned' : ''}`}
                    style={{ '--badge-color': meta.color }}>
                    <div className="hr-badge-icon">{meta.icon || '🏅'}</div>
                    <div className="hr-badge-name">{meta.label}</div>
                    <Stars count={stars} max={meta.maxStars} color={meta.color} size={12} />
                    {pts > 0 && (
                      <div className="hr-badge-pts">
                        {fmt(pts)}{nextPts > 0 ? ` / ${fmt(nextPts)}` : ''} pts
                      </div>
                    )}
                    {!earned && <div className="hr-badge-ns">Not started</div>}
                    {(earned || pts > 0) && nextPts > 0 && (
                      <div className="hr-badge-progress-track">
                        <div className="hr-badge-progress-fill"
                          style={{ width: `${Math.max(3, progress * 100)}%`, background: meta.color }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Certificates */}
          <div className="lcp-card">
            <p className="lcp-card-title">Skill Certificates</p>
            {certs.length > 0 ? (
              <div className="hr-cert-grid">
                {certs.map((c, i) => {
                  const col = CERT_COLORS[c.level] || '#888'
                  return (
                    <div key={i} className="hr-cert-card" style={{ '--cert-color': col }}>
                      <div className="hr-cert-card-icon">🎖️</div>
                      <div className="hr-cert-card-title">{c.title}</div>
                      <div className="hr-cert-card-footer">
                        <span className="hr-cert-level" style={{ color: col, background: `${col}18` }}>
                          {CERT_LABELS[c.level] || c.level}
                        </span>
                        <span className="hr-cert-passed">✓ Passed</span>
                        {c.issued_at && <span className="hr-cert-date">{fmtDate(c.issued_at)}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className="lcp-empty">No certificates earned yet.</p>}
          </div>

          {/* Medals + Summary */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Contest Medals</p>
              <div className="hr-medals-row">
                {[['🥇',gold,'#ffd700','Gold'],['🥈',silver,'#c0c0c0','Silver'],['🥉',bronze,'#cd7f32','Bronze']].map(([icon,count,col,label]) => (
                  <div key={label} className="hr-medal-item">
                    <div className="hr-medal-icon">{icon}</div>
                    <div className="hr-medal-count" style={{ color: col }}>{count}</div>
                    <div className="hr-medal-label">{label}</div>
                  </div>
                ))}
              </div>
              <div className="hr-stats-list" style={{ marginTop: 16 }}>
                <div className="hr-stat-row">
                  <span>ELO Rating</span>
                  <strong style={{ color: '#1a8cff' }}>{eloRating.toFixed(0)}</strong>
                </div>
                <div className="hr-stat-row">
                  <span>Contests Entered</span>
                  <strong>{fmt(contestsEntered)}</strong>
                </div>
              </div>
            </div>

            <div className="lcp-card">
              <p className="lcp-card-title">Account Summary</p>
              <div className="hr-stats-list">
                {[
                  { label: 'Total Points',      val: fmt(Math.round(totalPoints)), color: '#1a8cff' },
                  { label: 'Leaderboard Rank',  val: leaderboardRank ? `#${fmt(leaderboardRank)}` : '—' },
                  { label: 'Level',             val: level || '—' },
                  { label: 'Member Since',      val: fmtDate(d.created_at_hr) },
                  { label: 'Followers',         val: fmt(d.followers_count) },
                  { label: 'Challenges Solved', val: fmt(sortedSubs.length) },
                  { label: 'Acceptance Rate',   val: d.acceptance_rate ? `${d.acceptance_rate}%` : '—' },
                ].map(s => (
                  <div key={s.label} className="hr-stat-row">
                    <span>{s.label}</span>
                    <strong style={s.color ? { color: s.color } : {}}>{s.val}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ TRACKS TAB ════ */}
      {tab === 'Tracks' && (
        <div className="lcp-body">
          <div className="lcp-2col">
            {/* Track scores */}
            <div className="lcp-card">
              <p className="lcp-card-title">Practice Track Scores</p>
              {trackScores.length > 0 ? (
                <div className="hr-track-list">
                  {TRACK_ORDER.map(slug => {
                    const t    = trackMap[slug]
                    const meta = BADGE_META[slug] || { label: slug, color: '#888' }
                    const score = t?.score || 0
                    const rank  = t?.rank  || 0
                    if (!t && score === 0) return null
                    return (
                      <div key={slug} className="hr-track-item">
                        <div className="hr-track-head">
                          <span className="hr-track-name">
                            <span className="hr-track-icon">{meta.icon || '🏅'}</span>
                            {meta.label}
                          </span>
                          <span className="hr-track-score-val">
                            {score > 0 ? `${fmt(score)} pts` : '—'}
                            {rank  > 0 ? <span className="hr-track-rank">#{fmt(rank)}</span> : ''}
                          </span>
                        </div>
                        <div className="hr-track-bar-bg">
                          <div className="hr-track-bar-fill" style={{
                            width: `${Math.min(100, (score / 500) * 100)}%`,
                            background: meta.color || '#1a8cff',
                          }} />
                        </div>
                      </div>
                    )
                  }).filter(Boolean)}
                </div>
              ) : <p className="lcp-empty">No track data yet.</p>}
            </div>

            {/* Language usage */}
            <div className="lcp-card">
              <p className="lcp-card-title">Language Usage</p>
              {langStats.length > 0 ? (
                <div className="hr-lang-grid">
                  {langStats.map((l, i) => (
                    <div key={l.lang} className="hr-lang-item">
                      <div className="hr-lang-bar-wrap">
                        <div className="hr-lang-bar" style={{
                          width: `${(l.count / maxLang) * 100}%`,
                          background: LANG_COLORS[i % LANG_COLORS.length]
                        }} />
                      </div>
                      <div className="hr-lang-info">
                        <span className="hr-lang-name">{l.lang}</span>
                        <span className="hr-lang-count">{l.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="lcp-empty">No language data.</p>}
            </div>
          </div>

          {/* Star grid */}
          <div className="lcp-card">
            <p className="lcp-card-title">Star Ratings by Domain</p>
            <div className="hr-domain-grid">
              {Object.entries(BADGE_META).map(([slug, meta]) => {
                const dbBadge = badgeMap[slug] || {}
                const stars = parseInt(dbBadge.stars || (
                  slug === 'problem_solving' ? (d.problem_solving_stars||0) :
                  slug === 'python'          ? (d.python_stars||0) :
                  slug === 'java'            ? (d.java_stars||0) :
                  slug === 'cpp'             ? (d.cpp_stars||0) :
                  slug === 'sql'             ? (d.sql_stars||0) :
                  slug === 'javascript'      ? (d.js_stars||0) : 0
                ), 10)
                return (
                  <div key={slug} className={`hr-domain-item ${stars > 0 ? 'hr-domain-earned' : ''}`}
                    style={{ '--domain-color': meta.color }}>
                    <span className="hr-domain-icon">{meta.icon || '🏅'}</span>
                    <div>
                      <div className="hr-domain-label">{meta.label}</div>
                      <Stars count={stars} max={meta.maxStars} color={stars > 0 ? meta.color : 'rgba(255,255,255,.1)'} size={11} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════ SUBMISSIONS TAB ════ */}
      {tab === 'Submissions' && (
        <div className="lcp-body">
          {/* Stats strip */}
          <div className="lcp-kpis" style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {[
              { val: fmt(sortedSubs.length),          sub: 'Challenges Solved' },
              { val: fmt(d.submissions_count),         sub: 'Total Submissions' },
              { val: d.acceptance_rate ? `${d.acceptance_rate}%` : '—', sub: 'Acceptance Rate' },
              { val: langStats[0]?.lang || '—',        sub: 'Top Language' },
            ].map(k => (
              <div key={k.sub} className="lcp-kpi">
                <div className="lcp-kpi-val">{k.val}</div>
                <div className="lcp-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="lcp-card">
            <p className="lcp-card-title">Solved Challenges</p>
            {pageSubs.length === 0
              ? <p className="lcp-empty">No submissions data yet.</p>
              : (
                <>
                  <div className="lcp-table-wrap">
                    <table className="lcp-table">
                      <thead>
                        <tr>
                          <th>Challenge</th>
                          <th>Track</th>
                          <th>Language</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageSubs.map((s, i) => {
                          const ok = (s.status||'').toLowerCase().includes('accept') || (s.status||'').toLowerCase() === 'solved'
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 500 }}>{s.challenge_name}</td>
                              <td>
                                {s.track
                                  ? <span className="hr-track-pill">{s.track}</span>
                                  : '—'}
                              </td>
                              <td className="lcp-td-muted">{s.language || '—'}</td>
                              <td style={{ fontWeight: 600 }}>{s.score > 0 ? s.score : '—'}</td>
                              <td>
                                <span className={`hr-status-chip ${ok ? 'hr-status-ac' : 'hr-status-na'}`}>
                                  {ok ? '✓ Accepted' : s.status || 'Attempted'}
                                </span>
                              </td>
                              <td className="lcp-td-muted" style={{ fontSize: '0.75rem' }}>{relTime(s.submitted_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {pageCount > 1 && (
                    <div className="lcp-pagination">
                      <button className="lcp-page-btn" disabled={page === 0} onClick={() => setPage(p => p-1)}>‹</button>
                      {Array.from({ length: Math.min(pageCount, 8) }, (_, i) => {
                        const idx = pageCount <= 8 ? i : page <= 3 ? i : page >= pageCount-4 ? pageCount-8+i : page-3+i
                        return (
                          <button key={idx} className={`lcp-page-btn${page === idx ? ' active' : ''}`}
                            onClick={() => setPage(idx)}>{idx + 1}</button>
                        )
                      })}
                      <button className="lcp-page-btn" disabled={page === pageCount-1} onClick={() => setPage(p => p+1)}>›</button>
                    </div>
                  )}
                  <p className="lcp-range">
                    {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE, sortedSubs.length)} of {sortedSubs.length} challenges
                  </p>
                </>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}
