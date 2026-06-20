// frontend/student/src/pages/DashboardPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { analyticsAPI } from '../api/api'
import Header         from '../components/Header'
import KPICards       from '../components/KPICards'
import PlatformCard   from '../components/PlatformCard'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { ShieldCheck, Share2, ExternalLink } from 'lucide-react'
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
  const navigate = useNavigate()

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

  const initials = (user.full_name || '?').split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)
  const dept  = expandBranch(user.branch)
  const coll  = expandCollege(user.college)
  const year  = yearLabel(user.passout_year)

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)',
      marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      {/* Gradient banner */}
      <div style={{
        height: 72,
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
      }} />

      {/* Content row */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap',
        padding: '0 28px 24px', marginTop: -40,
      }}>
        {/* Avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: 16, flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          border: '4px solid var(--surface)',
          boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.7rem', fontWeight: 900, color: '#fff', letterSpacing: '-.04em',
          overflow: 'hidden', position: 'relative',
        }}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : initials
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 220, paddingTop: 46 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-.04em', color: 'var(--fg)' }}>
              {user.full_name || 'Student'}
            </h1>
            {user.is_verified && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px',
                borderRadius: 20, fontSize: '0.64rem', fontWeight: 700,
                background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)', color: '#22c55e',
              }}>
                <ShieldCheck size={9}/> Verified
              </span>
            )}
          </div>

          {coll && (
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginBottom: 2, fontWeight: 500 }}>
              {coll}
            </div>
          )}
          {dept && (
            <div style={{ fontSize: '0.76rem', color: '#6366f1', fontWeight: 600, marginBottom: 8 }}>
              {dept}
            </div>
          )}

          {year && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#d97706',
            }}>
              🎓 {year}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 40, flexWrap: 'wrap' }}>
          <button
            onClick={openPublic}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              border: '1.5px solid var(--border)', background: 'var(--bg)',
              color: 'var(--fg-muted)', fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)' }}
          >
            <ExternalLink size={13}/> View Public
          </button>
          <button
            onClick={shareProfile}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              border: '1.5px solid #c7d2fe',
              background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)',
              borderColor: copied ? '#bbf7d0' : '#c7d2fe',
              color: copied ? '#16a34a' : '#6366f1',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
            }}
          >
            <Share2 size={13}/>
            {copied ? '✓ Link Copied!' : 'Share Profile'}
          </button>
        </div>
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
