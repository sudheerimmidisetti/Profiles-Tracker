// frontend/student/src/components/ContestDetailPanel.jsx
// Slide-in panel showing per-contest problems, submissions, and code.
import { useState, useEffect, useCallback, useRef } from 'react'
import './ContestDetailPanel.css'
import api from '../api/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms < 1000)  return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function fmtMem(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtTime(sec) {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

// Normalize verdict from any platform to a short code
function normalizeVerdict(v) {
  if (!v) return 'PENDING'
  const u = v.toUpperCase()
  if (u === 'OK' || u === 'AC' || u === 'ACCEPTED') return 'AC'
  if (u.includes('WRONG'))  return 'WA'
  if (u.includes('TIME'))   return 'TLE'
  if (u.includes('MEMORY')) return 'MLE'
  if (u.includes('COMPIL') || u === 'CE') return 'CE'
  if (u.includes('RUNTIME') || u === 'RE') return 'RE'
  if (u.includes('PARTIAL')) return 'PARTIAL'
  if (u.includes('SKIPPED') || u === 'SKIP') return 'SKIP'
  return u.length <= 8 ? u : 'OTHER'
}

function verdictClass(v) {
  const n = normalizeVerdict(v)
  if (n === 'AC')      return 'cdp-verdict-ac'
  if (n === 'WA')      return 'cdp-verdict-wa'
  if (n === 'TLE')     return 'cdp-verdict-tle'
  if (n === 'MLE')     return 'cdp-verdict-mle'
  if (n === 'CE')      return 'cdp-verdict-ce'
  return 'cdp-verdict-none'
}

function platformColor(platform) {
  if (platform === 'codeforces') return '#1a8cff'
  if (platform === 'codechef')   return '#f89f1b'
  if (platform === 'leetcode')   return '#22c55e'
  return '#8b8fa8'
}

