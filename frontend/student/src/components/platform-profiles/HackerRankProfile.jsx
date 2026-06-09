// frontend/student/src/components/platform-profiles/HackerRankProfile.jsx
// Full HackerRank GitHub-style profile — 4 tabs: Profile | Badges | Tracks | Submissions
import { useState, useMemo } from 'react'

const TABS = ['Profile', 'Badges', 'Tracks', 'Submissions']

// ── Constants ─────────────────────────────────────────────────────────────────
const BADGE_META = {
  problem_solving: { label: 'Problem Solving', icon: '🧩', color: '#1a8cff', maxStars: 6, thresholds: [30,100,200,475,850,2200] },
  algorithms:      { label: 'Algorithms',      icon: '⚙️',  color: '#22c55e', maxStars: 5, thresholds: [30,100,200,475,850] },
  python:          { label: 'Python',           icon: '🐍', color: '#f59e0b', maxStars: 5, thresholds: [35,70,110,220,400] },
  java:            { label: 'Java',             icon: '☕', color: '#ef4444', maxStars: 5, thresholds: [25,50,80,150,250] },
  cpp:             { label: 'C++',              icon: '⚡', color: '#06b6d4', maxStars: 5, thresholds: [10,40,70,150,250] },
  sql:             { label: 'SQL',              icon: '🗄️',  color: '#8b5cf6', maxStars: 5, thresholds: [80,175,300,450,650] },
  javascript:      { label: 'JavaScript',      icon: '🟨', color: '#eab308', maxStars: 5, thresholds: [30,70,110,220,400] },
  ruby:            { label: 'Ruby',             icon: '💎', color: '#ec4899', maxStars: 5, thresholds: [35,100,200,350,550] },
  '30daysofcode':  { label: '30 Days of Code', icon: '📅', color: '#f89f1b', maxStars: 5, thresholds: [2,7,15,22,30] },
  shell:           { label: 'Linux Shell',      icon: '🐚', color: '#64748b', maxStars: 5, thresholds: [10,40,80,150,250] },
  regex:           { label: 'Regex',            icon: '🔍', color: '#a855f7', maxStars: 5, thresholds: [20,40,80,150,250] },
  'data-structures': { label: 'Data Structures', icon: '🌲', color: '#10b981', maxStars: 5, thresholds: [30,100,200,475,850] },
}

const TRACK_ORDER = [
  'algorithms','data-structures','mathematics','python','java','cpp','javascript',
  'sql','shell','fp','regex','ai','security','ruby','c','30daysofcode'
]

const LANG_COLORS = ['#1a8cff','#f89f1b','#22c55e','#a855f7','#ef4444','#06b6d4','#ec4899','#84cc16','#f59e0b','#64748b']

const MEDAL_COLORS = { gold: '#ffd700', silver: '#c0c0c0', bronze: '#cd7f32' }

