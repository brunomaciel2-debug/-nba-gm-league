// A real, current (2025-26) top-100 NBA player-popularity ranking, provided
// directly by the commissioner as ground truth. Real-world fame isn't purely
// a function of this-season quality — legacy, career achievements, and pure
// star charisma matter too (Steph Curry and LeBron James top real polls
// despite this game's real_ovr rating both a notch below the very best
// current players, purely due to age-based decline modeling; a hyped rookie
// like Cooper Flagg can rank far above proven veterans on name recognition
// alone). This list is blended in as a FLOOR — a player is at least as
// famous as this ranking says, but can still exceed it through genuine
// in-game brilliance/market/nationality if that combination scores higher.
//
// Names match this game's players.name format exactly (verified live against
// the DB) — "Jimmy Butler" is stored as "Jimmy Butler III"; a duplicate
// Jalen Brunson entry in the source list (position 95) was corrected to
// Devin Vassell per the commissioner's own note.
export const LEGACY_POPULARITY_RANK: string[] = [
  'Stephen Curry', 'LeBron James', 'Luka Doncic', 'Victor Wembanyama', 'Shai Gilgeous-Alexander',
  'Anthony Edwards', 'Jayson Tatum', 'Nikola Jokic', 'Kevin Durant', 'Giannis Antetokounmpo',
  'Ja Morant', 'Cooper Flagg', 'Devin Booker', 'Jalen Brunson', 'LaMelo Ball',
  'Kyrie Irving', 'Jimmy Butler III', 'Anthony Davis', 'Karl-Anthony Towns', 'Tyrese Haliburton',
  'Donovan Mitchell', 'Jaylen Brown', 'Trae Young', 'Damian Lillard', 'Zion Williamson',
  'Paolo Banchero', 'Cade Cunningham', 'Tyrese Maxey', 'Chet Holmgren', 'Evan Mobley',
  "De'Aaron Fox", 'Kawhi Leonard', 'James Harden', 'Joel Embiid', 'Jaren Jackson Jr.',
  'Alperen Sengun', 'Jamal Murray', 'Amen Thompson', 'Jalen Williams', 'Scottie Barnes',
  'Franz Wagner', 'Darius Garland', 'Bam Adebayo', 'RJ Barrett', 'Austin Reaves',
  'Brandon Miller', 'Klay Thompson', 'Jrue Holiday', 'Desmond Bane', 'OG Anunoby',
  'Jalen Green', 'Jarrett Allen', 'Mikal Bridges', 'Kristaps Porzingis', 'DeMar DeRozan',
  'Chris Paul', 'Rudy Gobert', 'Alex Sarr', 'Josh Giddey', 'Walker Kessler',
  'Brook Lopez', 'Andrew Wiggins', 'CJ McCollum', 'Michael Porter Jr.', 'Jonathan Kuminga',
  'Scoot Henderson', 'Derrick White', 'Jabari Smith Jr.', 'Naz Reid', 'Tyler Herro',
  'Immanuel Quickley', 'Anfernee Simons', 'Julius Randle', 'Draymond Green', 'Domantas Sabonis',
  'Bradley Beal', 'Pascal Siakam', 'Jalen Suggs', 'Keegan Murray', 'Nic Claxton',
  'Cam Thomas', 'Jalen Duren', 'Zach LaVine', 'Isaiah Hartenstein', 'Aaron Gordon',
  'Mark Williams', 'Trey Murphy III', 'Myles Turner', 'Dereck Lively II', 'Jaden Ivey',
  'Jalen Johnson', 'Brandon Ingram', 'Fred VanVleet', 'Khris Middleton', 'Devin Vassell',
  'Bilal Coulibaly', 'Reed Sheppard', 'Stephon Castle', 'Ace Bailey', 'Dylan Harper',
]

const RANK_BY_NAME: Record<string, number> = Object.fromEntries(
  LEGACY_POPULARITY_RANK.map((name, i) => [name, i + 1])
)

// Linear floor from rank 1 (undisputed #1 -> ceiling) down to rank 100
// (still a real, recognizable name -> a solid but non-elite floor). Anyone
// outside the top 100 gets no floor at all — quality/market/nationality
// alone determine their fame, same as before this list existed.
export function legacyFameFloor(name: string): number | null {
  const rank = RANK_BY_NAME[name]
  if (!rank) return null
  return 99 - (rank - 1) * (99 - 40) / 99
}
