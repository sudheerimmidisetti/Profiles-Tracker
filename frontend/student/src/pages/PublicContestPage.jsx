// PublicContestPage.jsx — no auth required, read-only — LIGHT MODE
import { useState, useEffect, useCallback } from 'react'
import { contestsAPI } from '../api/api'
import { Share2, ExternalLink, Clock, Trophy, ChevronDown, Code2 } from 'lucide-react'
import lcLogo from '../assets/leetcode.svg'
import cfLogo from '../assets/codeforces.svg'
import ccLogo from '../assets/codechef.svg'

const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#d97706', bg: '#fffbeb', border: '#fde68a', logo: lcLogo },
  codeforces: { label: 'Codeforces', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', logo: cfLogo },
  codechef:   { label: 'CodeChef',   color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', logo: ccLogo },
}

const CSS = `
  .pub-con-root {
    min-height: 100vh;
    background: #f8fafc;
    color: #0f172a;
    font-family: 'Inter', 'Outfit', system-ui, sans-serif;
  }
  .pub-con-root, .pub-con-root * {
    --bg: #f8fafc; --surface: #ffffff; --border: #e2e8f0;
    --fg: #0f172a; --fg-muted: #64748b; --primary: #6366f1;
  }
  .pub-con-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; height: 64px;
    background: #fff; border-bottom: 1px solid #e2e8f0;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .pub-con-brand { display: flex; align-items: center; gap: 12px; }
  .pub-con-logo {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem; font-weight: 900; color: #fff; letter-spacing: -.04em; flex-shrink: 0;
  }
  .pub-con-name { font-size: 0.95rem; font-weight: 700; color: #0f172a; letter-spacing: -.02em; }
  .pub-con-sub  { font-size: 0.67rem; color: #94a3b8; margin-top: 1px; }
  .pub-con-share {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 15px; border-radius: 9px;
    border: 1.5px solid #e2e8f0; background: #f8fafc; color: #475569;
    font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all .15s;
  }
  .pub-con-share:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
  .pub-con-share.copied { border-color: #22c55e; color: #16a34a; background: #f0fdf4; }

  .pub-con-body { max-width: 900px; margin: 0 auto; padding: 40px 28px 80px; }

  .pub-con-page-title { font-size: 1.5rem; font-weight: 900; letter-spacing: -.03em; color: #0f172a; margin: 0 0 4px; }
  .pub-con-page-sub   { color: #94a3b8; font-size: 0.82rem; margin: 0 0 28px; }

  /* Filter bar */
  .pub-con-filters {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 10px 14px; border-radius: 14px;
    background: #fff; border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    margin-bottom: 28px;
  }
  .pub-con-plat-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 20px; cursor: pointer;
    font-size: 0.78rem; font-weight: 500;
    border: 1.5px solid #e2e8f0; background: #f8fafc; color: #64748b;
    transition: all .15s;
  }
  .pub-con-plat-pill.active-all  { border-color: #c7d2fe; background: #eef2ff; color: #6366f1; font-weight: 700; }
  .pub-con-plat-pill.active-lc   { border-color: #fde68a; background: #fffbeb; color: #d97706; font-weight: 700; }
  .pub-con-plat-pill.active-cf   { border-color: #bfdbfe; background: #eff6ff; color: #2563eb; font-weight: 700; }
  .pub-con-plat-pill.active-cc   { border-color: #bbf7d0; background: #f0fdf4; color: #16a34a; font-weight: 700; }
  .pub-con-plat-pill:hover:not([class*=active]) { border-color: #cbd5e1; color: #334155; background: #f1f5f9; }
  .pub-con-divider { width: 1px; height: 20px; background: #e2e8f0; flex-shrink: 0; }
  .pub-con-week-select {
    padding: 7px 12px; border-radius: 10px; flex-shrink: 0;
    border: 1.5px solid #e2e8f0; background: #f8fafc; color: #475569;
    font-size: 0.78rem; font-weight: 600; cursor: pointer; outline: none;
  }
  .pub-con-week-select:focus { border-color: #6366f1; }

  /* Section label */
  .pub-con-section-label {
    display: flex; align-items: center; gap: 7px; margin-bottom: 12px;
  }
  .pub-con-section-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .pub-con-section-text {
    font-size: 0.68rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: .1em;
  }

  /* Contest card */
  .pub-con-card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
    overflow: hidden; transition: box-shadow .15s, border-color .15s;
    margin-bottom: 8px;
  }
  .pub-con-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); border-color: #cbd5e1; }
  .pub-con-card-row {
    padding: 14px 18px; display: flex; align-items: center; gap: 12px;
  }
  .pub-con-plat-icon {
    width: 38px; height: 38px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .pub-con-plat-label {
    font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px;
  }
  .pub-con-contest-name {
    font-weight: 700; font-size: 0.9rem; letter-spacing: -.02em; color: #0f172a;
  }
  .pub-con-time {
    font-size: 0.7rem; color: #94a3b8;
    display: flex; align-items: center; gap: 5px; margin-top: 4px;
  }
  .pub-con-status-past {
    padding: 3px 9px; border-radius: 20px; font-size: 0.65rem; font-weight: 700; white-space: nowrap; flex-shrink: 0;
    background: #f1f5f9; border: 1px solid #e2e8f0; color: #94a3b8;
  }
  .pub-con-status-up {
    padding: 3px 9px; border-radius: 20px; font-size: 0.65rem; font-weight: 700; white-space: nowrap; flex-shrink: 0;
    background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a;
  }
  .pub-con-results-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 13px; border-radius: 9px; flex-shrink: 0;
    border: 1.5px solid #e2e8f0; background: #f8fafc; color: #64748b;
    font-size: 0.73rem; font-weight: 600; cursor: pointer; transition: all .15s;
  }
  .pub-con-results-btn:hover, .pub-con-results-btn.open {
    border-color: #c7d2fe; background: #eef2ff; color: #6366f1;
  }
  .pub-con-register-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 13px; border-radius: 9px; flex-shrink: 0;
    border: 1.5px solid #bbf7d0; background: #f0fdf4; color: #16a34a;
    font-size: 0.73rem; font-weight: 600; text-decoration: none; transition: all .15s;
  }
  .pub-con-register-btn:hover { background: #dcfce7; }

  /* Table */
  .pub-con-table-wrap { border-top: 1px solid #f1f5f9; padding: 0 18px 16px; overflow-x: auto; }
  .pub-con-table { width: 100%; border-collapse: collapse; font-size: 0.76rem; margin-top: 12px; }
  .pub-con-table th {
    padding: 6px 10px; text-align: left; font-weight: 700;
    font-size: 0.62rem; color: #94a3b8;
    text-transform: uppercase; letter-spacing: .07em;
    border-bottom: 1px solid #f1f5f9; white-space: nowrap;
  }
  .pub-con-table td { padding: 8px 10px; border-bottom: 1px solid #f8fafc; }
  .pub-con-table tr:last-child td { border-bottom: none; }
`

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric',
    month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST'
}

