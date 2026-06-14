'use client';

import { useState, useEffect, useRef } from 'react';

// ── NBA Teams ───────────────────────────────────────────────
const NBA_TEAMS = [
  { id: 'ATL', name: 'Atlanta Hawks' },
  { id: 'BOS', name: 'Boston Celtics' },
  { id: 'BKN', name: 'Brooklyn Nets' },
  { id: 'CHA', name: 'Charlotte Hornets' },
  { id: 'CHI', name: 'Chicago Bulls' },
  { id: 'CLE', name: 'Cleveland Cavaliers' },
  { id: 'DAL', name: 'Dallas Mavericks' },
  { id: 'DEN', name: 'Denver Nuggets' },
  { id: 'DET', name: 'Detroit Pistons' },
  { id: 'GSW', name: 'Golden State Warriors' },
  { id: 'HOU', name: 'Houston Rockets' },
  { id: 'IND', name: 'Indiana Pacers' },
  { id: 'LAC', name: 'LA Clippers' },
  { id: 'LAL', name: 'LA Lakers' },
  { id: 'MEM', name: 'Memphis Grizzlies' },
  { id: 'MIA', name: 'Miami Heat' },
  { id: 'MIL', name: 'Milwaukee Bucks' },
  { id: 'MIN', name: 'Minnesota Timberwolves' },
  { id: 'NOP', name: 'New Orleans Pelicans' },
  { id: 'NYK', name: 'New York Knicks' },
  { id: 'OKC', name: 'Oklahoma City Thunder' },
  { id: 'ORL', name: 'Orlando Magic' },
  { id: 'PHI', name: 'Philadelphia 76ers' },
  { id: 'PHX', name: 'Phoenix Suns' },
  { id: 'POR', name: 'Portland Trail Blazers' },
  { id: 'SAC', name: 'Sacramento Kings' },
  { id: 'SAS', name: 'San Antonio Spurs' },
  { id: 'TOR', name: 'Toronto Raptors' },
  { id: 'UTA', name: 'Utah Jazz' },
  { id: 'WAS', name: 'Washington Wizards' },
];

const SPECIAL_TEAMS = [
  { id: 'ALL', name: 'All-Stars East' },
  { id: 'RVS', name: 'All-Stars West' },
  { id: 'ROO', name: 'Rookie Team' },
  { id: 'SOP', name: 'Sophomore Team' },
];

const WORLD_REGIONS = [
  {
    region: 'Europe',
    teams: [
      { id: 'EFS', name: 'Anadolu Efes' },
      { id: 'ASM', name: 'AS Monaco' },
      { id: 'CZV', name: 'Red Star Belgrade' },
      { id: 'OAM', name: 'Emporio Armani Milan' },
      { id: 'FCB', name: 'FC Barcelona' },
      { id: 'FCB2', name: 'Bayern Munich' },
      { id: 'FNR', name: 'Fenerbahce' },
      { id: 'HAP', name: 'Hapoel Tel Aviv' },
      { id: 'BAS', name: 'Baskonia' },
      { id: 'ASV', name: 'ASVEL' },
      { id: 'MAC', name: 'Maccabi Tel Aviv' },
      { id: 'OLY', name: 'Olympiacos' },
      { id: 'PAN', name: 'Panathinaikos' },
      { id: 'PAR', name: 'Paris Basketball' },
      { id: 'PAT', name: 'Partizan Belgrade' },
      { id: 'RMA', name: 'Real Madrid' },
      { id: 'VAL', name: 'Valencia Basket' },
      { id: 'VIB', name: 'Virtus Bologna' },
      { id: 'ZAL', name: 'Zalgiris Kaunas' },
    ],
  },
  {
    region: 'Asia',
    teams: [
      { id: 'DUB', name: 'Dubai Basketball' },
      { id: 'LFP', name: 'Liaoning Flying Leopards' },
    ],
  },
  {
    region: 'Oceania',
    teams: [
      { id: 'MEL', name: 'Melbourne United' },
      { id: 'SYD', name: 'Sydney Kings' },
    ],
  },
  {
    region: 'South America',
    teams: [{ id: 'FLA', name: 'Flamengo' }],
  },
];

// ── Types ───────────────────────────────────────────────────
type Player = {
  id: string;
  name: string;
  photo_url?: string;
  team_id?: string;
  gleague_team_id?: string;
};