const CERT_LEVEL_COLORS = { basic: '#22c55e', intermediate: '#f89f1b', advanced: '#ef4444' }
const CERT_LEVEL_LABELS  = { basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced' }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return (!n && n !== 0) ? '—' : Number(n).toLocaleString() }
function parseJSON(v) {
  if (!v) return null
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return null } }
  return v
}
function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}
function relTime(s) {
  if (!s) return '—'
  const diff = (Date.now() - new Date(s)) / 1000
  if (diff < 60)     return 'Just now'
  if (diff < 3600)   return `${Math.floor(diff/60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff/3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
  return fmtDate(s)
}

// ── Star bar ──────────────────────────────────────────────────────────────────
function StarBar({ stars, maxStars = 5, color = '#1a8cff', size = 16 }) {
  return (
    <div style={{ display:'flex', gap:2 }}>
      {Array.from({ length: maxStars }, (_,i) => (
        <span key={i} style={{
          fontSize: size,
          color: i < stars ? color : 'var(--border)',
          transition: 'color .2s'
        }}>★</span>
      ))}
    </div>
  )
}

// ── Points progress ring ──────────────────────────────────────────────────────
function PointsRing({ points, color }) {
  const maxP = 2000
  const pct  = Math.min(1, (points || 0) / maxP)
  const R = 44, CX = 56, CY = 56, STROKE = 9
  const circ = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 112 112" width="112" height="112">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={STROKE}
        strokeDasharray={`${circ*pct} ${circ*(1-pct)}`}
        strokeDashoffset={-circ/4} strokeLinecap="round" />
      <text x={CX} y={CY-6} textAnchor="middle" fill={color} fontSize="14" fontWeight="800">
        {fmt(Math.round(points))}
      </text>
      <text x={CX} y={CY+12} textAnchor="middle" fill="var(--fg-muted)" fontSize="8.5">Points</text>
    </svg>
  )
}

const PAGE_SIZE = 10

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HackerRankProfile({ data, onBack }) {
  const [tab,  setTab]  = useState('Profile')
  const [page, setPage] = useState(0)

  const { detail: rawDetail, submissions, base } = data
  // Merge base into detail so we always have at least username
  const d = { ...(base || {}), ...(rawDetail || {}) }
  if (!d || (!d.username)) return null

  // Parsed JSONB
  const badges      = useMemo(() => parseJSON(d.badges)       || [], [d.badges])
  const certs       = useMemo(() => parseJSON(d.certificates)  || [], [d.certificates])
  const trackScores = useMemo(() => parseJSON(d.track_scores)  || [], [d.track_scores])

  // Build track map from DB
  const trackMap = useMemo(() => {
    const m = {}
    trackScores.forEach(t => { m[t.track] = t })
    return m
  }, [trackScores])

  // Build badge map from DB badges array
  const badgeMap = useMemo(() => {
    const m = {}
    badges.forEach(b => { m[b.type || b.badge_id] = b })
    return m
  }, [badges])

  const totalPoints      = parseFloat(d.total_points)      || 0
  const eloRating        = parseFloat(d.elo_rating)        || 1500
  const leaderboardRank  = parseInt(d.leaderboard_rank)    || 0
  const contestsEntered  = parseInt(d.contests_participated) || 0
  const level            = parseInt(d.level)                || 0

  // Submissions data
  const sortedSubs    = useMemo(() => [...(submissions||[])].sort((a,b) => {
    if (!a.submitted_at && !b.submitted_at) return 0
    if (!a.submitted_at) return 1
    if (!b.submitted_at) return -1
    return new Date(b.submitted_at) - new Date(a.submitted_at)
  }), [submissions])
  const pageCount     = Math.ceil(sortedSubs.length / PAGE_SIZE)
  const pageSubs      = sortedSubs.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE)

  // Language stats from submissions
  const langStats = useMemo(() => {
    const m = {}
    sortedSubs.forEach(s => { if (s.language) m[s.language] = (m[s.language]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([lang,count])=>({lang,count}))
  }, [sortedSubs])
  const maxLang = langStats[0]?.count || 1

  // Stars summary from DB cols
  const domainStars = [
    { slug:'problem_solving', stars: d.problem_solving_stars || 0, score: d.problem_solving_score || 0 },
    { slug:'python',          stars: d.python_stars || 0, score: Math.round(parseFloat(d.algorithms_score||0)) },
    { slug:'java',            stars: d.java_stars   || 0, score: 0 },
    { slug:'cpp',             stars: d.cpp_stars    || 0, score: 0 },
    { slug:'sql',             stars: d.sql_stars    || 0, score: d.sql_score || 0 },
    { slug:'javascript',      stars: d.js_stars     || 0, score: 0 },
  ].filter(b => b.stars > 0 || b.score > 0)

  // Medals
  const gold   = parseInt(d.medals_gold)   || 0
  const silver = parseInt(d.medals_silver) || 0
  const bronze = parseInt(d.medals_bronze) || 0

  // Social links
  const hasLinks = d.linkedin_url || d.github_url || d.website || d.twitter_url

  const initials = ((d.display_name || d.username) || '?')
    .split(' ').map(s => s[0]).join('').toUpperCase().slice(0,2)

  const accent = '#1a8cff'

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
                onClick={() => setTab(t)}>{t}</button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── KPI strip ── */}
      <div className="lcp-kpis">
        {[
          { val: fmt(Math.round(totalPoints)),   sub: 'Total Points' },
          { val: fmt(eloRating.toFixed(0)),       sub: 'ELO Rating' },
          { val: leaderboardRank ? `#${fmt(leaderboardRank)}` : '—', sub: 'Leaderboard Rank' },
          { val: fmt(sortedSubs.length),          sub: 'Solved Challenges' },
          { val: certs.length || '—',             sub: 'Certificates' },
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
          <div className="lcp-profile-grid">
            {/* Avatar card */}
            <div className="lcp-avatar-card">
              {d.avatar_url
                ? <img src={d.avatar_url} alt={d.username} className="lcp-avatar" />
                : <div className="lcp-avatar-initials" style={{
                    background:'linear-gradient(135deg, #1a8cff, #7c3aed)'
                  }}>{initials}</div>
              }
              <p className="lcp-username">@{d.username}</p>
              {d.display_name && <p className="lcp-realname">{d.display_name}</p>}
              {d.jobs_headline && (
                <p style={{ fontSize:'0.78rem', color:'var(--fg-muted)', textAlign:'center', margin:'4px 0' }}>
                  {d.jobs_headline}
                </p>
              )}

              {/* Points ring */}
              <div style={{ margin:'8px 0' }}>
                <PointsRing points={totalPoints} color={accent} />
              </div>

              {/* Level badge */}
              {level > 0 && (
                <span className="lcp-badge-chip" style={{
                  background:'#1a8cff18', borderColor:'#1a8cff44', color:'#1a8cff'
                }}>Level {level}</span>
              )}

              {/* Medals */}
              {(gold + silver + bronze) > 0 && (
                <div style={{ display:'flex', gap:12, marginTop:10 }}>
                  {[['🥇',gold,'#ffd700'],['🥈',silver,'#c0c0c0'],['🥉',bronze,'#cd7f32']].map(([icon,count,col]) =>
                    count > 0 ? (
                      <div key={icon} style={{ textAlign:'center' }}>
                        <div style={{ fontSize:'1.4rem' }}>{icon}</div>
                        <div style={{ fontSize:'0.75rem', fontWeight:700, color:col }}>{count}</div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Bio */}
              {d.about && (
                <p style={{ fontSize:'0.74rem', color:'var(--fg-muted)', textAlign:'center', marginTop:8, lineHeight:1.5 }}>
                  {d.about.length > 140 ? d.about.slice(0,137)+'…' : d.about}
                </p>
              )}

              {d.school && (
                <div className="lcp-meta-row"><span className="lcp-meta-icon">🎓</span>{d.school}</div>
              )}
              {d.city && (
                <div className="lcp-meta-row"><span className="lcp-meta-icon">📍</span>
                  {[d.city, d.country].filter(Boolean).join(', ')}
                </div>
              )}
              {!d.city && d.country && (
                <div className="lcp-meta-row"><span className="lcp-meta-icon">🌍</span>{d.country}</div>
              )}

              {/* Social links */}
              {hasLinks && (
                <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
                  {[
                    { url: d.github_url,   icon: '🐙', label:'GitHub' },
                    { url: d.linkedin_url, icon: '💼', label:'LinkedIn' },
                    { url: d.twitter_url,  icon: '🐦', label:'Twitter' },
                    { url: d.website,      icon: '🌐', label:'Website' },
                  ].filter(s => s.url).map(s => (
                    <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{
                        padding:'4px 10px', borderRadius:8, fontSize:'0.72rem',
                        background:'var(--border)', color:'var(--fg-muted)',
                        textDecoration:'none', display:'flex', alignItems:'center', gap:4
                      }}>
                      {s.icon} {s.label}
                    </a>
                  ))}
                </div>
              )}

              {/* Followers */}
              <div style={{ marginTop:8 }}>
                <div className="lcp-stat-row">
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.followers_count)}</div>
                    <div className="lcp-stat-box-label">Followers</div>
                  </div>
                  <div className="lcp-stat-box">
                    <div className="lcp-stat-box-val">{fmt(d.following_count)}</div>
                    <div className="lcp-stat-box-label">Following</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Domain badges preview */}
              {domainStars.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Badge Stars</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {domainStars.map(b => {
                      const meta = BADGE_META[b.slug] || { label:b.slug, color:'#888', maxStars:5 }
                      return (
                        <div key={b.slug} style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <span style={{ fontSize:'1rem', width:24, textAlign:'center' }}>{meta.icon || '🏅'}</span>
                          <span style={{ fontSize:'0.8rem', color:'var(--fg)', width:140 }}>{meta.label}</span>
                          <StarBar stars={b.stars} maxStars={meta.maxStars} color={meta.color} size={14} />
                          <span style={{ fontSize:'0.72rem', color:'var(--fg-muted)', marginLeft:'auto' }}>
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
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {certs.slice(0,6).map((c, i) => {
                      const lvlColor = CERT_LEVEL_COLORS[c.level] || '#888'
                      return (
                        <div key={i} className="lcp-sub-item">
                          <div className="lcp-sub-dot" style={{ background: lvlColor }} />
                          <div>
                            <span className="lcp-sub-title">{c.title}</span>
                            <span style={{
                              fontSize:'0.68rem', padding:'1px 7px', borderRadius:8, marginLeft:6,
                              background:`${lvlColor}18`, color:lvlColor
                            }}>{CERT_LEVEL_LABELS[c.level] || c.level}</span>
                          </div>
                          {c.issued_at && (
                            <span className="lcp-sub-time" style={{ marginLeft:'auto' }}>
                              {fmtDate(c.issued_at)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recent solved */}
              {sortedSubs.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Recent Challenges</p>
                  <div className="lcp-sub-list">
                    {sortedSubs.slice(0,8).map((s, i) => {
                      const ok = (s.status||'').toLowerCase().includes('accept') ||
                                 (s.status||'').toLowerCase() === 'solved'
                      return (
                        <div key={i} className="lcp-sub-item">
                          <div className="lcp-sub-dot" style={{ background: ok ? '#22c55e' : '#ef4444' }} />
                          <span className="lcp-sub-title">{s.challenge_name}</span>
                          {s.track && (
                            <span style={{
                              fontSize:'0.68rem', padding:'1px 6px', borderRadius:8, marginLeft:6,
                              background:'#1a8cff18', color:'#1a8cff', flexShrink:0
                            }}>{s.track}</span>
                          )}
                          <span className="lcp-sub-time" style={{ marginLeft:'auto' }}>
                            {relTime(s.submitted_at)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Language breakdown */}
              {langStats.length > 0 && (
                <div className="lcp-card">
                  <p className="lcp-card-title">Languages Used</p>
                  <div className="lcp-lang-list">
                    {langStats.map((l, i) => (
                      <div key={l.lang} className="lcp-lang-row">
                        <div className="lcp-lang-top">
                          <span className="lcp-lang-name">{l.lang}</span>
                          <span className="lcp-lang-count">{l.count} solved</span>
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
            {Object.entries(BADGE_META).length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
                {Object.entries(BADGE_META).map(([slug, meta]) => {
                  const dbBadge  = badgeMap[slug] || {}
                  const stars    = parseInt(dbBadge.stars || 0, 10)
                  const pts      = parseFloat(dbBadge.current_points || 0)
                  const nextPts  = parseFloat(dbBadge.next_level_points || meta.thresholds[stars] || 0)
                  const earned   = stars > 0
                  const progress = nextPts > 0 ? Math.min(1, pts / nextPts) : stars >= meta.maxStars ? 1 : 0

                  return (
                    <div key={slug} style={{
                      width:160, padding:'16px 14px', borderRadius:14, textAlign:'center',
                      background: earned ? `${meta.color}10` : 'rgba(255,255,255,0.03)',
                      border:`2px solid ${earned ? meta.color+'44' : 'var(--border)'}`,
                      opacity: earned ? 1 : 0.55,
                      transition:'all .2s'
                    }}>
                      <div style={{ fontSize:'1.8rem', marginBottom:6 }}>{meta.icon || '🏅'}</div>
                      <div style={{ fontSize:'0.78rem', fontWeight:700, color:meta.color, marginBottom:6 }}>
                        {meta.label}
                      </div>
                      <StarBar stars={stars} maxStars={meta.maxStars} color={meta.color} size={13} />
                      {pts > 0 && (
                        <div style={{ fontSize:'0.68rem', color:'var(--fg-muted)', marginTop:6 }}>
                          {fmt(pts)}{nextPts > 0 ? ` / ${fmt(nextPts)} pts` : ' pts'}
                        </div>
                      )}
                      {!earned && (
                        <div style={{ fontSize:'0.65rem', color:'var(--fg-muted)', marginTop:4 }}>
                          Not started
                        </div>
                      )}
                      {/* Progress bar */}
                      {(earned || pts > 0) && nextPts > 0 && (
                        <div style={{ height:3, background:'var(--border)', borderRadius:2, marginTop:8 }}>
                          <div style={{
                            height:'100%', borderRadius:2, background:meta.color,
                            width:`${Math.max(3, progress*100)}%`, transition:'width .4s'
                          }}/>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No badge data yet.</p>
            )}
          </div>

          {/* Certificates wall */}
          <div className="lcp-card">
            <p className="lcp-card-title">Skill Certificates</p>
            {certs.length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
                {certs.map((c, i) => {
                  const lvlColor = CERT_LEVEL_COLORS[c.level] || '#888'
                  return (
                    <div key={i} style={{
                      padding:'12px 16px', borderRadius:12, minWidth:200,
                      background:`${lvlColor}10`,
                      border:`1.5px solid ${lvlColor}44`,
                    }}>
                      <div style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--fg)' }}>{c.title}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                        <span style={{
                          fontSize:'0.68rem', padding:'2px 8px', borderRadius:8,
                          background:`${lvlColor}22`, color:lvlColor, fontWeight:600
                        }}>{CERT_LEVEL_LABELS[c.level] || c.level}</span>
                        {c.issued_at && (
                          <span style={{ fontSize:'0.68rem', color:'var(--fg-muted)' }}>
                            {fmtDate(c.issued_at)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:'0.65rem', color:'#22c55e', marginTop:6, fontWeight:600 }}>
                        ✓ Passed
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No certificates earned yet.</p>
            )}
          </div>

          {/* Medals + ELO */}
          <div className="lcp-2col">
            <div className="lcp-card">
              <p className="lcp-card-title">Contest Medals</p>
              <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
                {[['🥇','Gold',gold,'#ffd700'],['🥈','Silver',silver,'#c0c0c0'],['🥉','Bronze',bronze,'#cd7f32']].map(([icon,label,count,color]) => (
                  <div key={label} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:'2.4rem' }}>{icon}</div>
                    <div style={{ fontSize:'1.2rem', fontWeight:800, color }}>{count}</div>
                    <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16, display:'flex', gap:20 }}>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>ELO Rating</div>
                  <div style={{ fontSize:'1.2rem', fontWeight:700, color:accent }}>
                    {eloRating.toFixed(0)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:'0.7rem', color:'var(--fg-muted)' }}>Contests Entered</div>
                  <div style={{ fontSize:'1.2rem', fontWeight:700 }}>{fmt(contestsEntered)}</div>
                </div>
              </div>
            </div>

            <div className="lcp-card">
              <p className="lcp-card-title">Account Summary</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { label:'Total Points',   val: fmt(Math.round(totalPoints)), color:accent },
                  { label:'Leaderboard Rank', val: leaderboardRank ? `#${fmt(leaderboardRank)}` : '—', color:'var(--fg)' },
                  { label:'Level',          val: level || '—', color:'var(--fg)' },
                  { label:'Member Since',   val: fmtDate(d.created_at_hr), color:'var(--fg-muted)' },
                  { label:'Followers',      val: fmt(d.followers_count), color:'var(--fg)' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'0.8rem', color:'var(--fg-muted)' }}>{s.label}</span>
                    <span style={{ fontSize:'0.95rem', fontWeight:700, color:s.color }}>{s.val}</span>
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
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {TRACK_ORDER.map(slug => {
                    const t = trackMap[slug]
                    if (!t && !BADGE_META[slug]) return null
                    const meta  = BADGE_META[slug] || { label:slug, color:'#888' }
                    const score = t?.score || 0
                    const rank  = t?.rank  || 0
                    const maxS  = 500
                    return (
                      <div key={slug}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:'0.78rem', color:'var(--fg)', fontWeight:500 }}>
                            {meta.icon || '🏅'} {meta.label}
                          </span>
                          <span style={{ fontSize:'0.72rem', color:'var(--fg-muted)' }}>
                            {score > 0 ? `${fmt(score)} pts` : '—'}
                            {rank > 0 ? ` · #${fmt(rank)}` : ''}
                          </span>
                        </div>
                        <div style={{ height:5, background:'var(--border)', borderRadius:3 }}>
                          <div style={{
                            height:'100%', borderRadius:3,
                            background: meta.color || accent,
                            width:`${Math.min(100, (score/maxS)*100)}%`,
                            transition:'width .4s'
                          }}/>
                        </div>
                      </div>
                    )
                  }).filter(Boolean)}
                </div>
              ) : <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No track data yet.</p>}
            </div>

            {/* Language usage */}
            <div className="lcp-card">
              <p className="lcp-card-title">Language Usage</p>
              {langStats.length > 0 ? (
                <div className="lcp-lang-list">
                  {langStats.map((l,i) => (
                    <div key={l.lang} className="lcp-lang-row">
                      <div className="lcp-lang-top">
                        <span className="lcp-lang-name">{l.lang}</span>
                        <span className="lcp-lang-count">{l.count} solved</span>
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
              ) : <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No submission language data.</p>}
            </div>
          </div>

          {/* Track stars quick-view */}
          <div className="lcp-card">
            <p className="lcp-card-title">Star Ratings by Domain</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
              {Object.entries(BADGE_META).map(([slug, meta]) => {
                const dbBadge = badgeMap[slug] || {}
                const stars   = parseInt(dbBadge.stars || (
                  slug==='problem_solving' ? (d.problem_solving_stars||0) :
                  slug==='python'          ? (d.python_stars||0) :
                  slug==='java'            ? (d.java_stars||0) :
                  slug==='cpp'             ? (d.cpp_stars||0) :
                  slug==='sql'             ? (d.sql_stars||0) :
                  slug==='javascript'      ? (d.js_stars||0) : 0
                ), 10)
                return (
                  <div key={slug} style={{
                    display:'flex', alignItems:'center', gap:8,
                    padding:'8px 12px', borderRadius:10, minWidth:180,
                    background: stars > 0 ? `${meta.color}10` : 'rgba(255,255,255,0.02)',
                    border:`1px solid ${stars > 0 ? meta.color+'33' : 'var(--border)'}`,
                  }}>
                    <span style={{ fontSize:'1.1rem' }}>{meta.icon || '🏅'}</span>
                    <div>
                      <div style={{ fontSize:'0.75rem', fontWeight:600, color:stars > 0 ? 'var(--fg)' : 'var(--fg-muted)' }}>
                        {meta.label}
                      </div>
                      <StarBar stars={stars} maxStars={meta.maxStars} color={meta.color} size={11} />
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
          <div className="lcp-kpis" style={{ borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
            {[
              { val: fmt(sortedSubs.length),     sub: 'Challenges Solved' },
              { val: fmt(d.submissions_count),   sub: 'Total Submissions' },
              { val: `${d.acceptance_rate || 0}%`, sub: 'Acceptance Rate' },
              { val: langStats[0]?.lang || '—',  sub: 'Top Language' },
            ].map(k => (
              <div key={k.sub} className="lcp-kpi">
                <div className="lcp-kpi-val">{k.val}</div>
                <div className="lcp-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Submissions table */}
          <div className="lcp-card">
            <p className="lcp-card-title">Solved Challenges</p>
            {pageSubs.length === 0
              ? <p style={{ color:'var(--fg-muted)', fontSize:'0.82rem' }}>No submissions data yet.</p>
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
                        {pageSubs.map((s,i) => {
                          const ok = (s.status||'').toLowerCase().includes('accept') ||
                                     (s.status||'').toLowerCase() === 'solved'
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight:500 }}>{s.challenge_name}</td>
                              <td>
                                {s.track
                                  ? <span style={{
                                      fontSize:'0.68rem', padding:'1px 7px', borderRadius:8,
                                      background:'#1a8cff18', color:'#1a8cff'
                                    }}>{s.track}</span>
                                  : '—'}
                              </td>
                              <td style={{ color:'var(--fg-muted)', fontSize:'0.8rem' }}>
                                {s.language || '—'}
                              </td>
                              <td style={{ fontWeight:600 }}>
                                {s.score > 0 ? s.score : '—'}
                              </td>
                              <td>
                                <span style={{
                                  fontSize:'0.7rem', padding:'2px 8px', borderRadius:8, fontWeight:600,
                                  background: ok ? '#22c55e18' : '#ef444418',
                                  color: ok ? '#22c55e' : '#ef4444',
                                }}>
                                  {ok ? '✓ Accepted' : s.status || 'Attempted'}
                                </span>
                              </td>
                              <td style={{ color:'var(--fg-muted)', fontSize:'0.75rem' }}>
                                {relTime(s.submitted_at)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {pageCount > 1 && (
                    <div className="lcp-pagination">
                      <button className="lcp-page-btn" disabled={page===0}
                        onClick={() => setPage(p=>p-1)}>‹</button>
                      {Array.from({ length: pageCount }, (_,i) => (
                        <button key={i}
                          className={`lcp-page-btn${page===i?' active':''}`}
                          onClick={() => setPage(i)}>{i+1}</button>
                      ))}
                      <button className="lcp-page-btn" disabled={page===pageCount-1}
                        onClick={() => setPage(p=>p+1)}>›</button>
                    </div>
                  )}
                  <p style={{ fontSize:'0.72rem', color:'var(--fg-muted)', marginTop:8 }}>
                    {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE, sortedSubs.length)} of {sortedSubs.length}
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
