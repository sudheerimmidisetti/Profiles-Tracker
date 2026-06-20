// frontend/student/src/pages/DashboardPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { analyticsAPI } from '../api/api'
import Header          from '../components/Header'
import KPICards        from '../components/KPICards'
import PlatformCard    from '../components/PlatformCard'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { Share2, ExternalLink, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ── Branch / College expansion maps ───────────────────────────────────────────
const BRANCH_MAP = {
  'CSE':   'Computer Science and Engineering',
  'CSE1':  'Computer Science and Engineering',
  'CSE2':  'Computer Science and Engineering',
  'CSE3':  'Computer Science and Engineering',
  'IT':    'Information Technology',
  'AIML':  'Artificial Intelligence & Machine Learning',
  'AIDS':  'Artificial Intelligence & Data Science',
  'ECE':   'Electronics and Communication Engineering',
  'EEE':   'Electrical and Electronics Engineering',
  'MECH':  'Mechanical Engineering',
  'CIVIL': 'Civil Engineering',
  'MBA':   'Master of Business Administration',
  'MCA':   'Master of Computer Applications',
}
const COLLEGE_MAP = {
  'ACET': 'Annamacharya College of Engineering & Technology',
  'AEC':  'Annamacharya Engineering College',
}

function expandBranch(b)  { return BRANCH_MAP[b?.toUpperCase()] || b || '' }
function expandCollege(c) { return COLLEGE_MAP[c?.toUpperCase()] || c || '' }
function yearLabel(passout) {
  if (!passout) return null
  const diff = Number(passout) - new Date().getFullYear()
  if (diff > 3) return '1st Year'
  if (diff === 3) return '2nd Year'
  if (diff === 2) return '3rd Year'
  if (diff === 1) return '4th Year'
  return `Class of ${passout}`
}

// ── Profile Hero ───────────────────────────────────────────────────────────────
function ProfileHero({ user }) {
  const [copied, setCopied] = useState(false)

  const shareProfile = useCallback(() => {
    if (!user?.roll_number) return
    const url = `${window.location.origin}/public/profile/${user.roll_number}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2400)
    })
  }, [user])

  const openPublic = useCallback(() => {
    if (!user?.roll_number) return
    window.open(`/public/profile/${user.roll_number}`, '_blank')
  }, [user])

  if (!user) return null

  const initials = (user.full_name || '?').split(' ').filter(Boolean).map(s => s[0]).join('').toUpperCase().slice(0, 2)
  const dept = expandBranch(user.branch)
  const coll = expandCollege(user.college)
  const year = yearLabel(user.passout_year)

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)',
      marginBottom: 24, boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
      textAlign: 'center',
    }}>
      {/* Gradient hero bg */}
      <div style={{
        height: 110,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #a855f7 70%, #ec4899 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Blob decoration */}
        <div style={{
          position: 'absolute', top: -20, left: -20, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(20px)',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, right: -20, width: 140, height: 140,
          borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(20px)',
        }} />
      </div>

      {/* Avatar — centered, overlapping hero */}
      <div style={{ marginTop: -50, marginBottom: 14, position: 'relative', zIndex: 2 }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          border: '4px solid var(--surface)',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 900, color: '#fff', letterSpacing: '-.04em',
          overflow: 'hidden',
        }}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials
          }
        </div>
      </div>

      {/* Name */}
      <h1 style={{
        margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 900,
        letterSpacing: '-.04em', color: 'var(--fg)', lineHeight: 1.2,
        padding: '0 24px',
      }}>
        {user.full_name || 'Student'}
      </h1>

      {/* Dept */}
      {dept && (
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6366f1', marginBottom: 4 }}>
          {dept}
        </div>
      )}

      {/* College */}
      {coll && (
        <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', fontWeight: 500, marginBottom: 14, padding: '0 32px', lineHeight: 1.4 }}>
          {coll}
        </div>
      )}

      {/* Badges row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {year && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
            background: '#fef3c7', border: '1.5px solid #fde68a', color: '#92400e',
          }}>🎓 {year}</span>
        )}
        {user.is_verified && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
            background: '#dcfce7', border: '1.5px solid #bbf7d0', color: '#166534',
          }}>✓ Verified</span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        padding: '0 24px 24px', flexWrap: 'wrap',
      }}>
        <button
          onClick={openPublic}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
            border: '1.5px solid var(--border)', background: 'var(--bg)',
            color: 'var(--fg-muted)', fontSize: '0.75rem', fontWeight: 600,
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)' }}
        >
          <ExternalLink size={13} /> View Public Page
        </button>
        <button
          onClick={shareProfile}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
            border: `1.5px solid ${copied ? '#bbf7d0' : '#c7d2fe'}`,
            background: copied ? '#dcfce7' : '#eef2ff',
            color: copied ? '#166534' : '#4f46e5',
            fontSize: '0.75rem', fontWeight: 600, transition: 'all .2s',
          }}
        >
          <Share2 size={13} /> {copied ? '✓ Link Copied!' : 'Share Profile'}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [summary,  setSummary]  = useState(null)
  const [heatmap,  setHeatmap]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [hmLoading, setHmLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) return
    analyticsAPI.summary(user.email)
      .then(r => setSummary(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!user?.email) return
    analyticsAPI.heatmap()
      .then(r => setHeatmap(r.data.data))
      .catch(console.error)
      .finally(() => setHmLoading(false))
  }, [user])

  const platforms = summary?.platforms || {}

  return (
    <>
      <Header title="Dashboard" breadcrumb="Overview" />

      <div className="page">
        {/* Profile hero */}
        <ProfileHero user={user} />

        {/* Verification warning */}
        {user && !user.is_verified && (
          <div className="msg msg-info" style={{ cursor: 'pointer', marginBottom: 16 }} onClick={() => navigate('/verify-handlers')}>
            <ShieldCheck size={16} />
            <span>Your coding handles are not verified yet. <strong>Link your accounts →</strong></span>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading your stats…</div>
        ) : (
          <>
            <KPICards data={summary} />

            <div>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--fg-muted)' }}>
                PLATFORM BREAKDOWN
              </h2>
              <div className="platform-grid">
                {['leetcode', 'codeforces', 'codechef', 'hackerrank'].map(p => (
                  <PlatformCard key={p} platform={p} data={platforms[p]} />
                ))}
              </div>
            </div>

            {hmLoading ? (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
                <div className="spinner" style={{ display: 'inline-block', marginRight: 8 }} />
                Loading activity heatmap…
              </div>
            ) : (
              <ActivityHeatmap
                calendar={heatmap?.calendarMap || {}}
                firstDate={heatmap?.firstDate || null}
                color="#22c55e"
                title="Submission Activity — All Platforms"
                platform="all"
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
