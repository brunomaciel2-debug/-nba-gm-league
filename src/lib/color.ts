/**
 * Given a hex color, returns '#ffffff' or '#111111'
 * depending on which has better contrast (WCAG luminance formula).
 */
export function textOnColor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0,2),16)/255
  const g = parseInt(h.slice(2,4),16)/255
  const b = parseInt(h.slice(4,6),16)/255
  // Linearise
  const lr = r<=0.03928?r/12.92:Math.pow((r+0.055)/1.055,2.4)
  const lg = g<=0.03928?g/12.92:Math.pow((g+0.055)/1.055,2.4)
  const lb = b<=0.03928?b/12.92:Math.pow((b+0.055)/1.055,2.4)
  const lum = 0.2126*lr + 0.7152*lg + 0.0722*lb
  return lum > 0.35 ? '#111111' : '#ffffff'
}

/**
 * Returns a readable version of a team color —
 * if the color is too dark for a dark background, lightens it.
 */
export function readableTeamColor(hex: string): string {
  const h = hex.replace('#','')
  const r = parseInt(h.slice(0,2),16)
  const g = parseInt(h.slice(2,4),16)
  const b = parseInt(h.slice(4,6),16)
  const lum = (0.299*r + 0.587*g + 0.114*b)/255
  if (lum < 0.25) {
    // Too dark — lighten by mixing with white
    const factor = 0.55
    const nr = Math.round(r + (255-r)*factor)
    const ng = Math.round(g + (255-g)*factor)
    const nb = Math.round(b + (255-b)*factor)
    return '#'+[nr,ng,nb].map(x=>x.toString(16).padStart(2,'0')).join('')
  }
  return hex.startsWith('#') ? hex : '#'+hex
}