function platformLabel(platform) {
  if (platform === 'codeforces') return 'Codeforces'
  if (platform === 'codechef')   return 'CodeChef'
  if (platform === 'leetcode')   return 'LeetCode'
  return platform
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProblemsTab({ data }) {
  const { problems, solved, platform, contestId } = data

  if (!problems?.length) {
    return (
      <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', padding: '30px 0', textAlign: 'center' }}>
        {platform === 'leetcode'
          ? "Problem list loaded from LeetCode's public API."
          : 'No problem data available for this contest.'}
        {platform === 'leetcode' && problems?.length === 0 && (
          <div style={{ marginTop: 12 }}>
            <a className="cdp-platform-link" href={data.platformUrl} target="_blank" rel="noopener noreferrer">
              🔗 View on LeetCode
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="cdp-problems-grid">
      {problems.map((p, i) => {
        const key       = p.index || p.code || String(i + 1)
        const myResult  = solved?.[key] || {}
        const isAc      = myResult.accepted
        const attempts  = myResult.attempts || 0

        return (
          <div key={key} className="cdp-problem-row">
            {/* Index badge */}
            <div
              className="cdp-problem-index"
              style={{
                background: isAc
                  ? 'rgba(34,197,94,0.12)'
                  : attempts > 0
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(255,255,255,0.05)',
                color: isAc ? '#22c55e' : attempts > 0 ? '#ef4444' : 'var(--fg-muted)',
                border: `1px solid ${isAc
                  ? 'rgba(34,197,94,0.25)'
                  : attempts > 0
                    ? 'rgba(239,68,68,0.25)'
                    : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {key}
            </div>

            {/* Name + tags */}
            <div style={{ flex: 1 }}>
              <div className="cdp-problem-name">
                <a
                  href={p.url || (platform === 'leetcode' ? `https://leetcode.com/problems/${p.slug}` : '#')}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.color = platformColor(platform)}
                  onMouseLeave={e => e.target.style.color = 'inherit'}
                >
                  {p.name}
                </a>
              </div>
              <div className="cdp-tags">
                {p.difficulty && (
                  <span className={`cdp-tag cdp-diff-${p.difficulty.toLowerCase()}`}>
                    {p.difficulty}
                  </span>
                )}
                {p.points && <span className="cdp-tag">⚡ {p.points} pts</span>}
                {p.rating && <span className="cdp-tag">★ {p.rating}</span>}
                {(p.tags || []).slice(0, 3).map(t => (
                  <span key={t} className="cdp-tag">{t}</span>
                ))}
              </div>
            </div>

            {/* Verdict */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span className={`cdp-verdict-chip ${isAc ? 'cdp-verdict-ac' : attempts > 0 ? 'cdp-verdict-wa' : 'cdp-verdict-none'}`}>
                {isAc ? '✓ AC' : attempts > 0 ? `✗ ${attempts} att.` : '— Not tried'}
              </span>
              {myResult.points > 0 && (
                <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>
                  {myResult.points} pts
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SubmissionsTab({ data, onSelectSub, selectedSub }) {
  const { submissions, platform, contestId } = data

  if (!submissions?.length) {
    return (
      <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', padding: '30px 0', textAlign: 'center' }}>
        {platform === 'leetcode'
          ? 'LeetCode submission details require authentication. View your submissions directly on LeetCode.'
          : 'No submissions found for this contest.'}
        {platform === 'leetcode' && (
          <div style={{ marginTop: 12 }}>
            <a className="cdp-platform-link" href={data.platformUrl} target="_blank" rel="noopener noreferrer">
              🔗 View on LeetCode
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: 12 }}>
        {submissions.length} submission{submissions.length !== 1 ? 's' : ''} found
        {platform === 'codeforces' && ' · Click any row to view source code'}
      </p>
      <div className="cdp-table-wrap">
        <table className="cdp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Problem</th>
              <th>Verdict</th>
              <th>Language</th>
              <th>Time</th>
              <th>Memory</th>
              {platform === 'codeforces' && <th>Tests Passed</th>}
              <th>Submitted</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s, i) => {
              const vn = normalizeVerdict(s.verdict)
              const isSelected = selectedSub?.id === s.id
              return (
                <tr
                  key={s.id || i}
                  className={platform === 'codeforces' ? 'cdp-sub-row-clickable' : ''}
                  onClick={() => platform === 'codeforces' && onSelectSub(isSelected ? null : s)}
                  style={{
                    background: isSelected ? 'rgba(26,140,255,0.07)' : undefined,
                    outline: isSelected ? '1px solid rgba(26,140,255,0.2)' : undefined,
                  }}
                >
                  <td style={{ color: 'var(--fg-muted)', fontSize: '0.75rem' }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {s.problemIndex && <span style={{ color: 'var(--fg-muted)', marginRight: 4 }}>{s.problemIndex}.</span>}
                      {s.problemName || s.problemCode || '—'}
                    </div>
                  </td>
                  <td>
                    <span className={`cdp-verdict-chip ${verdictClass(s.verdict)}`}>
                      {vn}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{s.language || '—'}</td>
                  <td style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>{fmtMs(s.timeMs)}</td>
                  <td style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>{fmtMem(s.memoryBytes)}</td>
                  {platform === 'codeforces' && (
                    <td style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                      {s.passedTests != null ? s.passedTests : '—'}
                    </td>
                  )}
                  <td style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{fmtDate(s.timestamp)}</td>
                  <td>
                    <a
                      href={s.codeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: platformColor(platform), fontSize: '0.78rem', textDecoration: 'none', fontWeight: 600 }}
                      onClick={e => e.stopPropagation()}
                    >
                      ↗
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Inline code viewer for selected CF submission */}
      {selectedSub && (
        <CodeViewer submission={selectedSub} />
      )}
    </div>
  )
}

function CodeViewer({ submission }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    if (!submission.sourceCode) return
    navigator.clipboard.writeText(submission.sourceCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [submission.sourceCode])

  return (
    <div style={{ marginTop: 20 }}>
      <div className="cdp-code-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="cdp-code-lang">{submission.language}</span>
          <span className={`cdp-verdict-chip ${verdictClass(submission.verdict)}`}>
            {normalizeVerdict(submission.verdict)}
          </span>
          {submission.passedTests != null && (
            <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
              {submission.passedTests} tests passed
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {submission.sourceCode && (
            <button className="cdp-copy-btn" onClick={copy}>
              {copied ? '✓ Copied' : '📋 Copy Code'}
            </button>
          )}
          <a
            className="cdp-platform-link"
            href={submission.codeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 0, fontSize: '0.72rem', padding: '4px 10px' }}
          >
            ↗ View on CF
          </a>
        </div>
      </div>

      {submission.sourceCode ? (
        <pre className="cdp-code-block">{submission.sourceCode}</pre>
      ) : (
        <div className="cdp-note">
          Source code not available inline — Codeforces requires login to view submitted code.
          Click "View on CF" to see it on the platform.
        </div>
      )}
    </div>
  )
}

// ── Main ContestDetailPanel ───────────────────────────────────────────────────
export default function ContestDetailPanel({ contest, platform, email, onClose }) {
  const [tab,         setTab]         = useState('Problems')
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const panelRef = useRef(null)

  // Derive contestId per platform
  const contestId = (() => {
    if (platform === 'codeforces') return String(contest.contest_id)
    if (platform === 'codechef')   return contest.contest_code || contest.contestId
    if (platform === 'leetcode') {
      // Convert "Weekly Contest 399" → "weekly-contest-399"
      return (contest.contest_title || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }
    return ''
  })()

  useEffect(() => {
    if (!contestId) {
      setError('Contest ID not found')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setSelectedSub(null)
    setData(null)

    api.get('/api/contest/detail', { params: { platform, contestId, email } })
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || e.message || 'Failed to load contest details'))
      .finally(() => setLoading(false))
  }, [contestId, platform, email])

  // Close on Escape or overlay click
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const color = platformColor(platform)
  const contestName = data?.contestName
    || contest.contest_name
    || contest.contest_title
    || contest.contestName
    || contestId

  const tabs = ['Problems', 'Submissions', ...(platform === 'codeforces' ? [] : [])]

  return (
    <>
      <div className="cdp-overlay" onClick={onClose} />
      <div className="cdp-panel" ref={panelRef}>
        {/* ── Header ── */}
        <div className="cdp-header">
          <div className="cdp-header-top">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span
                  className="cdp-platform-badge"
                  style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                >
                  {platformLabel(platform)}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                  Contest #{contestId}
                </span>
              </div>
              <div className="cdp-contest-name">{contestName}</div>
            </div>
            <button className="cdp-close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {/* KPI row from stored data */}
          <div className="cdp-kpis">
            {[
              { label: 'Rank',         val: contest.rank_achieved ? `#${contest.rank_achieved}` : (data?.rank ? `#${data.rank}` : '—') },
              { label: 'Rating After', val: contest.new_rating || contest.rating_after_contest || '—' },
              { label: 'Δ Rating',     val: (() => {
                  const d = contest.rating_change ?? (data?.solved ? null : null)
                  if (d == null) return '—'
                  return (d > 0 ? '+' : '') + d
                })(), color: (contest.rating_change ?? 0) > 0 ? '#22c55e' : '#ef4444' },
              { label: 'Solved',       val: contest.problems_solved ?? contest.problems_solved_count ?? data?.myData?.problemsSolved ?? '—' },
              ...(contest.division ? [{ label: 'Division', val: contest.division }] : []),
              ...(contest.finish_time_seconds ? [{ label: 'Finish Time', val: fmtTime(contest.finish_time_seconds) }] : []),
            ].map(k => (
              <div className="cdp-kpi" key={k.label}>
                <div className="cdp-kpi-val" style={k.color ? { color: k.color } : {}}>{k.val}</div>
                <div className="cdp-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="cdp-tabs">
          {['Problems', 'Submissions'].map(t => (
            <button
              key={t}
              className={`cdp-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
              {t === 'Submissions' && data?.submissions?.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: '0.68rem', background: 'rgba(26,140,255,0.15)', color: '#1a8cff', padding: '1px 6px', borderRadius: 8 }}>
                  {data.submissions.length}
                </span>
              )}
              {t === 'Problems' && data?.problems?.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: '0.68rem', background: 'rgba(255,255,255,0.07)', color: 'var(--fg-muted)', padding: '1px 6px', borderRadius: 8 }}>
                  {data.problems.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="cdp-body">
          {loading && (
            <div className="cdp-loading">
              <div className="cdp-spinner" />
              <span>Loading contest data from {platformLabel(platform)}…</span>
            </div>
          )}

          {error && !loading && (
            <div className="cdp-error">⚠ {error}</div>
          )}

          {data && !loading && (
            <>
              {data.note && (
                <div className="cdp-note">ℹ {data.note}
                  {data.platformUrl && (
                    <a className="cdp-platform-link" href={data.platformUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 12, marginTop: 0, display: 'inline-flex', fontSize: '0.72rem', padding: '3px 10px' }}>
                      🔗 Open on LeetCode
                    </a>
                  )}
                </div>
              )}

              {tab === 'Problems' && <ProblemsTab data={data} />}
              {tab === 'Submissions' && (
                <SubmissionsTab
                  data={data}
                  onSelectSub={setSelectedSub}
                  selectedSub={selectedSub}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
