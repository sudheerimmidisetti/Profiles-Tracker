// frontend/student/src/components/ContestDetailPanel.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import './ContestDetailPanel.css'
import api from '../api/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}
function fmtMem(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
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

function normalizeVerdict(v) {
  if (!v) return 'PENDING'
  const u = v.toUpperCase()
  if (u === 'OK' || u === 'AC' || u === 'ACCEPTED') return 'AC'
  if (u.includes('WRONG')) return 'WA'
  if (u.includes('TIME'))  return 'TLE'
  if (u.includes('MEMORY')) return 'MLE'
  if (u.includes('COMPIL') || u === 'CE') return 'CE'
  if (u.includes('RUNTIME') || u === 'RE') return 'RE'
  if (u.includes('PARTIAL')) return 'PA'
  return u.length <= 6 ? u : 'ERR'
}

const PLATFORM_COLORS = {
  codeforces: '#1a8cff',
  codechef:   '#f89f1b',
  leetcode:   '#22c55e',
}
const PLATFORM_LABELS = {
  codeforces: 'Codeforces',
  codechef:   'CodeChef',
  leetcode:   'LeetCode',
}

// ── CF Rating Color (matches Codeforces' official color system) ────────────────
function cfRatingColor(rating) {
  if (!rating) return 'var(--fg-muted)'
  if (rating < 1200) return '#808080'   // grey   — Newbie
  if (rating < 1400) return '#008000'   // green  — Pupil
  if (rating < 1600) return '#03a89e'   // cyan   — Specialist
  if (rating < 1900) return '#0000ff'   // blue   — Expert
  if (rating < 2100) return '#aa00aa'   // violet — Candidate Master
  if (rating < 2400) return '#ff8c00'   // orange — Master
  return '#ff0000'                       // red    — Grandmaster+
}

// ── CC Difficulty Color (CodeChef uses numeric ratings per problem) ─────────────
function ccDiffColor(rating) {
  if (!rating) return 'var(--fg-muted)'
  if (rating < 500)  return '#22c55e'   // green  — Easy
  if (rating < 1000) return '#eab308'   // yellow — Medium
  if (rating < 1500) return '#3b82f6'   // blue   — Hard
  if (rating < 2000) return '#f97316'   // orange — Very Hard
  return '#ef4444'                       // red    — Extreme
}

// ── Problems Tab ─────────────────────────────────────────────────────────────
function ProblemsTab({ data, solvedCount }) {
  const { problems, solved, platform } = data
  const color = PLATFORM_COLORS[platform] || '#888'

  if (!problems?.length) {
    return (
      <div className="cdp-empty-state">
        <div className="cdp-empty-icon">📋</div>
        <p>{platform === 'leetcode'
          ? "Problem list is loading from LeetCode's public API."
          : 'No problem data available for this contest.'}</p>
        {data.platformUrl && (
          <a className="cdp-link-btn" href={data.platformUrl} target="_blank" rel="noopener noreferrer">
            View on {PLATFORM_LABELS[platform]} ↗
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="cdp-problems-list">
      {problems.map((p, i) => {
        const key      = p.index || p.code || String(i + 1)
        const result   = solved?.[key] || {}
        const isAc     = result.accepted
        const attempts = result.attempts || 0
        const notTried = !isAc && attempts === 0

        return (
          <div key={key} className={`cdp-prob-row ${isAc ? 'cdp-prob-ac' : attempts > 0 ? 'cdp-prob-wa' : ''}`}>
            {/* Index */}
            <div className="cdp-prob-idx" style={{
              color: isAc ? '#22c55e' : attempts > 0 ? '#ef4444' : 'var(--fg-muted)',
              background: isAc ? 'rgba(34,197,94,.1)' : attempts > 0 ? 'rgba(239,68,68,.08)' : 'rgba(255,255,255,.04)',
              borderColor: isAc ? 'rgba(34,197,94,.3)' : attempts > 0 ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.07)',
            }}>
              {key}
            </div>

            {/* Name & tags */}
            <div className="cdp-prob-meta">
              <a
                className="cdp-prob-name"
                href={p.url || (platform === 'leetcode' ? `https://leetcode.com/problems/${p.slug}` : '#')}
                target="_blank" rel="noopener noreferrer"
              >
                {p.name}
              </a>
              <div className="cdp-prob-tags">
                {/* LC: Easy/Medium/Hard badge */}
                {p.difficulty && (
                  <span className={`cdp-tag cdp-diff-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
                )}
                {/* CF: Color-coded problem rating */}
                {p.rating && (
                  <span className="cdp-tag cdp-rating-tag" style={{
                    color: cfRatingColor(p.rating),
                    background: `${cfRatingColor(p.rating)}18`,
                    borderColor: `${cfRatingColor(p.rating)}40`,
                    fontWeight: 700,
                  }}>
                    ★ {p.rating}
                  </span>
                )}
                {/* CC: difficulty_rating badge */}
                {p.difficulty_rating && (
                  <span className="cdp-tag cdp-rating-tag" style={{
                    color: ccDiffColor(p.difficulty_rating),
                    background: `${ccDiffColor(p.difficulty_rating)}18`,
                    borderColor: `${ccDiffColor(p.difficulty_rating)}40`,
                    fontWeight: 700,
                  }}>
                    ★ {p.difficulty_rating}
                  </span>
                )}
                {/* LC: Contest score (3/4/5/7 pts) */}
                {p.points && <span className="cdp-tag">⚡ {p.points}pts</span>}
                {/* CC/CF: accuracy */}
                {p.accuracy != null && <span className="cdp-tag" style={{ color: 'var(--fg-muted)' }}>{p.accuracy.toFixed(0)}% acc</span>}
                {/* CF/CC: Topic tags */}
                {(p.tags || []).slice(0, 3).map(t => (
                  <span key={t} className="cdp-tag">{t}</span>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="cdp-prob-status">
              {isAc ? (
                <span className="cdp-verdict cdp-v-ac">✓ Solved</span>
              ) : result.score > 0 ? (
                <span className="cdp-verdict cdp-v-pa">◑ {result.score} pts</span>
              ) : attempts > 0 ? (
                <span className="cdp-verdict cdp-v-wa">✗ {attempts} att.</span>
              ) : (
                <span className="cdp-verdict cdp-v-none">— Not tried</span>
              )}
            </div>

          </div>
        )
      })}
    </div>
  )
}


// ── Submissions Tab ──────────────────────────────────────────────────────────
function SubmissionsTab({ data, onSelectSub, selectedSub }) {
  const { submissions, platform } = data
  const color = PLATFORM_COLORS[platform] || '#888'

  if (!submissions?.length) {
    return (
      <div className="cdp-empty-state">
        <div className="cdp-empty-icon">
          {platform === 'leetcode' ? '🔒' : platform === 'codechef' ? '🔒' : '📭'}
        </div>
        <p>
          {platform === 'leetcode'
            ? 'LeetCode submission details require authentication.'
            : platform === 'codechef'
            ? 'CodeChef submission details require authentication.'
            : 'No submissions found for this contest.'}
        </p>
        {data.platformUrl && (
          <a className="cdp-link-btn" href={data.platformUrl} target="_blank" rel="noopener noreferrer">
            View on {PLATFORM_LABELS[platform]} ↗
          </a>
        )}
      </div>
    )
  }

  const acCount = submissions.filter(s => normalizeVerdict(s.verdict) === 'AC').length

  return (
    <div>
      <div className="cdp-sub-summary">
        <span>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</span>
        <span className="cdp-sub-summary-sep">·</span>
        <span style={{ color: '#22c55e' }}>{acCount} accepted</span>
        {platform === 'codeforces' && (
          <>
            <span className="cdp-sub-summary-sep">·</span>
            <span style={{ color: 'var(--fg-muted)', fontSize: '0.72rem' }}>Click a row to view code</span>
          </>
        )}
      </div>

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
              {platform === 'codeforces' && <th>Tests</th>}
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s, i) => {
              const vn = normalizeVerdict(s.verdict)
              const isSelected = selectedSub?.id === s.id
              return (
                <tr
                  key={s.id || i}
                  className={`${platform === 'codeforces' ? 'cdp-tr-clickable' : ''} ${isSelected ? 'cdp-tr-selected' : ''}`}
                  onClick={() => platform === 'codeforces' && onSelectSub(isSelected ? null : s)}
                >
                  <td className="cdp-td-muted">{i + 1}</td>
                  <td>
                    <span className="cdp-prob-inline">
                      {s.problemIndex && <span className="cdp-prob-idx-small">{s.problemIndex}</span>}
                      {s.problemName || s.problemCode || '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`cdp-verdict cdp-v-${vn === 'AC' ? 'ac' : vn === 'WA' ? 'wa' : vn === 'TLE' ? 'tle' : vn === 'MLE' ? 'mle' : 'none'}`}>
                      {vn}
                    </span>
                  </td>
                  <td className="cdp-td-muted">{s.language || '—'}</td>
                  <td className="cdp-td-num">{fmtMs(s.timeMs)}</td>
                  <td className="cdp-td-num">{fmtMem(s.memoryBytes)}</td>
                  {platform === 'codeforces' && (
                    <td className="cdp-td-muted">{s.passedTests != null ? s.passedTests : '—'}</td>
                  )}
                  <td className="cdp-td-muted cdp-td-sm">{fmtDate(s.timestamp)}</td>
                  <td>
                    <a
                      href={s.codeUrl} target="_blank" rel="noopener noreferrer"
                      className="cdp-link-sm"
                      onClick={e => e.stopPropagation()}
                    >↗</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedSub && <CodeViewer submission={selectedSub} />}
    </div>
  )
}

// ── Code Viewer ───────────────────────────────────────────────────────────────
function CodeViewer({ submission }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    if (!submission.sourceCode) return
    navigator.clipboard.writeText(submission.sourceCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [submission.sourceCode])

  const vn = normalizeVerdict(submission.verdict)

  return (
    <div className="cdp-code-viewer">
      <div className="cdp-code-header">
        <div className="cdp-code-meta">
          <span className="cdp-code-lang">{submission.language}</span>
          <span className={`cdp-verdict cdp-v-${vn === 'AC' ? 'ac' : 'wa'}`}>{vn}</span>
          {submission.passedTests != null && (
            <span className="cdp-td-muted" style={{ fontSize: '0.72rem' }}>
              {submission.passedTests} tests passed
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {submission.sourceCode && (
            <button className="cdp-copy-btn" onClick={copy}>
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          )}
          <a className="cdp-link-btn" href={submission.codeUrl} target="_blank" rel="noopener noreferrer">
            ↗ View on CF
          </a>
        </div>
      </div>
      {submission.sourceCode
        ? <pre className="cdp-code-block">{submission.sourceCode}</pre>
        : (
          <div className="cdp-code-unavailable">
            Source code requires login on Codeforces.
            <a href={submission.codeUrl} target="_blank" rel="noopener noreferrer" className="cdp-link-sm" style={{ marginLeft: 8 }}>
              Open ↗
            </a>
          </div>
        )
      }
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
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
      return (contest.contest_title || '')
        .toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }
    return ''
  })()

  useEffect(() => {
    if (!contestId) { setError('Contest ID not found'); setLoading(false); return }
    setLoading(true); setError(null); setSelectedSub(null); setData(null)
    api.get('/api/contest/detail', { params: { platform, contestId, email } })
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [contestId, platform, email])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const color = PLATFORM_COLORS[platform] || '#888'
  const contestName = data?.contestName || contest.contest_name || contest.contest_title || contestId

  // Solved count:
  //  - CF: use live count from actual submissions fetched by API (data.problemsSolvedLive)
  //  - LC/CC: use solved map if populated, fallback to myData.problemsSolved
  const solvedEntries = data?.solved ? Object.values(data.solved) : []
  const liveSolvedCount =
    platform === 'codeforces' && data?.problemsSolvedLive != null
      ? data.problemsSolvedLive
      : solvedEntries.length > 0
        ? solvedEntries.filter(s => s.accepted).length
        : null
  const solvedVal = liveSolvedCount != null
    ? liveSolvedCount
    : (data?.myData?.problemsSolved ?? contest.problems_solved ?? contest.problems_solved_count ?? '—')

  // Total problems (denominator for Solved display)
  const totalProblems = data?.problems?.length || data?.myData?.totalProblems
    || contest.total_problems || null
  const solvedDisplay = totalProblems
    ? `${solvedVal} / ${totalProblems}`
    : String(solvedVal)

  // Rating delta
  const delta = contest.rating_change
  const deltaStr = delta != null ? ((delta > 0 ? '+' : '') + delta) : '—'
  const deltaColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : 'var(--fg-muted)'

  // Division: from contest object OR from live data.myData (CC stores it there)
  const divisionVal = contest.division || data?.myData?.division || null

  // Finish time: from contest object (LC) or myData
  const finishTimeSec = contest.finish_time_seconds || data?.myData?.finishTime || null

  // KPI items
  const kpis = [
    { label: 'Rank',         val: contest.rank_achieved ? `#${Number(contest.rank_achieved).toLocaleString()}` : (data?.rank ? `#${data.rank}` : '—') },
    { label: 'Rating After', val: contest.new_rating || contest.rating_after_contest || '—' },
    { label: 'Δ Rating',     val: deltaStr, color: deltaColor },
    { label: 'Solved',       val: solvedDisplay },
    ...(divisionVal    ? [{ label: 'Division',    val: divisionVal }]            : []),
    ...(finishTimeSec  ? [{ label: 'Finish Time', val: fmtTime(finishTimeSec) }] : []),
  ]

  const tabs = ['Problems', 'Submissions']

  return (
    <>
      <div className="cdp-overlay" onClick={onClose} aria-hidden="true" />
      <div className="cdp-panel" ref={panelRef} role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="cdp-header">
          <div className="cdp-header-row">
            <div className="cdp-header-left">
              <span className="cdp-platform-pill" style={{ '--pill-color': color }}>
                {PLATFORM_LABELS[platform]}
              </span>
              <span className="cdp-contest-id">#{contestId}</span>
            </div>
            <button className="cdp-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <h2 className="cdp-contest-title">{contestName}</h2>

          {/* KPIs */}
          <div className="cdp-kpi-row">
            {kpis.map(k => (
              <div className="cdp-kpi-item" key={k.label}>
                <div className="cdp-kpi-val" style={k.color ? { color: k.color } : {}}>{k.val}</div>
                <div className="cdp-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="cdp-tab-bar">
          {tabs.map(t => (
            <button
              key={t}
              className={`cdp-tab-btn${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
              style={tab === t ? { '--tab-color': color } : {}}
            >
              {t}
              {t === 'Problems'    && data?.problems?.length    > 0 && <span className="cdp-tab-pill">{data.problems.length}</span>}
              {t === 'Submissions' && data?.submissions?.length > 0 && <span className="cdp-tab-pill cdp-tab-pill-blue">{data.submissions.length}</span>}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="cdp-body">
          {loading && (
            <div className="cdp-loading">
              <div className="cdp-spinner" style={{ '--spin-color': color }} />
              <span>Fetching from {PLATFORM_LABELS[platform]}…</span>
            </div>
          )}

          {error && !loading && (
            <div className="cdp-error-box">
              <span className="cdp-error-icon">⚠</span> {error}
            </div>
          )}

          {data && !loading && (
            <>
              {data.note && (
                <div className="cdp-info-banner">
                  <span className="cdp-info-icon">ℹ</span>
                  <span>{data.note}</span>
                  {data.platformUrl && (
                    <a className="cdp-link-sm" href={data.platformUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      Open ↗
                    </a>
                  )}
                </div>
              )}
              {tab === 'Problems' && <ProblemsTab data={data} solvedCount={liveSolvedCount} />}
              {tab === 'Submissions' && (
                <SubmissionsTab data={data} onSelectSub={setSelectedSub} selectedSub={selectedSub} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
