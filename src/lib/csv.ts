// Minimal hand-rolled CSV encode/parse — deliberately dependency-free.
// The `xlsx` (SheetJS) package was evaluated for the Draft Class upload
// feature and rejected: `npm audit` flags it with an unpatched high-severity
// prototype-pollution + ReDoS vulnerability ("No fix available"). CSV avoids
// pulling in any file-format parsing library at all.

function escapeCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(escapeCell).join(',')]
  for (const row of rows) lines.push(columns.map(c => escapeCell(row[c])).join(','))
  return lines.join('\r\n')
}

// RFC 4180-ish parser: handles quoted fields containing commas, quotes
// (doubled), and embedded newlines. Returns an array of header-keyed rows.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = '', row: string[] = [], inQuotes = false
  const src = text.replace(/^﻿/, '') // strip BOM from Excel-saved files

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += c
      continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === ',') { row.push(field); field = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  const nonEmpty = rows.filter(r => r.some(cell => cell.trim() !== ''))
  if (nonEmpty.length === 0) return []
  const headers = nonEmpty[0].map(h => h.trim())
  return nonEmpty.slice(1).map(r => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim() })
    return obj
  })
}
