import { ExternalLink } from 'lucide-react'

const PLATFORM_META = {
  leetcode:   { label: 'LeetCode',   dot: 'plat-lc', url: 'https://leetcode.com/u/' },
  codeforces: { label: 'Codeforces', dot: 'plat-cf', url: 'https://codeforces.com/profile/' },
  codechef:   { label: 'CodeChef',   dot: 'plat-cc', url: 'https://www.codechef.com/users/' },
  hackerrank: { label: 'HackerRank', dot: 'plat-hr', url: 'https://www.hackerrank.com/profile/' },
}

// ── CodeChef: rating → star tier ──────────────────────────────────────────────
const CC_STAR_BANDS = [
  { min: 2500, label: '7★', color: '#ff0000' },
  { min: 2200, label: '6★', color: '#ff7f00' },
  { min: 2000, label: '5★', color: '#9b59b6' },
  { min: 1800, label: '4★', color: '#3498db' },
  { min: 1600, label: '3★', color: '#1abc9c' },
  { min: 1400, label: '2★', color: '#2ecc71' },
  { min:    1, label: '1★', color: '#95a5a6' },
]
function ccStarInfo(rating) {
  const r = Number(rating) || 0
  for (const b of CC_STAR_BANDS) if (r >= b.min) return b
  return { label: 'Unrated', color: '#606060' }
}

// ── Codeforces: rating → rank title ──────────────────────────────────────────
const CF_RANKS = [
  { min: 3000, label: 'Legendary GM',   color: '#000' },
  { min: 2600, label: 'Intl. GM',       color: '#ff0000' },
  { min: 2400, label: 'Grandmaster',    color: '#ff0000' },
  { min: 2300, label: 'Intl. Master',   color: '#ff8c00' },
  { min: 2100, label: 'Master',         color: '#ff8c00' },
  { min: 1900, label: 'Cand. Master',   color: '#aa00aa' },
  { min: 1600, label: 'Expert',         color: '#0000ff' },
  { min: 1400, label: 'Specialist',     color: '#03a89e' },
  { min: 1200, label: 'Pupil',          color: '#008000' },
  { min:    1, label: 'Newbie',         color: '#808080' },
]
function cfRankInfo(rating, storedRank) {
  if (storedRank) return { label: storedRank.replace(/\b\w/g, c => c.toUpperCase()), color: '#808080' }
  const r = Number(rating) || 0
  for (const b of CF_RANKS) if (r >= b.min) return b
  return { label: 'Unrated', color: '#606060' }
}

export default function PlatformCard({ platform, data }) {
  const meta = PLATFORM_META[platform] || {}
  if (!data) {
    return (
      <div className="platform-card" style={{ opacity: 0.5 }}>
        <div className="platform-hd">
          <div className="platform-name">
            <span className={`plat-dot ${meta.dot}`} />
            {meta.label}
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Not linked yet</p>
      </div>
    )
  }

  // ── Build secondary stats (no duplicates) ──────────────────────────────────
  let chips = []
  if (platform === 'leetcode') {
    chips = [
      { label: 'Easy',   value: data.easy_solved  ?? '—', color: '#22c55e' },
      { label: 'Medium', value: data.medium_solved ?? '—', color: '#f59e0b' },
      { label: 'Hard',   value: data.hard_solved   ?? '—', color: '#ef4444' },
    ]
  } else if (platform === 'codeforces') {
    const rank = cfRankInfo(data.current_rating, data.current_rank)
    chips = [
      { label: 'Solved', value: data.total_solved ?? '—' },
      { label: rank.label, value: null, color: rank.color, isBadge: true },
    ]
  } else if (platform === 'codechef') {
    const star = ccStarInfo(data.current_rating)
    chips = [
      { label: 'Solved', value: data.total_solved ?? '—' },
      { label: star.label, value: null, color: star.color, isBadge: true },
    ]
  } else {
    // HackerRank — show badges count + total stars
    const badgesCount = (() => {
      try {
        const b = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges
        return Array.isArray(b) ? b.filter(x => (x.stars || 0) > 0).length : '—'
      } catch { return '—' }
    })()
    const totalStars = (() => {
      try {
        const b = typeof data.badges === 'string' ? JSON.parse(data.badges) : data.badges
        return Array.isArray(b)
          ? b.reduce((acc, x) => acc + (Number(x.stars) || 0), 0)
          : '—'
      } catch { return '—' }
    })()
    chips = [
      { label: 'Badges', value: badgesCount },
      { label: 'Stars ★', value: totalStars, color: '#f59e0b' },
    ]
  }

  // ── Primary metric label under the rating number ───────────────────────────
  const ratingLabel = platform === 'hackerrank' ? 'Points' : 'Rating'

  return (
    <div className="platform-card">
      {/* Header */}
      <div className="platform-hd">
        <div className="platform-name">
          <span className={`plat-dot ${meta.dot}`} />
          {meta.label}
        </div>
        {data.username && (
          <a
            href={`${meta.url}${data.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn btn-sm"
            title="Open on platform"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Primary value */}
      <div>
        <p className="platform-rating-val">
          {platform === 'hackerrank'
            ? (data.current_rating ? Math.round(data.current_rating) : '—')
            : (data.current_rating ? Math.round(data.current_rating) : '—')}
        </p>
        <p className="platform-rank">
          {data.global_rank ? `Global #${data.global_rank.toLocaleString()}` : ratingLabel}
          {data.username ? ` · @${data.username}` : ''}
        </p>
      </div>

      {/* Stat chips */}
      <div className="platform-stats">
        {chips.map((c, i) => (
          <div key={i} className="pstat">
            {c.isBadge ? (
              <div className="pstat-val" style={{ color: c.color, fontSize: '0.95rem' }}>{c.label}</div>
            ) : (
              <>
                <div className="pstat-val" style={c.color ? { color: c.color } : {}}>{c.value}</div>
                <div className="pstat-label">{c.label}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