type StaffMember = {
  id: string;
  name: string;
  role: string;
  photo_url?: string;
  team_id?: string;
  gleague_team_id?: string;
};

type NbaTeam = { id: string; abbreviation: string; full_name: string; logo_url?: string };
type GLeagueTeam = { id: string; abbreviation: string; full_name: string; logo_url?: string };
type WorldTeam = { id: string; abbreviation: string; full_name: string; logo_url?: string };

// ── Photo Card ──────────────────────────────────────────────
function PhotoCard({
  id,
  name,
  currentPhoto,
  label,
  onSave,
}: {
  id: string;
  name: string;
  currentPhoto?: string;
  label?: string;
  onSave: (id: string, url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(currentPhoto || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handle = async () => {
    if (!url.trim()) return;
    setSaving(true);
    await onSave(id, url.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{
      background: '#1a1a2e',
      border: '1px solid #2a2a4a',
      borderRadius: 8,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
    }}>
      {currentPhoto ? (
        <img
          src={currentPhoto}
          alt={name}
          style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }}
        />
      ) : (
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#2a2a4a', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#94a3b8',
        }}>
          {initials}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{name}</div>
      {label && <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>{label}</div>}
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Photo URL"
        style={{
          width: '100%', padding: '4px 6px', fontSize: 10,
          background: '#0f0f1a', border: '1px solid #3b82f6',
          borderRadius: 4, color: '#e2e8f0', boxSizing: 'border-box',
        }}
      />
      <button
        onClick={handle}
        disabled={saving}
        style={{
          width: '100%', padding: '4px 0', fontSize: 10,
          background: saved ? '#059669' : '#3b82f6',
          color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  );
}

// ── Logo Card ───────────────────────────────────────────────
function LogoCard({
  id,
  name,
  currentLogo,
  type,
  onSave,
}: {
  id: string;
  name: string;
  currentLogo?: string;
  type: 'nba' | 'gleague' | 'world';
  onSave: (id: string, url: string, type: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(currentLogo || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handle = async () => {
    if (!url.trim()) return;
    setSaving(true);
    await onSave(id, url.trim(), type);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{
      background: '#1a1a2e', border: '1px solid #2a2a4a',
      borderRadius: 8, padding: 12, display: 'flex',
      flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      {currentLogo ? (
        <img src={currentLogo} alt={name} style={{ width: 56, height: 56, objectFit: 'contain' }} />
      ) : (
        <div style={{
          width: 56, height: 56, background: '#2a2a4a', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#64748b', textAlign: 'center',
        }}>
          No logo
        </div>
      )}
      <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{name}</div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Logo URL"
        style={{
          width: '100%', padding: '4px 6px', fontSize: 10,
          background: '#0f0f1a', border: '1px solid #3b82f6',
          borderRadius: 4, color: '#e2e8f0', boxSizing: 'border-box',
        }}
      />
      <button
        onClick={handle}
        disabled={saving}
        style={{
          width: '100%', padding: '4px 0', fontSize: 10,
          background: saved ? '#059669' : '#3b82f6',
          color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      margin: '24px 0 12px',
      borderBottom: '1px solid #2a2a4a', paddingBottom: 8,
    }}>
      <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>{title}</h3>
      {count !== undefined && (
        <span style={{
          background: '#1e3a5f', color: '#93c5fd', fontSize: 11,
          padding: '2px 8px', borderRadius: 12, fontWeight: 600,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── Grid ────────────────────────────────────────────────────
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 12,
    }}>
      {children}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function MediaManagerPage() {
  const [activeTab, setActiveTab] = useState<'logos' | 'photos'>('logos');
  const [photoSubTab, setPhotoSubTab] = useState<'players' | 'staff'>('players');

  // Logos
  const [nbaTeams, setNbaTeams] = useState<NbaTeam[]>([]);
  const [gleagueTeams, setGleagueTeams] = useState<GLeagueTeam[]>([]);
  const [worldTeams, setWorldTeams] = useState<WorldTeam[]>([]);

  // Players
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState<string>('__all_nba__');

  // Staff
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaffTeam, setSelectedStaffTeam] = useState<string>('__all_nba__');

  const [loading, setLoading] = useState(true);

  // ── Fetch everything ──────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [teamsRes, gleagueRes, worldRes, playersRes, staffRes] = await Promise.all([
          fetch('/api/admin/media?type=nba_teams'),
          fetch('/api/admin/media?type=gleague_teams'),
          fetch('/api/admin/media?type=world_teams'),
          fetch('/api/admin/media?type=players'),
          fetch('/api/admin/media?type=staff'),
        ]);
        const [t, g, w, p, s] = await Promise.all([
          teamsRes.json(), gleagueRes.json(), worldRes.json(),
          playersRes.json(), staffRes.json(),
        ]);
        setNbaTeams(t.teams || []);
        setGleagueTeams(g.teams || []);
        setWorldTeams(w.teams || []);
        setPlayers(p.players || []);
        setStaff(s.staff || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Save handlers ─────────────────────────────────────────
  const savePhoto = async (id: string, url: string) => {
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'player_photo', id, url }),
    });
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, photo_url: url } : p)));
  };

  const saveStaffPhoto = async (id: string, url: string) => {
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'staff_photo', id, url }),
    });
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, photo_url: url } : s)));
  };

  const saveLogo = async (id: string, url: string, type: string) => {
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: `${type}_logo`, id, url }),
    });
    if (type === 'nba') setNbaTeams((prev) => prev.map((t) => (t.id === id ? { ...t, logo_url: url } : t)));
    if (type === 'gleague') setGleagueTeams((prev) => prev.map((t) => (t.id === id ? { ...t, logo_url: url } : t)));
    if (type === 'world') setWorldTeams((prev) => prev.map((t) => (t.id === id ? { ...t, logo_url: url } : t)));
  };

  // ── Filter helpers ────────────────────────────────────────
  const getFilteredPlayers = () => {
    if (selectedPlayerTeam === '__fa__') return players.filter((p) => !p.team_id && !p.gleague_team_id);
    if (selectedPlayerTeam === '__draft__') return []; // no draft players yet
    if (selectedPlayerTeam.startsWith('gl_')) {
      const glId = selectedPlayerTeam.replace('gl_', '');
      return players.filter((p) => p.gleague_team_id === glId);
    }
    // NBA team
    return players.filter((p) => p.team_id === selectedPlayerTeam);
  };

  const getFilteredStaff = () => {
    if (selectedStaffTeam === '__staff_fa__') return staff.filter((s) => !s.team_id && !s.gleague_team_id);
    if (selectedStaffTeam.startsWith('gl_')) {
      const glId = selectedStaffTeam.replace('gl_', '');
      return staff.filter((s) => s.gleague_team_id === glId);
    }
    return staff.filter((s) => s.team_id === selectedStaffTeam);
  };

  // ── Build NBA + G-League team options for selector ────────
  const nbaTeamMap = Object.fromEntries(nbaTeams.map((t) => [t.id, t]));
  const gleagueTeamMap = Object.fromEntries(gleagueTeams.map((t) => [t.id, t]));

  // count helpers
  const playerCountForTeam = (key: string) => {
    if (key === '__fa__') return players.filter((p) => !p.team_id && !p.gleague_team_id).length;
    if (key === '__draft__') return 0;
    if (key.startsWith('gl_')) {
      const glId = key.replace('gl_', '');
      return players.filter((p) => p.gleague_team_id === glId).length;
    }
    return players.filter((p) => p.team_id === key).length;
  };

  const staffCountForTeam = (key: string) => {
    if (key === '__staff_fa__') return staff.filter((s) => !s.team_id && !s.gleague_team_id).length;
    if (key.startsWith('gl_')) {
      const glId = key.replace('gl_', '');
      return staff.filter((s) => s.gleague_team_id === glId).length;
    }
    return staff.filter((s) => s.team_id === key).length;
  };

  // ── Styles ────────────────────────────────────────────────
  const tabStyle = (active: boolean) => ({
    padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
    fontSize: 13, border: 'none',
    background: active ? '#3b82f6' : '#1a1a2e',
    color: active ? '#fff' : '#94a3b8',
  });

  const subTabStyle = (active: boolean) => ({
    padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
    fontSize: 12, border: 'none',
    background: active ? '#1e3a5f' : '#111827',
    color: active ? '#93c5fd' : '#64748b',
  });

  const selectorBtnStyle = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
    fontSize: 11, border: '1px solid',
    borderColor: active ? '#3b82f6' : '#2a2a4a',
    background: active ? '#1e3a5f' : 'transparent',
    color: active ? '#93c5fd' : '#64748b',
    fontWeight: active ? 700 : 400,
    whiteSpace: 'nowrap' as const,
  });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 16 }}>
        Loading Media Manager...
      </div>
    );
  }

  const filteredPlayers = getFilteredPlayers();
  const filteredStaff = getFilteredStaff();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif', padding: 24 }}>
      {/* Header */}
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>📸 Media Manager</h1>
        <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: 13 }}>
          Manage logos, player photos and staff photos
        </p>

        {/* Main Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button style={tabStyle(activeTab === 'logos')} onClick={() => setActiveTab('logos')}>🏀 Logos</button>
          <button style={tabStyle(activeTab === 'photos')} onClick={() => setActiveTab('photos')}>👤 Photos</button>
        </div>

        {/* ── LOGOS TAB ── */}
        {activeTab === 'logos' && (
          <div>
            <SectionHeader title="NBA Teams" count={nbaTeams.length} />
            <Grid>
              {nbaTeams.map((t) => (
                <LogoCard key={t.id} id={t.id} name={t.full_name} currentLogo={t.logo_url} type="nba" onSave={saveLogo} />
              ))}
            </Grid>

            <SectionHeader title="G-League Teams" count={gleagueTeams.length} />
            <Grid>
              {gleagueTeams.map((t) => (
                <LogoCard key={t.id} id={t.id} name={t.full_name} currentLogo={t.logo_url} type="gleague" onSave={saveLogo} />
              ))}
            </Grid>

            <SectionHeader title="Rest of the World" />
            {WORLD_REGIONS.map((region) => {
              const regionTeams = region.teams.map((rt) => worldTeams.find((wt) => wt.abbreviation === rt.id) || { id: rt.id, abbreviation: rt.id, full_name: rt.name, logo_url: undefined });
              return (
                <div key={region.region}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {region.region}
                  </div>
                  <Grid>
                    {regionTeams.map((t) => (
                      <LogoCard key={t.id} id={t.id} name={t.full_name} currentLogo={t.logo_url} type="world" onSave={saveLogo} />
                    ))}
                  </Grid>
                </div>
              );
            })}

            <SectionHeader title="Special Teams" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 640 }}>
              {SPECIAL_TEAMS.map((st) => {
                const t = nbaTeams.find((nt) => nt.abbreviation === st.id);
                return (
                  <LogoCard key={st.id} id={st.id} name={st.name} currentLogo={t?.logo_url} type="nba" onSave={saveLogo} />
                );
              })}
            </div>
          </div>
        )}

        {/* ── PHOTOS TAB ── */}
        {activeTab === 'photos' && (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button style={subTabStyle(photoSubTab === 'players')} onClick={() => setPhotoSubTab('players')}>
                🏀 Players
              </button>
              <button style={subTabStyle(photoSubTab === 'staff')} onClick={() => setPhotoSubTab('staff')}>
                👔 Staff
              </button>
            </div>

            {/* PLAYERS */}
            {photoSubTab === 'players' && (
              <div style={{ display: 'flex', gap: 20 }}>
                {/* Sidebar selector */}
                <div style={{
                  minWidth: 200, maxWidth: 220,
                  background: '#111827', borderRadius: 8,
                  padding: '12px 8px', height: 'fit-content',
                  position: 'sticky', top: 20, maxHeight: '90vh', overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                    NBA Teams
                  </div>
                  {nbaTeams.map((t) => (
                    <button
                      key={t.id}
                      style={{ ...selectorBtnStyle(selectedPlayerTeam === t.id), width: '100%', textAlign: 'left', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}
                      onClick={() => setSelectedPlayerTeam(t.id)}
                    >
                      <span>{t.abbreviation}</span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{playerCountForTeam(t.id)}</span>
                    </button>
                  ))}

                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                    G-League
                  </div>
                  {gleagueTeams.map((t) => (
                    <button
                      key={t.id}
                      style={{ ...selectorBtnStyle(selectedPlayerTeam === `gl_${t.id}`), width: '100%', textAlign: 'left', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}
                      onClick={() => setSelectedPlayerTeam(`gl_${t.id}`)}
                    >
                      <span style={{ fontSize: 10 }}>{t.abbreviation}</span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{playerCountForTeam(`gl_${t.id}`)}</span>
                    </button>
                  ))}

                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                    Other
                  </div>
                  <button
                    style={{ ...selectorBtnStyle(selectedPlayerTeam === '__fa__'), width: '100%', textAlign: 'left', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => setSelectedPlayerTeam('__fa__')}
                  >
                    <span>Free Agents</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{playerCountForTeam('__fa__')}</span>
                  </button>
                  <button
                    style={{ ...selectorBtnStyle(selectedPlayerTeam === '__draft__'), width: '100%', textAlign: 'left', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => setSelectedPlayerTeam('__draft__')}
                  >
                    <span>Draft Pool</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>0</span>
                  </button>
                </div>

                {/* Player grid */}
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 15 }}>
                      {selectedPlayerTeam === '__fa__' ? 'Free Agents'
                        : selectedPlayerTeam === '__draft__' ? 'Draft Pool'
                        : selectedPlayerTeam.startsWith('gl_')
                        ? gleagueTeamMap[selectedPlayerTeam.replace('gl_', '')]?.full_name || 'G-League Team'
                        : nbaTeamMap[selectedPlayerTeam]?.full_name || 'Select a team'}
                    </h3>
                    <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                      {filteredPlayers.length} players
                    </span>
                  </div>

                  {filteredPlayers.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13, padding: 24, textAlign: 'center', background: '#111827', borderRadius: 8 }}>
                      {selectedPlayerTeam === '__draft__' ? 'No draft pool players yet.' : 'No players found for this selection.'}
                    </div>
                  ) : (
                    <Grid>
                      {filteredPlayers.map((p) => (
                        <PhotoCard key={p.id} id={p.id} name={p.name} currentPhoto={p.photo_url} onSave={savePhoto} />
                      ))}
                    </Grid>
                  )}
                </div>
              </div>
            )}

            {/* STAFF */}
            {photoSubTab === 'staff' && (
              <div style={{ display: 'flex', gap: 20 }}>
                {/* Sidebar selector */}
                <div style={{
                  minWidth: 200, maxWidth: 220,
                  background: '#111827', borderRadius: 8,
                  padding: '12px 8px', height: 'fit-content',
                  position: 'sticky', top: 20, maxHeight: '90vh', overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                    NBA Teams
                  </div>
                  {nbaTeams.map((t) => (
                    <button
                      key={t.id}
                      style={{ ...selectorBtnStyle(selectedStaffTeam === t.id), width: '100%', textAlign: 'left', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}
                      onClick={() => setSelectedStaffTeam(t.id)}
                    >
                      <span>{t.abbreviation}</span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{staffCountForTeam(t.id)}</span>
                    </button>
                  ))}

                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                    G-League
                  </div>
                  {gleagueTeams.map((t) => (
                    <button
                      key={t.id}
                      style={{ ...selectorBtnStyle(selectedStaffTeam === `gl_${t.id}`), width: '100%', textAlign: 'left', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}
                      onClick={() => setSelectedStaffTeam(`gl_${t.id}`)}
                    >
                      <span style={{ fontSize: 10 }}>{t.abbreviation}</span>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{staffCountForTeam(`gl_${t.id}`)}</span>
                    </button>
                  ))}

                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4 }}>
                    Other
                  </div>
                  <button
                    style={{ ...selectorBtnStyle(selectedStaffTeam === '__staff_fa__'), width: '100%', textAlign: 'left', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => setSelectedStaffTeam('__staff_fa__')}
                  >
                    <span>Staff FA</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{staffCountForTeam('__staff_fa__')}</span>
                  </button>
                </div>

                {/* Staff grid */}
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: 15 }}>
                      {selectedStaffTeam === '__staff_fa__' ? 'Staff Free Agents'
                        : selectedStaffTeam.startsWith('gl_')
                        ? gleagueTeamMap[selectedStaffTeam.replace('gl_', '')]?.full_name || 'G-League Team'
                        : nbaTeamMap[selectedStaffTeam]?.full_name || 'Select a team'}
                    </h3>
                    <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                      {filteredStaff.length} members
                    </span>
                  </div>

                  {filteredStaff.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13, padding: 24, textAlign: 'center', background: '#111827', borderRadius: 8 }}>
                      No staff found for this selection.
                    </div>
                  ) : (
                    <Grid>
                      {filteredStaff.map((s) => (
                        <PhotoCard
                          key={s.id}
                          id={s.id}
                          name={s.name}
                          currentPhoto={s.photo_url}
                          label={s.role}
                          onSave={saveStaffPhoto}
                        />
                      ))}
                    </Grid>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
