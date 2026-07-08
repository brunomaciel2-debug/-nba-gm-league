// Real away-game travel cost — previously a flat "$200K/month, ~20 away
// games" guess in FinancesTab's Projections tab, never posted anywhere.
// Distance-based, using each team's real home city coordinates, so a short
// regional trip (Knicks @ Nets) costs a fraction of a true cross-country one
// (Celtics @ Lakers) — matching how real NBA charter/hotel costs actually
// scale with distance, not a flat per-game number.

// City-centre coordinates for each team's home market — precise enough for
// a real distance signal, not meant to be exact arena addresses.
export const CITY_COORDS: Record<string, { lat: number, lon: number }> = {
  ATL: { lat: 33.7490, lon: -84.3880 },
  BOS: { lat: 42.3601, lon: -71.0589 },
  BKN: { lat: 40.6782, lon: -73.9442 },
  CHA: { lat: 35.2271, lon: -80.8431 },
  CHI: { lat: 41.8781, lon: -87.6298 },
  CLE: { lat: 41.4993, lon: -81.6944 },
  DAL: { lat: 32.7767, lon: -96.7970 },
  DEN: { lat: 39.7392, lon: -104.9903 },
  DET: { lat: 42.3314, lon: -83.0458 },
  GSW: { lat: 37.7749, lon: -122.4194 },
  HOU: { lat: 29.7604, lon: -95.3698 },
  IND: { lat: 39.7684, lon: -86.1581 },
  LAC: { lat: 33.9416, lon: -118.3410 },
  LAL: { lat: 34.0430, lon: -118.2673 },
  MEM: { lat: 35.1495, lon: -90.0490 },
  MIA: { lat: 25.7617, lon: -80.1918 },
  MIL: { lat: 43.0389, lon: -87.9065 },
  MIN: { lat: 44.9778, lon: -93.2650 },
  NOP: { lat: 29.9511, lon: -90.0715 },
  NYK: { lat: 40.7505, lon: -73.9934 },
  OKC: { lat: 35.4676, lon: -97.5164 },
  ORL: { lat: 28.5383, lon: -81.3792 },
  PHI: { lat: 39.9526, lon: -75.1652 },
  PHX: { lat: 33.4484, lon: -112.0740 },
  POR: { lat: 45.5152, lon: -122.6784 },
  SAC: { lat: 38.5816, lon: -121.4944 },
  SAS: { lat: 29.4241, lon: -98.4936 },
  TOR: { lat: 43.6532, lon: -79.3832 },
  UTA: { lat: 40.7608, lon: -111.8910 },
  WAS: { lat: 38.9072, lon: -77.0369 },
}

const EARTH_RADIUS_MILES = 3959

export function cityDistanceMiles(teamA: string, teamB: string): number {
  const a = CITY_COORDS[teamA], b = CITY_COORDS[teamB]
  if (!a || !b) return 0
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// Charter flight (base cost even for a short hop + a real per-mile rate for
// the whole travelling party) + one hotel night + meal per diem for the
// travelling roster/staff — a single-game trip assumption (this game engine
// doesn't model multi-city road-trip grouping), which is a reasonable
// simplification, not an attempt at exact real-world accounting.
const BASE_CHARTER_COST = 15000
const PER_MILE_RATE = 12
const HOTEL_PER_NIGHT = 18000
const PER_DIEM = 5000

export function computeAwayTravelCost(distanceMiles: number): number {
  return Math.round(BASE_CHARTER_COST + distanceMiles * PER_MILE_RATE + HOTEL_PER_NIGHT + PER_DIEM)
}
