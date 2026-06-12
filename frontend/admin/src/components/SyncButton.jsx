import { useState } from 'react'
import { adminAPI } from '../api/api'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

export default function SyncButton() {
  const [state, setState] = useState('idle') // idle | loading | success | error

  const handleSync = async () => {
    if (state === 'loading') return
    setState('loading')
    try {
      await adminAPI.triggerSync()
      setState('success')
      setTimeout(() => setState('idle'), 4000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  const icons = {
    idle:    <RefreshCw size={13} />,
    loading: <div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />,
    success: <CheckCircle size={13} />,
    error:   <AlertCircle size={13} />,
  }
  const labels = {
    idle:    'Sync Now',
    loading: 'Starting…',
    success: 'Sync Started',
    error:   'Failed',
  }
  const colors = {
    idle:    {},
    loading: {},
    success: { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' },
    error:   { background: 'var(--danger-bg)',  color: 'var(--danger)',  border: '1px solid var(--danger-border)' },
  }

  return (
    <button
      className="btn btn-sm btn-ghost"
      onClick={handleSync}
      disabled={state === 'loading'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, ...colors[state] }}
      title="Trigger a full profile sync for all students"
    >
      {icons[state]}
      {labels[state]}
    </button>
  )
}
