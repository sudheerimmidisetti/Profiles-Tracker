import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analyticsAPI } from '../api/api'
import Header from '../components/Header'
import ActivityHeatmap from '../components/ActivityHeatmap'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, BarChart, Bar
} from 'recharts'
import { ArrowLeft, ExternalLink, Trophy, Star, Flame, Target, TrendingUp, Code2 } from 'lucide-react'

// ── Platform config ──────────────────────────────────────────────────────────
const META = {
  leetcode:   { label: 'LeetCode',   color: '#FFA116', bg: 'rgba(255,161,22,0.12)',  url: u => `https://leetcode.com/u/${u}` },
  codeforces: { label: 'Codeforces', color: '#1F8DD6', bg: 'rgba(31,141,214,0.12)', url: u => `https://codeforces.com/profile/${u}` },
  codechef:   { label: 'CodeChef',   color: '#B45309', bg: 'rgba(180,83,9,0.12)',   url: u => `https://www.codechef.com/users/${u}` },
  hackerrank: { label: 'HackerRank', color: '#00EA64', bg: 'rgba(0,234,100,0.12)',  url: u => `https://www.hackerrank.com/profile/${u}` },
}

// ── Rank colours for Codeforces ──────────────────────────────────────────────
function cfRankColor(rank = '') {
  const r = rank.toLowerCase()
  if (r.includes('legendary'))  return '#FF0000'
  if (r.includes('international')) return '#FF3333'
  if (r.includes('grandmaster')) return '#FF3333'
  if (r.includes('master'))      return '#FF8C00'
  if (r.includes('candidate'))   return '#FF8C00'
  if (r.includes('expert'))      return '#AA00AA'
  if (r.includes('specialist'))  return '#03A89E'
  if (r.includes('pupil'))       return '#77FF77'
  return '#808080'
}

// ── Stars display ────────────────────────────────────────────────────────────
function Stars({ count = 0, color = '#B45309' }) {
  return (
    <span style={{ color, fontSize: '1.1rem', letterSpacing: 2 }}>
      {'★'.repeat(Math.max(0, count))}{'☆'.repeat(Math.max(0, 7 - count))}
    </span>
  )
}

// ── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 20px', textAlign: 'center', minWidth: 100
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent || 'var(--fg)' }}>{value ?? '—'}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    </div>
  )
}

// ── Dark tooltip for recharts ─────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem' }}>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.stroke, fontWeight: 600 }}>{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  )
}

