// PublicContestPage.jsx — no auth required, read-only contest view
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { contestsAPI } from '../api/api'
import { Share2, ExternalLink, Clock, Trophy, ChevronDown, Code2 } from 'lucide-react'
import lcLogo from '../assets/leetcode.svg'
import cfLogo from '../assets/codeforces.svg'
import ccLogo from '../assets/codechef.svg'

const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#f89f1b', bg: 'rgba(248,159,27,.13)', logo: lcLogo },
  codeforces: { label: 'Codeforces', color: '#1a8cff', bg: 'rgba(26,140,255,.13)', logo: cfLogo },
  codechef:   { label: 'CodeChef',   color: '#22c55e', bg: 'rgba(34,197,94,.13)',  logo: ccLogo },
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric',
    month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST'
}

function ContestCard({ contest }) {
  const [open, setOpen] = useState(false)
  const [participants, setParticipants] = useState(null)
  const [loading, setLoading] = useState(false)
  const p = PLAT[contest.platform] || {}
  const isPast = contest.status === 'past'

  async function loadParticipants() {
    if (!isPast || participants) { setOpen(v => !v); return }
    setLoading(true); setOpen(true)
    try {
      const cid = contest._contestIds ? contest._contestIds.join(',') : contest.contestId
      const r = await contestsAPI.publicParticipants(contest.platform, cid)
      setParticipants(r.data.data || [])
    } catch { setParticipants([]) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      background: '#0f0f1c', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, overflow: 'hidden', transition: 'border-color .15s',
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Platform icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: p.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {p.logo && <img src={p.logo} alt={p.label} style={{ width: 20, height: 20, objectFit: 'contain' }}/>}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.62rem', fontWeight: 700, color: p.color,
            textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3,
          }}>{p.label}</div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '-.02em', color: '#f1f5f9' }}>
            {contest.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Clock size={9}/> {fmtDate(contest.startTime)}
          </div>
        </div>

        {/* Status chip */}
        <div style={{
          padding: '3px 9px', borderRadius: 20,
          fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap',
          background: isPast ? 'rgba(100,116,139,0.1)' : 'rgba(34,197,94,0.1)',
          color: isPast ? '#64748b' : '#22c55e',
          border: `1px solid ${isPast ? 'rgba(100,116,139,0.15)' : 'rgba(34,197,94,0.2)'}`,
        }}>
          {isPast ? 'Past' : 'Upcoming'}
        </div>

        {/* Action button */}
        {isPast ? (
          <button onClick={loadParticipants} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.1)',
            background: open ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)',
            color: open ? '#a5b4fc' : '#94a3b8',
            fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
          }}>
            <Trophy size={11}/> Results
            <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }}/>
          </button>
        ) : (
          <a href={contest.url} target="_blank" rel="noopener" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, flexShrink: 0,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.22)',
            color: '#a5b4fc',
            fontSize: '0.73rem', fontWeight: 600, textDecoration: 'none',
          }}>
            <ExternalLink size={11}/> Register
          </a>
        )}
      </div>

      {/* Participants dropdown */}
      {open && isPast && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0 18px 16px' }}>
          {loading ? (
            <div style={{ padding: '16px 0', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>Loading…</div>
          ) : !participants || participants.length === 0 ? (
            <div style={{ padding: '14px 0', color: '#64748b', fontSize: '0.8rem' }}>No participants tracked.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', marginTop: 12 }}>
                <thead>
                  <tr>
                    {['#','Name','Roll','Branch','Handle','Global Rank','Solved','Δ Rating'].map(h => (
                      <th key={h} style={{
                        padding: '6px 10px', textAlign: 'left', fontWeight: 700,
                        fontSize: '0.62rem', color: '#475569',
                        textTransform: 'uppercase', letterSpacing: '.07em',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {participants.slice(0, 25).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#475569' }}>{r.cohortRank}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#e2e8f0' }}>{r.name}</td>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.rollNumber}</td>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.branch}</td>
                      <td style={{ padding: '7px 10px', color: '#818cf8', fontWeight: 600 }}>{r.handle}</td>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: '#e2e8f0' }}>{r.globalRank ?? '—'}</td>
                      <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{r.problemsSolved ?? '—'}</td>
                      <td style={{
                        padding: '7px 10px', fontWeight: 700,
                        color: r.ratingChange == null ? '#475569' : r.ratingChange >= 0 ? '#22c55e' : '#ef4444',
                      }}>
                        {r.ratingChange != null ? (r.ratingChange >= 0 ? '+' : '') + r.ratingChange : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Platform filter pill component ─────────────────────────────── */
function PlatPill({ id, active, onClick }) {
  const p = PLAT[id]
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 15px', borderRadius: 24, cursor: 'pointer',
      border: `1.5px solid ${active ? (p ? p.color + '50' : 'rgba(99,102,241,0.5)') : 'rgba(255,255,255,0.08)'}`,
      background: active ? (p ? p.bg : 'rgba(99,102,241,0.1)') : 'rgba(255,255,255,0.03)',
      color: active ? (p ? p.color : '#a5b4fc') : '#64748b',
      fontSize: '0.78rem', fontWeight: active ? 700 : 500,
      transition: 'all .15s',
    }}>
      {p?.logo && <img src={p.logo} alt="" style={{ width: 13, height: 13, objectFit: 'contain' }}/>}
      {id === 'all' ? 'All Platforms' : p?.label}
    </button>
  )
}

/* ── Page ─────────────────────────────────────────────────────────── */
export default function PublicContestPage() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [platform, setPlatform] = useState('all')
  const [week,     setWeek]     = useState(0)
  const [copied,   setCopied]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await contestsAPI.publicList(platform, week)
      setData(r.data.data)
    } catch { setData({ upcoming: [], past: [] }) }
    finally { setLoading(false) }
  }, [platform, week])

  useEffect(() => { load() }, [load])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2200)
    })
  }

  const upcoming = data?.upcoming || []
  const past     = data?.past     || []
  const weekLabel = week === 0 ? 'This Week' : week === -1 ? 'Last Week' : `${Math.abs(week)} weeks ago`

  const weekOptions = [
    { v: 0, l: 'This Week' }, { v: -1, l: 'Last Week' },
    { v: -2, l: '2 Weeks Ago' }, { v: -3, l: '3 Weeks Ago' },
    { v: -4, l: '4 Weeks Ago' },
  ]

  const SectionLabel = ({ color, text }) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      marginBottom: 12,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 5px ${color}` }}/>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color }}>{text}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080810', color: '#e2e8f0', fontFamily: "'Inter','Outfit',system-ui,sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 60,
        background: 'rgba(10,10,22,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg,#6366f1 0%,#a855f7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.78rem', fontWeight: 900, color: '#fff', letterSpacing: '-.04em',
            flexShrink: 0,
          }}>CP</div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-.02em', color: '#f1f5f9' }}>
              ACET Coding Tracker
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1, marginTop: 2 }}>
              Contest Results — Public View
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <button onClick={copyLink} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
            color: copied ? '#22c55e' : '#94a3b8',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            transition: 'all .15s',
          }}>
            <Share2 size={13}/>
            {copied ? '✓ Copied!' : 'Share'}
          </button>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 13px', borderRadius: 8,
            background: '#6366f1', color: '#fff',
            fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
          }}>
            <ExternalLink size={13}/> Login
          </Link>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-.04em',
            background: 'linear-gradient(135deg,#f1f5f9 30%,#818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0 0 4px',
          }}>Contest Results</h1>
          <p style={{ color: '#475569', fontSize: '0.82rem', margin: 0 }}>
            This week's competitive programming contests from registered students.
          </p>
        </div>

        {/* ── Filter bar ────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 28, flexWrap: 'wrap',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
        }}>
          {/* Platform pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {['all','leetcode','codeforces','codechef'].map(k => (
              <PlatPill key={k} id={k} active={platform === k} onClick={() => setPlatform(k)}/>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}/>

          {/* Week select */}
          <select
            value={week}
            onChange={e => setWeek(Number(e.target.value))}
            style={{
              padding: '7px 12px', borderRadius: 10, flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#0f0f1c', color: '#94a3b8',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', outline: 'none',
            }}
          >
            {weekOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }}/>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <SectionLabel color="#22c55e" text={`Upcoming — ${weekLabel}`}/>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcoming.map((c, i) => <ContestCard key={i} contest={c}/>)}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <SectionLabel color="#475569" text={`Past — ${weekLabel}`}/>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {past.map((c, i) => <ContestCard key={i} contest={c}/>)}
                </div>
              </div>
            )}
            {upcoming.length === 0 && past.length === 0 && (
              <div style={{ padding: '64px 0', textAlign: 'center' }}>
                <Code2 size={36} style={{ color: '#1e293b', marginBottom: 12 }}/>
                <div style={{ color: '#475569', fontSize: '0.88rem' }}>No contests found for this period.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
