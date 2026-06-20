// frontend/student/src/pages/PublicProfilePage.jsx
// No auth required — shareable public profile card
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { profileAPI } from '../api/api'
import { Share2, FileText, ExternalLink } from 'lucide-react'

// ── Branch / College expansion ────────────────────────────────────────────────
const BRANCH_MAP = {
  CSE: 'Computer Science and Engineering',
  CSE1: 'Computer Science and Engineering',
  CSE2: 'Computer Science and Engineering',
  CSE3: 'Computer Science and Engineering',
  IT: 'Information Technology',
  AIML: 'Artificial Intelligence & Machine Learning',
  AIDS: 'Artificial Intelligence & Data Science',
  ECE: 'Electronics and Communication Engineering',
  EEE: 'Electrical and Electronics Engineering',
  MECH: 'Mechanical Engineering',
  CIVIL: 'Civil Engineering',
  MBA: 'Master of Business Administration',
  MCA: 'Master of Computer Applications',
}
const COLLEGE_MAP = {
  ACET: 'Annamacharya College of Engineering & Technology',
  AEC: 'Annamacharya Engineering College',
}
const expandBranch = b => BRANCH_MAP[b?.toUpperCase()] || b || ''
const expandCollege = c => COLLEGE_MAP[c?.toUpperCase()] || c || ''
const yearLabel = passout => {
  if (!passout) return null
  const diff = Number(passout) - new Date().getFullYear()
  if (diff > 3) return '1st Year'
  if (diff === 3) return '2nd Year'
  if (diff === 2) return '3rd Year'
  if (diff === 1) return '4th Year'
  return `Class of ${passout}`
}

// ── Platform meta ─────────────────────────────────────────────────────────────
const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#b45309', border: '#fde68a', bg: '#fffbeb', icon: '⚡' },
  codeforces: { label: 'Codeforces', color: '#1d4ed8', border: '#bfdbfe', bg: '#eff6ff', icon: '🏆' },
  codechef:   { label: 'CodeChef',   color: '#15803d', border: '#bbf7d0', bg: '#f0fdf4', icon: '🍴' },
  hackerrank: { label: 'HackerRank', color: '#065f46', border: '#a7f3d0', bg: '#ecfdf5', icon: '💻' },
}

