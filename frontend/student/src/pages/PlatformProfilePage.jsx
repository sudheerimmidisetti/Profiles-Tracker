// frontend/student/src/pages/PlatformProfilePage.jsx
// GitHub-style, tab-based platform profile page.
// Platform: LeetCode (full implementation).
// Others: Codeforces, CodeChef, HackerRank — stubs for now (done next).
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate }            from 'react-router-dom'
import { analyticsAPI }                      from '../api/api'
import LeetCodeProfile                       from '../components/platform-profiles/LeetCodeProfile'
import '../styles/platform-profile.css'

const PLATFORM_META = {
  leetcode:   { label: 'LeetCode',   color: '#f89f1b' },
  codeforces: { label: 'Codeforces', color: '#1a8cff' },
  codechef:   { label: 'CodeChef',   color: '#5b4638' },
  hackerrank: { label: 'HackerRank', color: '#2ec866' },
}

export default function PlatformProfilePage() {
  const { platform } = useParams()
  const navigate     = useNavigate()
  const meta         = PLATFORM_META[platform] || { label: platform, color: '#888' }

  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await analyticsAPI.platformDetail(platform)
      // API returns { success: true, data: { platform, base, detail, contests, ... } }
      setData(res.data?.data ?? res.data)
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="pp-loading">
        <div className="pp-spinner" />
        <p>Loading {meta.label} profile…</p>
      </div>
    )
  }

  if (error || !data?.detail?.username) {
    return (
      <div className="pp-error">
        <button className="pp-back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="pp-empty">
          <span className="pp-empty-icon">🔗</span>
          <h3>{error || `No ${meta.label} data yet`}</h3>
          <p>Your handle may not be linked, or the nightly sync hasn't run yet.</p>
          <button className="btn-primary" onClick={() => navigate('/verify-handlers')}>
            Link handle
          </button>
        </div>
      </div>
    )
  }

  if (platform === 'leetcode') {
    return <LeetCodeProfile data={data} onBack={() => navigate(-1)} />
  }

  // Placeholder for other platforms (implemented next)
  return (
    <div className="pp-loading">
      <button className="pp-back-btn" onClick={() => navigate(-1)}>← Back</button>
      <p style={{ marginTop: 24 }}>{meta.label} full profile coming soon.</p>
    </div>
  )
}