// ── Rating History Chart ──────────────────────────────────────────────────────
function RatingHistory({ snapshots, color }) {
  if (!snapshots?.length) return (
    <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', padding: '40px 0', fontSize: '0.85rem' }}>
      No rating history yet — check back after the nightly sync
    </div>
  )
  const data = snapshots.map(s => ({ date: String(s.date).slice(5), rating: s.rating }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<DarkTooltip />} />
        <Line type="monotone" dataKey="rating" stroke={color} strokeWidth={2} dot={data.length <= 3} name="Rating" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Contest History Table ─────────────────────────────────────────────────────
function ContestTable({ contests, platform, color }) {
  if (!contests?.length) return (
    <div style={{ textAlign: 'center', color: 'var(--fg-subtle)', padding: '32px 0', fontSize: '0.85rem' }}>
      No contest history recorded yet
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--fg-subtle)', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', fontWeight: 500 }}>Contest</th>
            <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>Rank</th>
            {platform === 'leetcode'   && <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>Solved</th>}
            {platform !== 'leetcode'   && <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>Rating</th>}
            <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'right' }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {contests.map((c, i) => {
            const change = platform === 'leetcode'
              ? null
              : c.rating_change ?? (c.new_rating - c.old_rating)
            const title  = c.contest_title || c.contest_name || c.contest_code
            const rating = platform === 'leetcode'
              ? Math.round(c.rating_after_contest || 0)
              : c.new_rating || c.rating_after_contest
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '9px 12px', color: 'var(--fg)' }}>{title}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--fg-muted)' }}>#{c.rank_achieved?.toLocaleString()}</td>
                {platform === 'leetcode'
                  ? <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--fg-muted)' }}>{c.problems_solved}</td>
                  : <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--fg-muted)' }}>{rating}</td>
                }
                {change != null
                  ? <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: change >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {change >= 0 ? '+' : ''}{change}
                    </td>
                  : <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--fg-subtle)' }}>—</td>
                }
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <h3 className="card-title">{title}</h3>
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PlatformProfilePage() {
  const { platform } = useParams()
  const navigate     = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const meta = META[platform] || META.leetcode

  useEffect(() => {
    setLoading(true); setError(null)
    analyticsAPI.platformDetail(platform)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Could not load profile'))
      .finally(() => setLoading(false))
  }, [platform])

  return (
    <>
      <Header
        title={`${meta.label} Profile`}
        breadcrumb="Dashboard"
      />
      <div className="page">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        {loading && (
          <div className="loading-center"><div className="spinner" /> Loading {meta.label} profile…</div>
        )}

        {error && (
          <div className="msg msg-error">
            <span>{error}</span>
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Hero header ─────────────────────────────────────────── */}
            <div style={{
              background: `linear-gradient(135deg, ${meta.bg}, var(--card))`,
              border: `1px solid ${meta.color}33`,
              borderRadius: 16, padding: '28px 32px', marginBottom: 24,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              flexWrap: 'wrap', gap: 16
            }}>
              {/* Left: name + handle */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', fontWeight: 800, color: '#000', flexShrink: 0
                  }}>
                    {meta.label[0]}
                  </span>
                  <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg)', margin: 0 }}>
                      @{data.base.username}
                    </h1>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                      color: meta.color
                    }}>
                      {meta.label}
                      {platform === 'codeforces' && data.detail.current_rank
                        ? ` · ` : ''
                      }
                      {platform === 'codeforces' && (
                        <span style={{ color: cfRankColor(data.detail.current_rank) }}>
                          {data.detail.current_rank}
                        </span>
                      )}
                      {platform === 'codechef' && data.detail.current_division
                        ? ` · ${data.detail.current_division}`
                        : ''
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: open on platform button */}
              <a
                href={meta.url(data.base.username)}
                target="_blank" rel="noopener noreferrer"
                className="btn btn-sm"
                style={{
                  background: meta.color, color: '#000', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none'
                }}
              >
                <ExternalLink size={13} /> Open on {meta.label}
              </a>
            </div>

            {/* ── Platform-specific content ────────────────────────────── */}
            {platform === 'leetcode' && <LeetCodeProfile data={data} meta={meta} />}
            {platform === 'codeforces' && <CodeforcesProfile data={data} meta={meta} />}
            {platform === 'codechef'   && <CodeChefProfile   data={data} meta={meta} />}
            {platform === 'hackerrank' && <HackerRankProfile data={data} meta={meta} />}
          </>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LeetCode
