/**
 * useExportCSV — shared CSV export hook for all admin leaderboards.
 *
 * Usage:
 *   const { exporting, exportCSV } = useExportCSV(fetchAll, buildRows, filename)
 *
 *   fetchAll  — async function that returns the full data array
 *   buildRows — (data: any[]) => { headers: string[], rows: string[][] }
 *   filename  — e.g. 'weekly_2026-06-07.csv'
 */
import { useState } from 'react'

export function useExportCSV(fetchAll, buildRows, filename) {
  const [exporting, setExporting] = useState(false)

  async function exportCSV() {
    if (exporting) return
    setExporting(true)
    try {
      const data = await fetchAll()
      const { headers, rows } = buildRows(data)

      const escape = (v) => {
        const s = v == null ? '' : String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s
      }

      const lines = [
        headers.map(escape).join(','),
        ...rows.map(r => r.map(escape).join(',')),
      ]
      const csv  = lines.join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('CSV export failed', e)
      alert('Export failed: ' + (e.message || 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  return { exporting, exportCSV }
}
