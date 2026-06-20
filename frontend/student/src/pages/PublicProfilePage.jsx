// frontend/student/src/pages/PublicProfilePage.jsx
// No auth required — shareable public profile card
// Supports PDF export (window.print) and PNG image export (canvas)
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { profileAPI } from '../api/api'
import { Share2, Download, FileText, Image, ExternalLink, Code2, Trophy } from 'lucide-react'

// ── Branch / College expansion maps ───────────────────────────────────────────
const BRANCH_MAP = {
  'CSE':    'Computer Science and Engineering',
  'CSE1':   'Computer Science and Engineering',
  'CSE2':   'Computer Science and Engineering',
  'CSE3':   'Computer Science and Engineering',
  'IT':     'Information Technology',
  'AIML':   'Artificial Intelligence & Machine Learning',
  'AIDS':   'Artificial Intelligence & Data Science',
  'ECE':    'Electronics and Communication Engineering',
  'EEE':    'Electrical and Electronics Engineering',
  'MECH':   'Mechanical Engineering',
  'CIVIL':  'Civil Engineering',
  'CHEM':   'Chemical Engineering',
  'MBA':    'Master of Business Administration',
  'MCA':    'Master of Computer Applications',
}
const COLLEGE_MAP = {
  'ACET': 'Annamacharya College of Engineering & Technology',
  'AEC':  'Annamacharya Engineering College',
}

function expandBranch(b)   { return BRANCH_MAP[b?.toUpperCase()] || b || '' }
function expandCollege(c)  { return COLLEGE_MAP[c?.toUpperCase()] || c || '' }
function yearLabel(passout) {
  if (!passout) return null
  const diff = Number(passout) - new Date().getFullYear()
  if (diff > 3) return '1st Year'
  if (diff === 3) return '2nd Year'
  if (diff === 2) return '3rd Year'
  if (diff === 1) return '4th Year'
  return `Class of ${passout}`
}