// ── Platform URL builder ──────────────────────────────────────────────────────
const platUrl = (key, username) => {
  if (key === 'leetcode')   return `https://leetcode.com/u/${username}`
  if (key === 'codeforces') return `https://codeforces.com/profile/${username}`
  if (key === 'codechef')   return `https://www.codechef.com/users/${username}`
  if (key === 'hackerrank') return `https://www.hackerrank.com/profile/${username}`
  return '#'
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.pp-root {
  min-height: 100vh;
  background: #f0f2f5;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ── Top nav bar ── */
.pp-nav {
  position: sticky; top: 0; z-index: 50;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0,0,0,0.07);
  padding: 0 24px;
  height: 56px;
  display: flex; align-items: center; justify-content: space-between;
}
.pp-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.pp-brand-logo {
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem; font-weight: 900; color: #fff; letter-spacing: -.03em;
}
.pp-brand-name { font-size: 0.82rem; font-weight: 700; color: #111827; letter-spacing: -.02em; }
.pp-nav-actions { display: flex; gap: 8px; }
.pp-nav-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; transition: all .15s; border: 1.5px solid;
  white-space: nowrap; text-decoration: none;
}
.pp-nav-btn-outline {
  border-color: #e5e7eb; background: #fff; color: #374151;
}
.pp-nav-btn-outline:hover { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }
.pp-nav-btn-primary {
  border-color: #4f46e5; background: #4f46e5; color: #fff;
}
.pp-nav-btn-primary:hover { background: #4338ca; border-color: #4338ca; }
.pp-nav-btn-success { border-color: #16a34a; background: #16a34a; color: #fff; }
.pp-nav-btn-success:hover { background: #15803d; }

/* ── Page body ── */
.pp-body {
  max-width: 680px;
  margin: 40px auto 80px;
  padding: 0 16px;
}

/* ── Main card ── */
.pp-card {
  background: #fff;
  border-radius: 24px;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.06),
    0 8px 32px rgba(0,0,0,0.09);
  overflow: hidden;
  margin-bottom: 16px;
}

/* Hero section */
.pp-hero {
  position: relative;
  padding-bottom: 24px;
  text-align: center;
}
.pp-hero-bg {
  height: 130px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #a855f7 70%, #ec4899 100%);
  position: relative;
  overflow: hidden;
}
/* Blob decorations on the hero */
.pp-hero-bg::before {
  content: '';
  position: absolute; top: -30px; left: -30px;
  width: 200px; height: 200px; border-radius: 50%;
  background: rgba(255,255,255,0.12);
  filter: blur(20px);
}
.pp-hero-bg::after {
  content: '';
  position: absolute; bottom: -20px; right: -20px;
  width: 180px; height: 180px; border-radius: 50%;
  background: rgba(255,255,255,0.10);
  filter: blur(20px);
}

/* Avatar */
.pp-avatar-wrap {
  display: flex; justify-content: center;
  margin-top: -52px; position: relative; z-index: 2;
  margin-bottom: 16px;
}
.pp-avatar {
  width: 100px; height: 100px; border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: 4px solid #fff;
  box-shadow: 0 4px 20px rgba(99,102,241,0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 2.2rem; font-weight: 900; color: #fff; letter-spacing: -.04em;
  overflow: hidden;
}
.pp-avatar img { width: 100%; height: 100%; object-fit: cover; }

/* Name + meta */
.pp-name {
  font-size: 1.4rem; font-weight: 900; letter-spacing: -.04em;
  color: #111827; margin-bottom: 6px; padding: 0 24px;
  line-height: 1.2;
}
.pp-dept {
  font-size: 0.85rem; font-weight: 600; color: #4f46e5;
  margin-bottom: 4px;
}
.pp-college {
  font-size: 0.78rem; color: #6b7280; font-weight: 500;
  margin-bottom: 14px; padding: 0 32px;
  line-height: 1.4;
}
.pp-badges { display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.pp-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 12px; border-radius: 20px;
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: .01em;
}
.pp-badge-year   { background: #fef3c7; color: #92400e; border: 1.5px solid #fde68a; }
.pp-badge-verify { background: #dcfce7; color: #166534; border: 1.5px solid #bbf7d0; }

/* ── Stats strip ── */
.pp-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  border-top: 1px solid #f3f4f6;
  margin: 0;
}
.pp-stat {
  padding: 18px 12px; text-align: center;
  border-right: 1px solid #f3f4f6;
  transition: background .15s;
}
.pp-stat:last-child { border-right: none; }
.pp-stat:hover { background: #f9fafb; }
.pp-stat-val {
  font-size: 1.5rem; font-weight: 900; letter-spacing: -.05em;
  color: #111827; line-height: 1; margin-bottom: 4px;
}
.pp-stat-label {
  font-size: 0.62rem; text-transform: uppercase; letter-spacing: .09em;
  font-weight: 700; color: #9ca3af;
}

/* ── Platform cards ── */
.pp-platforms {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 12px; padding: 20px; padding-top: 0;
  border-top: 1px solid #f3f4f6;
  margin-top: 0;
}
.pp-platforms-title {
  padding: 20px 20px 12px;
  font-size: 0.68rem; font-weight: 700; letter-spacing: .09em;
  text-transform: uppercase; color: #9ca3af;
}
.pp-plat {
  border: 1.5px solid;
  border-radius: 14px; padding: 14px 16px;
  transition: all .2s;
  text-decoration: none; display: block;
}
.pp-plat:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.08);
}
.pp-plat-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.pp-plat-name-row { display: flex; align-items: center; gap: 6px; }
.pp-plat-icon { font-size: 1rem; line-height: 1; }
.pp-plat-name { font-size: 0.78rem; font-weight: 800; letter-spacing: -.01em; }
.pp-plat-handle { font-size: 0.7rem; color: #9ca3af; font-weight: 500; margin-bottom: 10px; }
.pp-plat-stats { display: flex; gap: 20px; }
.pp-plat-stat-val   { font-size: 1.1rem; font-weight: 900; letter-spacing: -.04em; color: #111827; line-height: 1; }
.pp-plat-stat-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: .07em; font-weight: 600; color: #9ca3af; margin-top: 2px; }
.pp-ext-icon { color: #d1d5db; transition: color .15s; flex-shrink: 0; }
.pp-plat:hover .pp-ext-icon { color: #6b7280; }

/* ── Footer ── */
.pp-footer {
  text-align: center; padding: 20px 16px;
  font-size: 0.7rem; color: #d1d5db; letter-spacing: .04em;
}
.pp-footer a { color: #818cf8; text-decoration: none; font-weight: 600; }
.pp-footer a:hover { color: #6366f1; }

/* ── Empty / Error state ── */
.pp-empty {
  text-align: center; padding: 100px 20px; color: #9ca3af;
}
.pp-empty-icon { font-size: 3rem; margin-bottom: 16px; }
.pp-empty-title { font-size: 1.1rem; font-weight: 700; color: #374151; margin-bottom: 8px; }
.pp-empty-sub { font-size: 0.84rem; }

/* ── Print styles ── */
@media print {
  .pp-nav, .pp-nav-actions, .pp-footer { display: none !important; }
  .pp-root { background: #fff !important; }
  .pp-body { margin: 0 auto; max-width: 100%; }
  .pp-card { box-shadow: none !important; border: 1px solid #e5e7eb; }
  .pp-plat:hover { transform: none !important; box-shadow: none !important; }
  @page { margin: 15mm; size: A4; }
}

@media (max-width: 480px) {
  .pp-body { margin: 16px auto 40px; }
  .pp-platforms { grid-template-columns: 1fr; }
  .pp-nav-btn span { display: none; }
  .pp-name { font-size: 1.2rem; }
}
`

export default function PublicProfilePage() {
  const { rollNumber } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!rollNumber) return
    profileAPI.getPublic(rollNumber)
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Profile not found'))
      .finally(() => setLoading(false))
  }, [rollNumber])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }, [])

  const s        = data?.student
  const plats    = data?.platforms || {}
  const total    = data?.totalSolved || 0
  const initials = (s?.full_name || '?').split(' ').filter(Boolean).map(x => x[0]).join('').toUpperCase().slice(0, 2)
  const dept     = s ? expandBranch(s.branch) : ''
  const coll     = s ? expandCollege(s.college) : ''
  const year     = s ? yearLabel(s.passout_year) : null

  // Build stats strip from available ratings
  const stats = [
    { val: total.toLocaleString(),                               label: 'Total Solved',  color: '#4f46e5' },
    plats.leetcode?.current_rating   && { val: plats.leetcode.current_rating,   label: 'LC Rating',    color: '#b45309' },
    plats.codeforces?.current_rating && { val: plats.codeforces.current_rating, label: 'CF Rating',    color: '#1d4ed8' },
    plats.codechef?.current_rating   && { val: plats.codechef.current_rating,   label: 'CC Rating',    color: '#15803d' },
  ].filter(Boolean)

  return (
    <div className="pp-root">
      <style>{STYLES}</style>

      {/* Nav bar */}
      <nav className="pp-nav">
        <a className="pp-brand" href="/" tabIndex={-1}>
          <div className="pp-brand-logo">CP</div>
          <span className="pp-brand-name">ACET Coding Tracker</span>
        </a>
        <div className="pp-nav-actions">
          {data && (
            <>
              <button
                onClick={() => window.print()}
                className="pp-nav-btn pp-nav-btn-outline"
              >
                <FileText size={13} />
                <span>Export PDF</span>
              </button>
              <button
                onClick={copyLink}
                className={`pp-nav-btn ${copied ? 'pp-nav-btn-success' : 'pp-nav-btn-primary'}`}
              >
                <Share2 size={13} />
                <span>{copied ? '✓ Copied!' : 'Share'}</span>
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="pp-body">
        {/* Loading */}
        {loading && (
          <div className="pp-card" style={{ padding: '80px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
            Loading profile…
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="pp-card pp-empty">
            <div className="pp-empty-icon">🔍</div>
            <div className="pp-empty-title">Profile Not Found</div>
            <div className="pp-empty-sub">{error}</div>
          </div>
        )}

        {/* Profile card */}
        {data && !loading && (
          <div className="pp-card">
            {/* Hero */}
            <div className="pp-hero">
              <div className="pp-hero-bg" />
              <div className="pp-avatar-wrap">
                <div className="pp-avatar">
                  {s?.avatar_url
                    ? <img src={s.avatar_url} alt={s.full_name} />
                    : initials
                  }
                </div>
              </div>

              <h1 className="pp-name">{s?.full_name || rollNumber}</h1>
              {dept && <p className="pp-dept">{dept}</p>}
              {coll && <p className="pp-college">{coll}</p>}

              <div className="pp-badges">
                {year && <span className="pp-badge pp-badge-year">🎓 {year}</span>}
                {s?.is_verified && (
                  <span className="pp-badge pp-badge-verify">✓ Verified</span>
                )}
              </div>
            </div>

            {/* Stats strip */}
            {stats.length > 0 && (
              <div className="pp-stats">
                {stats.map((st, i) => (
                  <div key={i} className="pp-stat">
                    <div className="pp-stat-val" style={{ color: st.color }}>{st.val}</div>
                    <div className="pp-stat-label">{st.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Platform cards */}
            {Object.keys(plats).length > 0 && (
              <>
                <div className="pp-platforms-title">Platforms</div>
                <div className="pp-platforms">
                  {Object.entries(plats)
                    .filter(([, p]) => p.username)
                    .map(([key, p]) => {
                      const pm = PLAT[key] || { label: key, color: '#4f46e5', border: '#c7d2fe', bg: '#eef2ff', icon: '💡' }
                      return (
                        <a
                          key={key}
                          href={platUrl(key, p.username)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pp-plat"
                          style={{ borderColor: pm.border, background: pm.bg }}
                        >
                          <div className="pp-plat-head">
                            <div className="pp-plat-name-row">
                              <span className="pp-plat-icon">{pm.icon}</span>
                              <span className="pp-plat-name" style={{ color: pm.color }}>{pm.label}</span>
                            </div>
                            <ExternalLink size={12} className="pp-ext-icon" />
                          </div>
                          <div className="pp-plat-handle">@{p.username}</div>
                          <div className="pp-plat-stats">
                            {p.current_rating ? (
                              <div>
                                <div className="pp-plat-stat-val" style={{ color: pm.color }}>{p.current_rating}</div>
                                <div className="pp-plat-stat-label">Rating</div>
                              </div>
                            ) : null}
                            {p.total_solved > 0 ? (
                              <div>
                                <div className="pp-plat-stat-val">{p.total_solved}</div>
                                <div className="pp-plat-stat-label">Solved</div>
                              </div>
                            ) : null}
                            {p.global_rank ? (
                              <div>
                                <div className="pp-plat-stat-val" style={{ fontSize: '0.95rem' }}>#{p.global_rank.toLocaleString()}</div>
                                <div className="pp-plat-stat-label">Global Rank</div>
                              </div>
                            ) : null}
                          </div>
                        </a>
                      )
                    })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {data && (
          <div className="pp-footer">
            Powered by <a href="/" rel="noopener">ACET Coding Tracker</a>
          </div>
        )}
      </div>
    </div>
  )
}
