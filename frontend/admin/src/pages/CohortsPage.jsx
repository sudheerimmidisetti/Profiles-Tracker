// CohortsPage.jsx — Admin cohort management
import { useState, useEffect, useCallback, useRef } from 'react'
import { cohortsAPI } from '../api/api'
import {
  Users, Plus, Trash2, Upload, Search, X, ChevronRight,
  UserCheck, UserMinus, CheckCircle2, AlertCircle
} from 'lucide-react'

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [onDone])
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px', borderRadius: 12,
      background: type === 'error' ? '#450a0a' : '#052e16',
      border: `1px solid ${type === 'error' ? '#7f1d1d' : '#14532d'}`,
      color: type === 'error' ? '#fca5a5' : '#86efac',
      fontSize: '0.83rem', fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
    }}>
      {type === 'error' ? <AlertCircle size={15}/> : <CheckCircle2 size={15}/>}
      {msg}
    </div>
  )
}

// ── Cohort Members Panel ──────────────────────────────────────
function MembersPanel({ cohort, onClose }) {
  const [members,  setMembers]  = useState([])
  const [eligible, setEligible] = useState([])
  const [search,   setSearch]   = useState('')
  const [tab,      setTab]      = useState('members') // 'members' | 'add-csv' | 'add-manual'
  const [csvText,  setCsvText]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [toast,    setToast]    = useState(null)
  const fileRef = useRef()

  const loadMembers = useCallback(async () => {
    const r = await cohortsAPI.members(cohort.id)
    setMembers(r.data.data || [])
  }, [cohort.id])

  useEffect(() => { loadMembers() }, [loadMembers])

  useEffect(() => {
    if (tab !== 'add-manual') return
    const t = setTimeout(async () => {
      const r = await cohortsAPI.eligibleStudents(search)
      setEligible(r.data.data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [search, tab])

  async function removeMember(email) {
    await cohortsAPI.removeMember(cohort.id, email)
    setToast({ msg: 'Member removed', type: 'success' })
    loadMembers()
  }

  async function addByCSV() {
    const rolls = csvText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
    if (!rolls.length) return
    setLoading(true)
    try {
      const r = await cohortsAPI.addMembers(cohort.id, rolls)
      const { added, notFound, alreadyIn } = r.data.data
      setToast({ msg: `Added ${added}. ${notFound.length ? `Not found: ${notFound.slice(0,3).join(', ')}` : ''}`, type: 'success' })
      setCsvText('')
      loadMembers()
    } catch (e) {
      setToast({ msg: e.response?.data?.message || 'Error', type: 'error' })
    } finally { setLoading(false) }
  }

  async function addManual(roll) {
    setLoading(true)
    try {
      const r = await cohortsAPI.addMembers(cohort.id, [roll])
      const { added, notFound } = r.data.data
      if (notFound.length) setToast({ msg: 'Student not found or not verified', type: 'error' })
      else setToast({ msg: `Added successfully`, type: 'success' })
      loadMembers()
    } catch (e) {
      setToast({ msg: e.response?.data?.message || 'Error', type: 'error' })
    } finally { setLoading(false) }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCsvText(ev.target.result)
    reader.readAsText(file)
  }

  const memberEmails = new Set(members.map(m => m.email))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20,
        width: '100%', maxWidth: 720, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.6)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 2px', letterSpacing: '-.02em' }}>
                {cohort.name}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: 0 }}>
                {members.length} member{members.length !== 1 ? 's' : ''} · only verified students can be added
              </p>
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--fg-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={16}/></button>
          </div>
          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            {[
              { id: 'members',    label: `Members (${members.length})` },
              { id: 'add-csv',    label: 'Add via CSV' },
              { id: 'add-manual', label: 'Add Manually' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${tab === t.id ? 'var(--primary)' : 'var(--border)'}`,
                background: tab === t.id ? 'rgba(99,102,241,.1)' : 'var(--surface)',
                color: tab === t.id ? 'var(--primary)' : 'var(--fg-muted)',
                fontSize: '0.75rem', fontWeight: 600,
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* Members list */}
          {tab === 'members' && (
            members.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
                No members yet. Add students via CSV or manually.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr>{['Name','Roll','Branch','Platforms',''].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700,
                      fontSize: '0.65rem', color: 'var(--fg-muted)', textTransform: 'uppercase',
                      letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 8px', fontWeight: 600 }}>{m.full_name}</td>
                      <td style={{ padding: '8px 8px', color: 'var(--fg-muted)' }}>{m.roll_number}</td>
                      <td style={{ padding: '8px 8px', color: 'var(--fg-muted)' }}>{m.branch}</td>
                      <td style={{ padding: '8px 8px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(m.platforms || []).map(p => (
                            <span key={p} style={{
                              padding: '2px 7px', borderRadius: 4, fontSize: '0.65rem',
                              fontWeight: 700, textTransform: 'uppercase',
                              background: 'rgba(99,102,241,.1)', color: 'var(--primary)',
                            }}>{p}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                        <button onClick={() => removeMember(m.email)} style={{
                          padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                          border: '1px solid var(--border)', background: 'var(--surface)',
                          color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: '0.72rem', fontWeight: 600,
                        }}><UserMinus size={11}/> Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* CSV Add */}
          {tab === 'add-csv' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', margin: 0 }}>
                Paste roll numbers (comma, newline, or semicolon-separated), or upload a CSV file.
                Only students with at least one verified platform handle will be added.
              </p>
              <button onClick={() => fileRef.current?.click()} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 10,
                border: '1.5px dashed var(--border)', background: 'var(--surface)',
                color: 'var(--fg-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              }}>
                <Upload size={14}/> Upload CSV file
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="e.g. 21A91A0501&#10;21A91A0502&#10;21A91A0503"
                rows={8}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, resize: 'vertical',
                  border: '1.5px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--fg)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'monospace',
                }}
              />
              <button onClick={addByCSV} disabled={loading || !csvText.trim()} style={{
                padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                background: 'var(--primary)', color: '#fff',
                border: 'none', fontWeight: 700, fontSize: '0.85rem',
                opacity: loading || !csvText.trim() ? .5 : 1,
              }}>
                {loading ? 'Adding…' : 'Add Students'}
              </button>
            </div>
          )}

          {/* Manual Add */}
          {tab === 'add-manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                <input
                  placeholder="Search by name or roll number…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px 9px 34px',
                    borderRadius: 10, border: '1.5px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--fg)',
                    fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {eligible.length === 0 && search && (
                <div style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                  No verified students found for "{search}"
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {eligible.map((s, i) => {
                  const inCohort = memberEmails.has(s.email)
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--surface)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.full_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                          {s.roll_number} · {s.branch} · {(s.platforms||[]).join(', ')}
                        </div>
                      </div>
                      {inCohort ? (
                        <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12}/> In cohort
                        </span>
                      ) : (
                        <button onClick={() => addManual(s.roll_number)} disabled={loading} style={{
                          padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                          background: 'rgba(99,102,241,.1)', color: 'var(--primary)',
                          border: '1.5px solid rgba(99,102,241,.25)',
                          fontSize: '0.73rem', fontWeight: 700,
                        }}>
                          <UserCheck size={11} style={{ marginRight: 4 }}/> Add
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

// ── Create Cohort Modal ───────────────────────────────────────
function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const r = await cohortsAPI.create({ name: name.trim(), description: desc.trim() || null })
      onCreate(r.data.data)
      onClose()
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 18,
        width: '100%', maxWidth: 420, padding: 28,
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 20px', letterSpacing: '-.02em' }}>
          Create Cohort
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            placeholder="Cohort name (e.g. Batch 2026, DSA Club)"
            value={name} onChange={e => setName(e.target.value)}
            autoFocus
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              color: 'var(--fg)', fontSize: '0.85rem', outline: 'none',
            }}
          />
          <textarea
            placeholder="Description (optional)"
            value={desc} onChange={e => setDesc(e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, resize: 'vertical',
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              color: 'var(--fg)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 9, cursor: 'pointer',
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              color: 'var(--fg-muted)', fontSize: '0.83rem', fontWeight: 600,
            }}>Cancel</button>
            <button onClick={submit} disabled={loading || !name.trim()} style={{
              padding: '9px 20px', borderRadius: 9, cursor: 'pointer',
              background: 'var(--primary)', color: '#fff', border: 'none',
              fontWeight: 700, fontSize: '0.83rem',
              opacity: loading || !name.trim() ? .6 : 1,
            }}>{loading ? 'Creating…' : 'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function CohortsPage() {
  const [cohorts,  setCohorts]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null) // cohort for members panel
  const [creating, setCreating] = useState(false)
  const [toast,    setToast]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await cohortsAPI.list()
      setCohorts(r.data.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteCohort(id, name) {
    if (!confirm(`Delete cohort "${name}"? This removes all member associations.`)) return
    try {
      await cohortsAPI.delete(id)
      setCohorts(c => c.filter(x => x.id !== id))
      setToast({ msg: `Cohort "${name}" deleted`, type: 'success' })
    } catch (e) {
      setToast({ msg: e.response?.data?.message || 'Failed to delete', type: 'error' })
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-.03em', margin: '0 0 4px' }}>
            Cohorts
          </h1>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem', margin: 0 }}>
            Group students for filtered contest views. Only students with verified handles can be added.
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 18px', borderRadius: 10,
          background: 'var(--primary)', color: '#fff', border: 'none',
          fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer',
        }}>
          <Plus size={15}/> New Cohort
        </button>
      </div>

      {/* Cohort cards */}
      {loading ? (
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>Loading…</div>
      ) : cohorts.length === 0 ? (
        <div style={{
          border: '2px dashed var(--border)', borderRadius: 16,
          padding: '48px 24px', textAlign: 'center', color: 'var(--fg-muted)',
        }}>
          <Users size={32} style={{ opacity: .3, marginBottom: 12 }} />
          <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.9rem' }}>No cohorts yet</p>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>Create a cohort to group students for contest filtering.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cohorts.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px', borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border)',
              transition: 'border-color .12s',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 11,
                background: 'rgba(99,102,241,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-.01em' }}>{c.name}</div>
                {c.description && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 2 }}>{c.description}</div>
                )}
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 4 }}>
                  {c.member_count} member{c.member_count !== 1 ? 's' : ''}
                  {c.created_by && ` · created by ${c.created_by}`}
                </div>
              </div>
              <button onClick={() => setSelected(c)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
                border: '1.5px solid var(--border)', background: 'var(--bg)',
                color: 'var(--fg-muted)', fontSize: '0.78rem', fontWeight: 600,
              }}>
                Manage <ChevronRight size={13}/>
              </button>
              <button onClick={() => deleteCohort(c.id, c.name)} style={{
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <MembersPanel
          cohort={selected}
          onClose={() => { setSelected(null); load() }}
        />
      )}
      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreate={c => setCohorts(prev => [c, ...prev])}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
