// StudentsPage.jsx — with branch + platform filters + sync button per row
import { useState, useEffect, useCallback, useRef } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import StudentsTable from '../components/StudentsTable'
import { Search, X, RefreshCw } from 'lucide-react'

const BRANCHES  = ['All', 'CSE', 'CSE1', 'IT', 'AIML']
const PLATFORMS = ['All', 'LeetCode', 'CodeChef', 'Codeforces', 'HackerRank']
const PLATFORM_MAP = { LeetCode: 'leetcode', CodeChef: 'codechef', Codeforces: 'codeforces', HackerRank: 'hackerrank' }

const STATUS_FILTERS = [
  { label: 'All',         value: 'all' },
  { label: 'Verified',    value: 'verified' },
  { label: 'Unverified',  value: 'unverified' },
  { label: 'Blocklisted', value: 'blocklisted' },
]

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [branch,   setBranch]   = useState('All')
  const [platform, setPlatform] = useState('All')
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const searchRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (filter === 'verified')    params.verified    = true
    if (filter === 'unverified')  params.verified    = false
    if (filter === 'blocklisted') params.blocklisted = true
    if (search.trim())            params.search      = search.trim()
    if (branch !== 'All')         params.branch      = branch
    if (platform !== 'All')       params.platform    = PLATFORM_MAP[platform]

    adminAPI.listStudents(params)
      .then(r => { setStudents(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, filter, search, branch, platform])

  useEffect(() => { load() }, [load])

  const handleSearch = (val) => { setSearch(val); setPage(1) }
  const clearSearch  = ()    => { setSearch(''); setPage(1); searchRef.current?.focus() }

  async function syncAll() {
    setSyncing(true)
    try { await adminAPI.triggerSync() }
    catch (e) { console.error(e) }
    finally { setSyncing(false) }
  }

  function resetFilters() {
    setSearch(''); setBranch('All'); setPlatform('All'); setFilter('all'); setPage(1)
  }

  const hasFilters = search || branch !== 'All' || platform !== 'All' || filter !== 'all'

  return (
    <>
      <AdminHeader title="Students" breadcrumb="Management" onRefresh={load} />
      <div className="page">
        {/* Toolbar */}
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
          {/* Search */}
          <div className="search-box">
            <Search size={14} className="search-box-ico" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search name, email, roll, branch…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={clearSearch}><X size={13} /></button>
            )}
          </div>

          {/* Status filter */}
          <div className="filter-pills">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                className={`f-pill${filter === f.value ? ' active' : ''}`}
                onClick={() => { setFilter(f.value); setPage(1) }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="count-badge">{total.toLocaleString()} students</span>

          {/* Sync All */}
          <button className="btn btn-ghost" onClick={syncAll} disabled={syncing} style={{ marginLeft: 'auto' }}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync All'}
          </button>
        </div>

        {/* Branch + Platform filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, padding: '0 2px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', fontWeight: 600 }}>Branch:</span>
          <div className="filter-pills">
            {BRANCHES.map(b => (
              <button key={b} className={`f-pill${branch === b ? ' active' : ''}`} onClick={() => { setBranch(b); setPage(1) }}>{b}</button>
            ))}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', fontWeight: 600, marginLeft: 8 }}>Platform:</span>
          <div className="filter-pills">
            {PLATFORMS.map(p => (
              <button key={p} className={`f-pill${platform === p ? ' active' : ''}`} onClick={() => { setPlatform(p); setPage(1) }}>{p}</button>
            ))}
          </div>
          {hasFilters && (
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', height: 26, padding: '0 10px', color: 'var(--fg-subtle)' }}
              onClick={resetFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading students…</div>
        ) : (
          <StudentsTable
            students={students}
            total={total}
            page={page}
            onPageChange={setPage}
            onRefresh={load}
            showSyncButton
          />
        )}
      </div>
    </>
  )
}