function ContestCard({ contest }) {
  const [open, setOpen]               = useState(false)
  const [participants, setParticipants] = useState(null)
  const [loading, setLoading]          = useState(false)
  const p   = PLAT[contest.platform] || {}
  const isPast = contest.status === 'past'

  const platActiveClass = {
    leetcode: 'active-lc', codeforces: 'active-cf', codechef: 'active-cc',
  }[contest.platform] || ''

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
    <div className="pub-con-card">
      <div className="pub-con-card-row">
        <div className="pub-con-plat-icon" style={{ background: p.bg }}>
          {p.logo && <img src={p.logo} alt={p.label} style={{ width: 20, height: 20, objectFit: 'contain' }}/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pub-con-plat-label" style={{ color: p.color }}>{p.label}</div>
          <div className="pub-con-contest-name">{contest.name}</div>
          <div className="pub-con-time"><Clock size={9}/> {fmtDate(contest.startTime)}</div>
        </div>
        <div className={isPast ? 'pub-con-status-past' : 'pub-con-status-up'}>
          {isPast ? 'Past' : 'Upcoming'}
        </div>
        {isPast ? (
          <button onClick={loadParticipants} className={`pub-con-results-btn${open ? ' open' : ''}`}>
            <Trophy size={11}/> Results
            <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.15s' }}/>
          </button>
        ) : (
          <a href={contest.url} target="_blank" rel="noopener" className="pub-con-register-btn">
            <ExternalLink size={11}/> Register
          </a>
        )}
      </div>

      {open && isPast && (
        <div className="pub-con-table-wrap">
          {loading ? (
            <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>Loading…</div>
          ) : !participants || participants.length === 0 ? (
            <div style={{ padding: '14px 0', color: '#94a3b8', fontSize: '0.8rem' }}>No participants tracked.</div>
          ) : (
            <table className="pub-con-table">
              <thead>
                <tr>
                  {['#','Name','Roll','Branch','Handle','Global Rank','Solved','Δ Rating'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {participants.slice(0, 25).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: '#94a3b8' }}>{r.cohortRank}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.name}</td>
                    <td style={{ color: '#64748b' }}>{r.rollNumber}</td>
                    <td style={{ color: '#64748b' }}>{r.branch}</td>
                    <td style={{ color: '#6366f1', fontWeight: 600 }}>{r.handle}</td>
                    <td style={{ fontWeight: 600 }}>{r.globalRank ?? '—'}</td>
                    <td>{r.problemsSolved ?? '—'}</td>
                    <td style={{ fontWeight: 700, color: r.ratingChange == null ? '#94a3b8' : r.ratingChange >= 0 ? '#16a34a' : '#dc2626' }}>
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

  const platActiveClass = { all: 'active-all', leetcode: 'active-lc', codeforces: 'active-cf', codechef: 'active-cc' }

  return (
    <div className="pub-con-root">
      <style>{CSS}</style>

      {/* Header */}
      <header className="pub-con-header">
        <div className="pub-con-brand">
          <div className="pub-con-logo">CP</div>
          <div>
            <div className="pub-con-name">ACET Coding Tracker</div>
            <div className="pub-con-sub">Contest Results — Public View</div>
          </div>
        </div>
        <button onClick={copyLink} className={`pub-con-share${copied ? ' copied' : ''}`}>
          <Share2 size={13}/>
          {copied ? '✓ Copied!' : 'Share'}
        </button>
      </header>

      {/* Body */}
      <div className="pub-con-body">
        <h1 className="pub-con-page-title">Contest Results</h1>
        <p className="pub-con-page-sub">Competitive programming contest performance of registered students.</p>

        {/* Filter bar */}
        <div className="pub-con-filters">
          {['all', 'leetcode', 'codeforces', 'codechef'].map(k => (
            <button
              key={k}
              className={`pub-con-plat-pill${platform === k ? ' ' + platActiveClass[k] : ''}`}
              onClick={() => setPlatform(k)}
            >
              {PLAT[k]?.logo && (
                <img src={PLAT[k].logo} alt="" style={{ width: 13, height: 13, objectFit: 'contain' }}/>
              )}
              {k === 'all' ? 'All Platforms' : PLAT[k]?.label}
            </button>
          ))}
          <div className="pub-con-divider"/>
          <select
            value={week}
            onChange={e => setWeek(Number(e.target.value))}
            className="pub-con-week-select"
          >
            {weekOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div className="pub-con-section-label">
                  <div className="pub-con-section-dot" style={{ background: '#22c55e', boxShadow: '0 0 5px #22c55e88' }}/>
                  <span className="pub-con-section-text" style={{ color: '#16a34a' }}>Upcoming — {weekLabel}</span>
                </div>
                {upcoming.map((c, i) => <ContestCard key={i} contest={c}/>)}
              </div>
            )}
            {past.length > 0 && (
              <div>
                <div className="pub-con-section-label">
                  <div className="pub-con-section-dot" style={{ background: '#cbd5e1' }}/>
                  <span className="pub-con-section-text" style={{ color: '#94a3b8' }}>Past — {weekLabel}</span>
                </div>
                {past.map((c, i) => <ContestCard key={i} contest={c}/>)}
              </div>
            )}
            {upcoming.length === 0 && past.length === 0 && (
              <div style={{ padding: '64px 0', textAlign: 'center' }}>
                <Code2 size={36} style={{ color: '#e2e8f0', marginBottom: 12 }}/>
                <div style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No contests found for this period.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
