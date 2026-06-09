import { ExternalLink } from 'lucide-react'

const PLATFORM_META = {
  leetcode:   { label: 'LeetCode',   dot: 'plat-lc', url: 'https://leetcode.com/u/' },
  codeforces: { label: 'Codeforces', dot: 'plat-cf', url: 'https://codeforces.com/profile/' },
  codechef:   { label: 'CodeChef',   dot: 'plat-cc', url: 'https://www.codechef.com/users/' },
  hackerrank: { label: 'HackerRank', dot: 'plat-hr', url: 'https://www.hackerrank.com/profile/' },
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

  const solved = platform === 'leetcode'
    ? [
        { label: 'Easy',   value: data.easy_solved   ?? '—' },
        { label: 'Medium', value: data.medium_solved  ?? '—' },
        { label: 'Hard',   value: data.hard_solved    ?? '—' },
      ]
    : platform === 'codeforces'
    ? [
        { label: 'Total',  value: data.total_solved   ?? '—' },
        { label: 'Rating', value: data.current_rating ?? '—' },
      ]
    : platform === 'codechef'
    ? [
        { label: 'Rating', value: data.current_rating ?? '—' },
        { label: 'Solved', value: data.total_solved   ?? '—' },
      ]
    : [
        { label: 'Points', value: data.current_rating ? Math.round(data.current_rating) : '—' },
        { label: 'Rank',   value: data.global_rank ? `#${data.global_rank}` : '—' },
      ]

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
            title="View profile"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Rating */}
      <div>
        <p className="platform-rating-val">
          {data.current_rating ? Math.round(data.current_rating) : '—'}
        </p>
        <p className="platform-rank">
          {data.global_rank ? `Global #${data.global_rank.toLocaleString()}` : ''}
          {data.username ? ` · @${data.username}` : ''}
        </p>
      </div>

      {/* Stat chips */}
      <div className="platform-stats">
        {solved.map((s, i) => (
          <div key={i} className="pstat">
            <div className="pstat-val">{s.value}</div>
            <div className="pstat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
