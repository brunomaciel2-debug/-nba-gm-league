export function readableTeamColor(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#1d4ed8'
  const r = parseInt(h.slice(0,2),16)
  const g = parseInt(h.slice(2,4),16)
  const b = parseInt(h.slice(4,6),16)
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255
  // On beige background (#faf8f5 ~0.97 luminance), need dark colors
  // If color is too light (luminance > 0.6), darken it significantly
  if (luminance > 0.75) {
    // Very light: darken a lot
    const factor = 0.35
    return '#' + [r,g,b].map(c => Math.round(c*factor).toString(16).padStart(2,'0')).join('')
  }
  if (luminance > 0.55) {
    // Medium light: darken moderately  
    const factor = 0.55
    return '#' + [r,g,b].map(c => Math.round(c*factor).toString(16).padStart(2,'0')).join('')
  }
  // Dark or saturated: use as-is (already readable on light bg)
  return '#' + h
}
