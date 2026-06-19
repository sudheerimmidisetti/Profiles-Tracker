// PublicContestPage.jsx — no auth required, read-only contest view
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { contestsAPI } from '../api/api'
import { Share2, ExternalLink, Clock, Trophy, ChevronDown } from 'lucide-react'
import lcLogo from '../assets/leetcode.svg'
import cfLogo from '../assets/codeforces.svg'
import ccLogo from '../assets/codechef.svg'

const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#f89f1b', bg: 'rgba(248,159,27,.15)', logo: lcLogo },
  codeforces: { label: 'Codeforces', color: '#1a8cff', bg: 'rgba(26,140,255,.15)', logo: cfLogo },
  codechef:   { label: 'CodeChef',   color: '#22c55e', bg: 'rgba(34,197,94,.15)',  logo: ccLogo },
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
    setLoading(true)
    setOpen(true)
    try {
      const cid = contest._contestIds ? contest._contestIds.join(',') : contest.contestId
      const r = await contestsAPI.publicParticipants(contest.platform, cid)
      setParticipants(r.data.data || [])
    } catch { setParticipants([]) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden',
      transition: 'border-color .15s',
    }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Platform badge */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: p.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {p.logo && <img src={p.logo} alt={p.label} style={{ width: 20, height: 20, objectFit: 'contain' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, color: p.color,
            textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3,
          }}>{p.label}</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-.02em' }}>{contest.name}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Clock size={10}/> {fmtDate(contest.startTime)}
          </div>
        </div>

        {/* Status chip */}
        <div style={{
          padding: '4px 10px', borderRadius: 20,
          fontSize: '0.68rem', fontWeight: 700,
          background: isPast ? 'rgba(100,116,139,.12)' : 'rgba(34,197,94,.12)',
          color: isPast ? '#64748b' : '#22c55e',
        }}>
          {isPast ? 'Past' : 'Upcoming'}
        </div>

        {isPast ? (
          <button onClick={loadParticipants} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8,
            border: '1.5px solid var(--border)', background: 'var(--bg)',
            color: 'var(--fg-muted)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          }}>
            <Trophy size={12}/> Results
            <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }} />
          </button>
        ) : (
          <a href={contest.url} target="_blank" rel="noopener" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(99,102,241,.1)', color: 'var(--primary)',
            border: '1.5px solid rgba(99,102,241,.25)',
            fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
          }}>
            <ExternalLink size={12}/> Register
          </a>
        )}
      </div>

      {/* Participants dropdown */}
      {open && isPast && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0 20px 16px' }}>
          {loading ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>Loading…</div>
          ) : !participants || participants.length === 0 ? (
            <div style={{ padding: '14px 0', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>No participants tracked.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginTop: 12 }}>
              <thead>
                <tr>
                  {['#','Name','Roll','Branch','Handle','Global Rank','Solved','Rating Δ'].map(h => (
                    <th key={h} style={{
                      padding: '6px 8px', textAlign: 'left', fontWeight: 700,
                      fontSize: '0.65rem', color: 'var(--fg-muted)', textTransform: 'uppercase',
                      letterSpacing: '.06em', borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participants.slice(0, 25).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 700, color: 'var(--fg-muted)' }}>{r.cohortRank}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--fg-muted)' }}>{r.rollNumber}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--fg-muted)' }}>{r.branch}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--primary)' }}>{r.handle}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 600 }}>{r.globalRank ?? '—'}</td>
                    <td style={{ padding: '7px 8px' }}>{r.problemsSolved ?? '—'}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 700,
                      color: r.ratingChange == null ? 'var(--fg-muted)' : r.ratingChange >= 0 ? '#22c55e' : '#ef4444',
                    }}>
                      {r.ratingChange != null ? (r.ratingChange >= 0 ? '+' : '') + r.ratingChange : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

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
      setCopied(true); setTimeout(() => setCopied(false), 2000)
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #0a0a12)',
      color: 'var(--fg, #e2e8f0)',
      fontFamily: "'Inter','Outfit',sans-serif",
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px', borderBottom: '1px solid var(--border, rgba(255,255,255,.08))',
        background: 'var(--surface, #13131f)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 900, color: '#fff',
          }}>CP</div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>ACET Coding Tracker</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>Contest Results</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyLink} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 9,
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--fg-muted)', fontSize: '0.77rem', fontWeight: 600, cursor: 'pointer',
          }}>
            <Share2 size={14}/> {copied ? 'Copied!' : 'Share'}
          </button>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 9,
            background: 'var(--primary, #6366f1)', color: '#fff',
            fontSize: '0.77rem', fontWeight: 600, textDecoration: 'none',
          }}>
            <ExternalLink size={14}/> Login
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 60px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {/* Platform pills */}
          {['all','leetcode','codeforces','codechef'].map(k => (
            <button key={k} onClick={() => setPlatform(k)} style={{
              padding: '7px 16px', borderRadius: 24, cursor: 'pointer',
              border: `1.5px solid ${platform === k ? 'var(--primary)' : 'var(--border)'}`,
              background: platform === k ? 'rgba(99,102,241,.1)' : 'var(--surface)',
              color: platform === k ? 'var(--primary)' : 'var(--fg-muted)',
              fontSize: '0.78rem', fontWeight: 600,
            }}>
              {k === 'all' ? 'All Platforms' : PLAT[k]?.label}
            </button>
          ))}

          <div style={{ marginLeft: 'auto' }}>
            <select value={week} onChange={e => setWeek(Number(e.target.value))} style={{
              padding: '7px 14px', borderRadius: 10,
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              color: 'var(--fg)', fontSize: '0.8rem', cursor: 'pointer', outline: 'none',
            }}>
              {weekOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-muted)' }}>Loading…</div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.08em', color: '#22c55e', marginBottom: 10 }}>
                  Upcoming — {weekLabel}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {upcoming.map((c, i) => <ContestCard key={i} contest={c} />)}
                </div>
              </>
            )}
            {past.length > 0 && (
              <>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.08em', color: 'var(--fg-muted)', marginBottom: 10 }}>
                  Past — {weekLabel}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {past.map((c, i) => <ContestCard key={i} contest={c} />)}
                </div>
              </>
            )}
            {upcoming.length === 0 && past.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-muted)' }}>
                No contests found for this week.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
