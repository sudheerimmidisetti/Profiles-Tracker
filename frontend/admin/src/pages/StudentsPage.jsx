// StudentsPage.jsx — dynamic filters from DB + SyncButton with modal
import { useState, useEffect, useCallback, useRef } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader    from '../components/AdminHeader'
import StudentsTable  from '../components/StudentsTable'
import SyncButton     from '../components/SyncButton'
import { Search, X, ChevronDown } from 'lucide-react'

// Platforms are static (no DB source needed – the table is fixed)
const PLATFORMS    = ['All', 'LeetCode', 'CodeChef', 'Codeforces', 'HackerRank']
const PLATFORM_MAP = { LeetCode: 'leetcode', CodeChef: 'codechef', Codeforces: 'codeforces', HackerRank: 'hackerrank' }

const STATUS_FILTERS = [
  { label: 'All',         value: 'all' },
  { label: 'Verified',    value: 'verified' },
  { label: 'Unverified',  value: 'unverified' },
  { label: 'Blocklisted', value: 'blocklisted' },
]

// ── Re-usable select dropdown ───────────────────────────────────────────────
function FilterSelect({ label, value, options, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {label}:
      </span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            appearance: 'none',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 28px 4px 10px',
            fontSize: '0.78rem',
            color: 'var(--fg)',
            cursor: 'pointer',
            minWidth: 110,
            outline: 'none',
          }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={12} style={{
          position: 'absolute', right: 8, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--fg-muted)', pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}

export default function StudentsPage() {
  const [students,  setStudents]  = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  const [branch,    setBranch]    = useState('All')
  const [platform,  setPlatform]  = useState('All')
  const [college,   setCollege]   = useState('All')
  const [year,      setYear]      = useState('All')
  const [loading,   setLoading]   = useState(true)
  const searchRef = useRef(null)

  // Dynamic filter options fetched from DB
  const [filterOpts, setFilterOpts] = useState({ colleges: [], years: [], branches: [] })

  // Fetch filter options once on mount
  useEffect(() => {
    adminAPI.getFilters()
      .then(r => setFilterOpts(r.data.data || r.data))
      .catch(console.error)
  }, [])

  const branchOptions  = [{ value: 'All', label: 'All' }, ...filterOpts.branches.map(b => ({ value: b, label: b }))]
  const collegeOptions = [{ value: 'All', label: 'All' }, ...filterOpts.colleges.map(c => ({ value: c, label: c }))]
  const yearOptions    = [{ value: 'All', label: 'All' }, ...filterOpts.years.map(y => ({ value: String(y), label: String(y) }))]
  const platformOptions= [{ value: 'All', label: 'All' }, ...PLATFORMS.slice(1).map(p => ({ value: p, label: p }))]

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (filter === 'verified')    params.verified    = true
    if (filter === 'unverified')  params.verified    = false
    if (filter === 'blocklisted') params.blocklisted = true
    if (search.trim())            params.search      = search.trim()
    if (branch   !== 'All')       params.branch      = branch
    if (platform  !== 'All')      params.platform    = PLATFORM_MAP[platform]
    if (college  !== 'All')       params.college     = college
    if (year     !== 'All')       params.passout_year = year

    adminAPI.listStudents(params)
      .then(r => { setStudents(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, filter, search, branch, platform, college, year])

  useEffect(() => { load() }, [load])

  const handleSearch = val => { setSearch(val); setPage(1) }
  const clearSearch  = ()  => { setSearch(''); setPage(1); searchRef.current?.focus() }

  function resetFilters() {
    setSearch(''); setBranch('All'); setPlatform('All')
    setCollege('All'); setYear('All'); setFilter('all'); setPage(1)
  }

  const hasFilters = search || branch !== 'All' || platform !== 'All' ||
                     college !== 'All' || year !== 'All' || filter !== 'all'

  return (
    <>
      <AdminHeader title="Students" breadcrumb="Management" onRefresh={load} extra={<SyncButton />} />
      <div className="page">
        {/* Toolbar row 1 — search + status + count */}
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
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

          {/* Status pills */}
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

          <span className="count-badge" style={{ marginLeft: 'auto' }}>{total.toLocaleString()} students</span>
        </div>

        {/* Toolbar row 2 — dropdown filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <FilterSelect
            label="Branch"
            value={branch}
            options={branchOptions}
            onChange={v => { setBranch(v); setPage(1) }}
          />
          <FilterSelect
            label="Platform"
            value={platform}
            options={platformOptions}
            onChange={v => { setPlatform(v); setPage(1) }}
          />
          <FilterSelect
            label="College"
            value={college}
            options={collegeOptions}
            onChange={v => { setCollege(v); setPage(1) }}
            disabled={filterOpts.colleges.length === 0}
          />
          <FilterSelect
            label="Passout Year"
            value={year}
            options={yearOptions}
            onChange={v => { setYear(v); setPage(1) }}
            disabled={filterOpts.years.length === 0}
          />

          {hasFilters && (
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 'auto', fontSize: '0.75rem', height: 28, padding: '0 10px', color: 'var(--fg-subtle)' }}
              onClick={resetFilters}
            >
              <X size={12} /> Clear filters
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
          />
        )}
      </div>
    </>
  )
}