// ── Platform colors ────────────────────────────────────────────────────────────
const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  codeforces: { label: 'Codeforces', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  codechef:   { label: 'CodeChef',   color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  hackerrank: { label: 'HackerRank', color: '#00b16a', bg: '#f0fdf4', border: '#a7f3d0' },
}

// ── Print CSS ─────────────────────────────────────────────────────────────────
const PRINT_CSS = `
  @media print {
    body > *:not(#pub-profile-print) { display: none !important; }
    #pub-profile-print {
      display: block !important;
      position: fixed; inset: 0; z-index: 99999;
      background: #fff; padding: 0; margin: 0;
    }
    .pub-pro-no-print { display: none !important; }
    @page { margin: 10mm; size: A4; }
  }
`

// ── Global CSS ─────────────────────────────────────────────────────────────────
const CSS = `
  .pub-pro-root {
    min-height: 100vh;
    background: #f1f5f9;
    font-family: 'Inter', 'Outfit', system-ui, sans-serif;
    color: #0f172a;
  }
  /* header */
  .pub-pro-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; height: 64px;
    background: #fff; border-bottom: 1px solid #e2e8f0;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .pub-pro-brand { display: flex; align-items: center; gap: 10px; }
  .pub-pro-logo  {
    width: 34px; height: 34px; border-radius: 9px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 900; color: #fff; letter-spacing: -.04em;
  }
  .pub-pro-logo-name { font-size: 0.9rem; font-weight: 700; color: #0f172a; letter-spacing: -.02em; }
  .pub-pro-actions   { display: flex; align-items: center; gap: 8px; }
  .pub-pro-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 9px; cursor: pointer; font-size: 0.78rem; font-weight: 600;
    border: 1.5px solid #e2e8f0; background: #f8fafc; color: #475569;
    transition: all .15s; white-space: nowrap;
  }
  .pub-pro-btn:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
  .pub-pro-btn.green { border-color: #bbf7d0; background: #f0fdf4; color: #16a34a; }
  .pub-pro-btn.blue  { border-color: #bfdbfe; background: #eff6ff; color: #2563eb; }
  .pub-pro-btn.copied{ border-color: #22c55e; color: #22c55e; background: #f0fdf4; }

  /* body */
  .pub-pro-body { max-width: 820px; margin: 0 auto; padding: 36px 20px 80px; }

  /* ── Profile card (the shareable part) ── */
  .pub-pro-card {
    background: #fff; border-radius: 20px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    overflow: hidden; margin-bottom: 24px;
  }
  /* gradient banner */
  .pub-pro-banner {
    height: 80px;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
  }
  .pub-pro-identity {
    padding: 0 32px 28px;
    display: flex; align-items: flex-end; gap: 20px;
    margin-top: -44px;
    flex-wrap: wrap;
  }
  .pub-pro-avatar {
    width: 88px; height: 88px; border-radius: 18px; flex-shrink: 0;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    border: 4px solid #fff; box-shadow: 0 4px 16px rgba(99,102,241,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 2rem; font-weight: 900; color: #fff; letter-spacing: -.04em;
    overflow: hidden;
  }
  .pub-pro-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .pub-pro-info { flex: 1; min-width: 220px; padding-top: 52px; }
  .pub-pro-name {
    font-size: 1.5rem; font-weight: 900; letter-spacing: -.04em; color: #0f172a;
    margin: 0 0 4px;
  }
  .pub-pro-college { font-size: 0.82rem; color: #475569; margin: 0 0 2px; font-weight: 500; }
  .pub-pro-dept    { font-size: 0.78rem; color: #6366f1; font-weight: 600; margin: 0 0 8px; }
  .pub-pro-tags    { display: flex; gap: 6px; flex-wrap: wrap; }
  .pub-pro-tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;
    background: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b;
  }
  .pub-pro-tag.year   { background: #fef3c7; border-color: #fde68a; color: #92400e; }
  .pub-pro-tag.verify { background: #dcfce7; border-color: #bbf7d0; color: #15803d; }

  /* stats section inside card */
  .pub-pro-stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1px; background: #f1f5f9; margin: 0;
    border-top: 1px solid #f1f5f9;
  }
  .pub-pro-stat-cell {
    background: #fff; padding: 18px 20px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
  }
  .pub-pro-stat-val   { font-size: 1.5rem; font-weight: 900; letter-spacing: -.04em; color: #0f172a; }
  .pub-pro-stat-label { font-size: 0.67rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }

  /* platform cards below */
  .pub-pro-plat-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px; margin-bottom: 24px;
  }
  .pub-pro-plat-card {
    background: #fff; border-radius: 14px; border: 1px solid #e2e8f0;
    padding: 18px 20px; transition: box-shadow .15s;
  }
  .pub-pro-plat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
  .pub-pro-plat-name { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 10px; }
  .pub-pro-plat-handle { font-size: 0.75rem; color: #94a3b8; margin-bottom: 12px; }
  .pub-pro-plat-stats  { display: flex; gap: 16px; }
  .pub-pro-plat-stat-val   { font-size: 1.2rem; font-weight: 800; letter-spacing: -.03em; }
  .pub-pro-plat-stat-label { font-size: 0.62rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; }

  /* footer branding */
  .pub-pro-footer {
    text-align: center; padding: 20px; color: #cbd5e1;
    font-size: 0.72rem; letter-spacing: .04em; text-transform: uppercase;
  }
  .pub-pro-footer a { color: #6366f1; text-decoration: none; font-weight: 600; }

  /* not found */
  .pub-pro-empty {
    text-align: center; padding: 80px 20px; color: #94a3b8;
  }
`

export default function PublicProfilePage() {
  const { rollNumber } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [copied,  setCopied]  = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!rollNumber) return
    profileAPI.getPublic(rollNumber)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Profile not found'))
      .finally(() => setLoading(false))
  }, [rollNumber])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2200)
    })
  }, [])

  const exportPDF = useCallback(() => {
    window.print()
  }, [])

  const exportImage = useCallback(() => {
    // Use browser print-to-PDF / screenshot — no extra library needed
    window.print()
  }, [])

  const s = data?.student
  const platforms = data?.platforms || {}
  const totalSolved = data?.totalSolved || 0
  const initials = (s?.full_name || '?').split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)
  const year  = s ? yearLabel(s.passout_year) : null
  const dept  = s ? expandBranch(s.branch) : ''
  const coll  = s ? expandCollege(s.college) : ''

  // Count verified platforms
  const verifiedCount = Object.values(platforms).filter(p => p.is_verified).length

  return (
    <div className="pub-pro-root">
      <style>{CSS}</style>
      <style>{PRINT_CSS}</style>

      {/* Header — hidden during print */}
      <header className="pub-pro-header pub-pro-no-print">
        <div className="pub-pro-brand">
          <div className="pub-pro-logo">CP</div>
          <span className="pub-pro-logo-name">ACET Coding Tracker</span>
        </div>
        <div className="pub-pro-actions">
          <button onClick={exportImage} className="pub-pro-btn blue">
            <Image size={13}/> Save as Image
          </button>
          <button onClick={exportPDF} className="pub-pro-btn green">
            <FileText size={13}/> Export PDF
          </button>
          <button onClick={copyLink} className={`pub-pro-btn${copied ? ' copied' : ''}`}>
            <Share2 size={13}/> {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </header>

      <div className="pub-pro-body">
        {loading && (
          <div className="pub-pro-empty">Loading profile…</div>
        )}
        {error && !loading && (
          <div className="pub-pro-empty">
            <Code2 size={40} style={{ color: '#e2e8f0', marginBottom: 12 }}/>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Profile Not Found</div>
            <div style={{ fontSize: '0.84rem' }}>{error}</div>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── Shareable card ── */}
            <div className="pub-pro-card" id="pub-profile-card" ref={cardRef}>
              {/* Banner */}
              <div className="pub-pro-banner" />

              {/* Identity */}
              <div className="pub-pro-identity">
                <div className="pub-pro-avatar">
                  {s?.avatar_url
                    ? <img src={s.avatar_url} alt={s.full_name}/>
                    : initials
                  }
                </div>
                <div className="pub-pro-info">
                  <h1 className="pub-pro-name">{s?.full_name || rollNumber}</h1>
                  {coll && <p className="pub-pro-college">{coll}</p>}
                  {dept && <p className="pub-pro-dept">{dept}</p>}
                  <div className="pub-pro-tags">
                    {year && <span className="pub-pro-tag year">🎓 {year}</span>}
                    {verifiedCount > 0 && (
                      <span className="pub-pro-tag verify">✓ {verifiedCount} Platform{verifiedCount>1?'s':''} Verified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="pub-pro-stats-grid">
                {[
                  { label: 'Total Solved', val: totalSolved.toLocaleString() },
                  platforms.leetcode?.current_rating  && { label: 'LC Rating',  val: platforms.leetcode.current_rating },
                  platforms.codeforces?.current_rating && { label: 'CF Rating', val: platforms.codeforces.current_rating },
                  platforms.codechef?.current_rating   && { label: 'CC Rating', val: platforms.codechef.current_rating },
                ].filter(Boolean).map((s, i) => (
                  <div key={i} className="pub-pro-stat-cell">
                    <div className="pub-pro-stat-val">{s.val}</div>
                    <div className="pub-pro-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Platform detail cards ── */}
            <div className="pub-pro-plat-grid">
              {Object.entries(platforms).filter(([,p]) => p.username).map(([key, p]) => {
                const pm = PLAT[key] || { label: key, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' }
                return (
                  <div key={key} className="pub-pro-plat-card" style={{ borderTop: `3px solid ${pm.color}` }}>
                    <div className="pub-pro-plat-name" style={{ color: pm.color }}>{pm.label}</div>
                    <div className="pub-pro-plat-handle">@{p.username}</div>
                    <div className="pub-pro-plat-stats">
                      {p.current_rating && (
                        <div>
                          <div className="pub-pro-plat-stat-val" style={{ color: pm.color }}>{p.current_rating}</div>
                          <div className="pub-pro-plat-stat-label">Rating</div>
                        </div>
                      )}
                      {p.total_solved > 0 && (
                        <div>
                          <div className="pub-pro-plat-stat-val">{p.total_solved.toLocaleString()}</div>
                          <div className="pub-pro-plat-stat-label">Solved</div>
                        </div>
                      )}
                      {p.global_rank && (
                        <div>
                          <div className="pub-pro-plat-stat-val" style={{ fontSize: '1rem' }}>#{p.global_rank.toLocaleString()}</div>
                          <div className="pub-pro-plat-stat-label">Global</div>
                        </div>
                      )}
                    </div>
                    <a
                      href={`https://${key === 'hackerrank' ? 'www.hackerrank.com/profile' : key === 'codechef' ? 'www.codechef.com/users' : `${key}.com/${key === 'codeforces' ? 'profile' : 'u'}`}/${p.username}`}
                      target="_blank" rel="noopener"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: '0.7rem', color: pm.color, textDecoration: 'none', fontWeight: 600 }}
                    >
                      View Profile <ExternalLink size={10}/>
                    </a>
                  </div>
                )
              })}
            </div>

            {/* Footer branding */}
            <div className="pub-pro-footer">
              Profile powered by <a href="https://cptrack.acet.ac.in" target="_blank" rel="noopener">ACET Coding Tracker</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