// ─────────────────────────────────────────────────────────────────────────────
function LeetCodeProfile({ data, meta }) {
  const { base, detail, contests, snapshots } = data
  const easy   = base.easy_solved   || 0
  const medium = base.medium_solved || 0
  const hard   = base.hard_solved   || 0
  const total  = base.total_solved  || 0

  const diffData = [
    { name: 'Easy',   value: easy,   fill: '#00B8A3' },
    { name: 'Medium', value: medium, fill: '#FFC01E' },
    { name: 'Hard',   value: hard,   fill: '#FF375F' },
  ]

  return (
    <>
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatChip label="Problems Solved"    value={total}                                            accent={meta.color} />
        <StatChip label="Contest Rating"     value={Math.round(detail.contest_rating || 0) || '—'}   accent={meta.color} />
        <StatChip label="Global Rank"        value={detail.global_ranking ? `#${detail.global_ranking.toLocaleString()}` : '—'} />
        <StatChip label="Top %"             value={detail.top_percentage  ? `${Number(detail.top_percentage).toFixed(1)}%` : '—'} />
        <StatChip label="Easy"  value={easy}   accent="#00B8A3" />
        <StatChip label="Medium" value={medium} accent="#FFC01E" />
        <StatChip label="Hard"  value={hard}   accent="#FF375F" />
      </div>

      {/* Difficulty breakdown bar */}
      <Section title="Problem Breakdown by Difficulty" icon={<Target size={15} color={meta.color} />}>
        {total > 0 ? (
          <>
            <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {diffData.map(d => d.value > 0 && (
                <div key={d.name} style={{ flex: d.value, background: d.fill, transition: 'flex 0.5s ease' }} title={`${d.name}: ${d.value}`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {diffData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill, display: 'inline-block' }} />
                  <span style={{ color: 'var(--fg-muted)' }}>{d.name}:</span>
                  <span style={{ fontWeight: 700, color: d.fill }}>{d.value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--fg-subtle)', fontSize: '0.85rem' }}>No problems solved yet</p>
        )}
      </Section>

      {/* Activity Heatmap */}
      <ActivityHeatmap calendarJson={detail.contribution_calendar} />

      {/* Rating history */}
      <Section title="Rating History" icon={<TrendingUp size={15} color={meta.color} />}>
        <RatingHistory snapshots={snapshots} color={meta.color} />
      </Section>

      {/* Contest history */}
      <Section title={`Contest History (${contests.length})`} icon={<Trophy size={15} color={meta.color} />}>
        <ContestTable contests={contests} platform="leetcode" color={meta.color} />
      </Section>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Codeforces
// ─────────────────────────────────────────────────────────────────────────────
function CodeforcesProfile({ data, meta }) {
  const { base, detail, contests, snapshots } = data
  const rankColor = cfRankColor(detail.current_rank || '')

  const tiers = [
    { label: '< 1200',      value: detail.solved_rating_under_1200 || 0, color: '#808080' },
    { label: '1200–1599',   value: detail.solved_rating_1200_1599  || 0, color: '#77FF77' },
    { label: '1600–1899',   value: detail.solved_rating_1600_1899  || 0, color: '#03A89E' },
    { label: '1900–2199',   value: detail.solved_rating_1900_2199  || 0, color: '#AA00AA' },
    { label: '2200+',       value: detail.solved_rating_above_2200 || 0, color: '#FF8C00' },
  ]

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatChip label="Current Rating" value={detail.current_rating} accent={rankColor} />
        <StatChip label="Max Rating"     value={detail.max_rating}     accent={meta.color} />
        <StatChip label="Current Rank"   value={detail.current_rank}   accent={rankColor} />
        <StatChip label="Max Rank"       value={detail.max_rank} />
        <StatChip label="Problems Solved" value={base.total_solved} accent={meta.color} />
        <StatChip label="Contribution"   value={detail.contribution} />
      </div>

      {/* Solved by rating tier */}
      <Section title="Problems by Rating Tier" icon={<Code2 size={15} color={meta.color} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tiers.map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 80, fontSize: '0.75rem', color: 'var(--fg-muted)', flexShrink: 0 }}>{t.label}</span>
              <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, (t.value / (base.total_solved || 1)) * 100)}%`,
                  height: '100%', background: t.color, borderRadius: 4, transition: 'width 0.5s ease'
                }} />
              </div>
              <span style={{ width: 36, fontSize: '0.8rem', fontWeight: 700, color: t.color, textAlign: 'right' }}>{t.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Rating History" icon={<TrendingUp size={15} color={meta.color} />}>
        <RatingHistory snapshots={snapshots} color={rankColor} />
      </Section>

      <Section title={`Contest History (${contests.length})`} icon={<Trophy size={15} color={meta.color} />}>
        <ContestTable contests={contests} platform="codeforces" color={meta.color} />
      </Section>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CodeChef
// ─────────────────────────────────────────────────────────────────────────────
function CodeChefProfile({ data, meta }) {
  const { base, detail, contests, snapshots } = data
  const starCount = parseInt(detail.stars_string) || 0

  return (
    <>
      {/* Stars */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
      }}>
        <Stars count={starCount} color={meta.color} />
        <span style={{ fontSize: '0.8rem', color: 'var(--fg-subtle)' }}>{detail.stars_string || '1★'} · {detail.current_division || 'Div 4'}</span>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatChip label="Current Rating"  value={detail.current_rating}  accent={meta.color} />
        <StatChip label="Highest Rating"  value={detail.highest_rating}  accent={meta.color} />
        <StatChip label="Global Rank"     value={detail.global_rank  ? `#${detail.global_rank}` : '—'} />
        <StatChip label="Country Rank"    value={detail.country_rank ? `#${detail.country_rank}` : '—'} />
        <StatChip label="Total Solved"    value={detail.total_solved  || base.total_solved} accent={meta.color} />
      </div>

      <Section title="Problems by Category" icon={<Code2 size={15} color={meta.color} />}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Starters',  value: detail.starters_solved  || 0, color: meta.color },
            { label: 'Practice',  value: detail.practice_solved  || 0, color: '#10B981' },
            { label: 'Peer',      value: detail.peer_solved      || 0, color: '#8B5CF6' },
          ].map(c => (
            <div key={c.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>{c.label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Rating History" icon={<TrendingUp size={15} color={meta.color} />}>
        <RatingHistory snapshots={snapshots} color={meta.color} />
      </Section>

      <Section title={`Contest History (${contests.length})`} icon={<Trophy size={15} color={meta.color} />}>
        <ContestTable contests={contests} platform="codechef" color={meta.color} />
      </Section>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HackerRank
// ─────────────────────────────────────────────────────────────────────────────
function HackerRankProfile({ data, meta }) {
  const { base, detail, submissions, snapshots } = data

  const domains = [
    { label: 'Problem Solving', stars: detail.problem_solving_stars, score: detail.problem_solving_score },
    { label: 'C++',    stars: detail.cpp_stars    },
    { label: 'Java',   stars: detail.java_stars   },
    { label: 'Python', stars: detail.python_stars },
    { label: 'SQL',    stars: detail.sql_stars    },
  ].filter(d => d.stars > 0)

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatChip label="Total Points" value={Math.round(detail.total_points || 0)} accent={meta.color} />
        <StatChip label="Global Rank"  value={detail.global_rank ? `#${detail.global_rank}` : '—'} />
        {detail.problem_solving_score > 0 && (
          <StatChip label="PS Score" value={detail.problem_solving_score} accent={meta.color} />
        )}
      </div>

      {/* Domain stars */}
      {domains.length > 0 && (
        <Section title="Domain Stars" icon={<Star size={15} color={meta.color} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {domains.map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ width: 120, fontSize: '0.82rem', color: 'var(--fg-muted)' }}>{d.label}</span>
                <Stars count={d.stars} color={meta.color} />
                <span style={{ fontSize: '0.8rem', color: 'var(--fg-subtle)' }}>{d.stars} / 5</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Recent submissions */}
      {submissions.length > 0 && (
        <Section title={`Recent Submissions (${submissions.length})`} icon={<Flame size={15} color={meta.color} />}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--fg-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Challenge</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Language</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 500 }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--fg)' }}>{s.challenge_name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--fg-muted)' }}>{s.language}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                        background: s.status === 'Accepted' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color:      s.status === 'Accepted' ? '#10B981'               : '#EF4444'
                      }}>{s.status}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--fg-subtle)', fontSize: '0.75rem' }}>
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Points History" icon={<TrendingUp size={15} color={meta.color} />}>
        <RatingHistory snapshots={snapshots} color={meta.color} />
      </Section>
    </>
  )
}
