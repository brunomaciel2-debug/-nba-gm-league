'use client';

import { useState, useEffect } from 'react';

// ── Tipos ───────────────────────────────────────────────────
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
  role?: string;
  photo_url?: string;
  team_id?: string;
  gleague_team_id?: string;
};

type Team = {
  id: string;
  abbreviation: string;
  full_name: string;
  logo_url?: string;
};

// ── Card de foto ────────────────────────────────────────────
function PhotoCard({
  id, name, photo, label, onSave,
}: {
  id: string; name: string; photo?: string; label?: string;
  onSave: (id: string, url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(photo || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

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
      background: '#1a1a2e', border: '1px solid #2a2a4a',
      borderRadius: 8, padding: 12, display: 'flex',
      flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      {photo ? (
        <img src={photo} alt={name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }} />
      ) : (
        <div style={{
          width: 60, height: 60, borderRadius: '50%', background: '#2a2a4a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: '#94a3b8',
        }}>{initials}</div>
      )}
      <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{name}</div>
      {label && <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>{label}</div>}
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL da foto"
        style={{
          width: '100%', padding: '4px 6px', fontSize: 10,
          background: '#0f0f1a', border: '1px solid #3b82f6',
          borderRadius: 4, color: '#e2e8f0', boxSizing: 'border-box' as const,
        }}
      />
      <button
        onClick={handle}
        disabled={saving}
        style={{
          width: '100%', padding: '4px 0', fontSize: 11,
          background: saved ? '#059669' : '#3b82f6',
          color: '#fff', border: 'none', borderRadius: 4,
          cursor: 'pointer', fontWeight: 600,
        }}
      >
        {saving ? 'A guardar...' : saved ? '✓ Guardado' : 'Guardar'}
      </button>
    </div>
  );
}

// ── Card de logo ────────────────────────────────────────────
function LogoCard({
  id, name, logo, type, onSave,
}: {
  id: string; name: string; logo?: string; type: string;
  onSave: (id: string, url: string, type: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(logo || '');
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
      {logo ? (
        <img src={logo} alt={name} style={{ width: 60, height: 60, objectFit: 'contain' }} />
      ) : (
        <div style={{
          width: 60, height: 60, background: '#2a2a4a', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#64748b', textAlign: 'center', padding: 4,
        }}>Sem logo</div>
      )}
      <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{name}</div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL do logo"
        style={{
          width: '100%', padding: '4px 6px', fontSize: 10,
          background: '#0f0f1a', border: '1px solid #3b82f6',
          borderRadius: 4, color: '#e2e8f0', boxSizing: 'border-box' as const,
        }}
      />
      <button
        onClick={handle}
        disabled={saving}
        style={{
          width: '100%', padding: '4px 0', fontSize: 11,
          background: saved ? '#059669' : '#3b82f6',
          color: '#fff', border: 'none', borderRadius: 4,
          cursor: 'pointer', fontWeight: 600,
        }}
      >
        {saving ? 'A guardar...' : saved ? '✓ Guardado' : 'Guardar'}
      </button>
    </div>
  );
}

// ── Sidebar selector ────────────────────────────────────────
function Sidebar({
  nbaTeams, gleagueTeams, selected, onSelect, counts, extraItems,
}: {
  nbaTeams: Team[];
  gleagueTeams: Team[];
  selected: string;
  onSelect: (key: string) => void;
  counts: (key: string) => number;
  extraItems: { key: string; label: string }[];
}) {
  const btn = (key: string, label: string) => {
    const active = selected === key;
    const count = counts(key);
    return (
      <button
        key={key}
        onClick={() => onSelect(key)}
        style={{
          width: '100%', textAlign: 'left', padding: '5px 10px',
          marginBottom: 2, borderRadius: 6, border: '1px solid',
          borderColor: active ? '#3b82f6' : 'transparent',
          background: active ? '#1e3a5f' : 'transparent',
          color: active ? '#93c5fd' : '#94a3b8',
          cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>{label}</span>
        {count > 0 && (
          <span style={{ fontSize: 10, color: '#64748b', background: '#0f0f1a', padding: '1px 5px', borderRadius: 8 }}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{
      width: 200, minWidth: 200, background: '#111827', borderRadius: 10,
      padding: 12, maxHeight: '80vh', overflowY: 'auto', flexShrink: 0,
    }}>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        NBA
      </div>
      {nbaTeams.map((t) => btn(t.id, t.abbreviation + ' — ' + t.full_name.split(' ').slice(-1)[0]))}

      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
        G-League
      </div>
      {gleagueTeams.map((t) => btn('gl_' + t.id, t.full_name))}

      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, margin: '12px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
        Outros
      </div>
      {extraItems.map((item) => btn(item.key, item.label))}
    </div>
  );
}

// ── Página principal ────────────────────────────────────────
export default function MediaManagerPage() {
  const [tab, setTab] = useState<'logos' | 'photos'>('logos');
  const [photoTab, setPhotoTab] = useState<'players' | 'staff'>('players');
  const [playerTeam, setPlayerTeam] = useState('__fa__');
  const [staffTeam, setStaffTeam] = useState('__staff_fa__');

  const [nbaTeams, setNbaTeams] = useState<Team[]>([]);
  const [gleagueTeams, setGleagueTeams] = useState<Team[]>([]);
  const [worldTeams, setWorldTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [t, g, w, p, s] = await Promise.all([
          fetch('/api/admin/media?type=nba_teams').then((r) => r.json()),
          fetch('/api/admin/media?type=gleague_teams').then((r) => r.json()),
          fetch('/api/admin/media?type=world_teams').then((r) => r.json()),
          fetch('/api/admin/media?type=players').then((r) => r.json()),
          fetch('/api/admin/media?type=staff').then((r) => r.json()),
        ]);
        setNbaTeams(t.teams || []);
        setGleagueTeams(g.teams || []);
        setWorldTeams(w.teams || []);
        setPlayers(p.players || []);
        setStaff(s.staff || []);
        if (s.error) setError('Staff error: ' + s.error);
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Save handlers
  const savePlayerPhoto = async (id: string, url: string) => {
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'player_photo', id, url }),
    });
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, photo_url: url } : p));
  };

  const saveStaffPhoto = async (id: string, url: string) => {
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'staff_photo', id, url }),
    });
    setStaff((prev) => prev.map((s) => s.id === id ? { ...s, photo_url: url } : s));
  };

  const saveLogo = async (id: string, url: string, type: string) => {
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type + '_logo', id, url }),
    });
    if (type === 'nba') setNbaTeams((prev) => prev.map((t) => t.id === id ? { ...t, logo_url: url } : t));
    if (type === 'gleague') setGleagueTeams((prev) => prev.map((t) => t.id === id ? { ...t, logo_url: url } : t));
    if (type === 'world') setWorldTeams((prev) => prev.map((t) => t.id === id ? { ...t, logo_url: url } : t));
  };

  // Filter helpers
  const filteredPlayers = (() => {
    if (playerTeam === '__fa__') return players.filter((p) => !p.team_id && !p.gleague_team_id);
    if (playerTeam === '__draft__') return [];
    if (playerTeam.startsWith('gl_')) {
      const glId = playerTeam.replace('gl_', '');
      return players.filter((p) => p.gleague_team_id === glId);
    }
    return players.filter((p) => p.team_id === playerTeam);
  })();

  const filteredStaff = (() => {
    if (staffTeam === '__staff_fa__') return staff.filter((s) => !s.team_id && !s.gleague_team_id);
    if (staffTeam.startsWith('gl_')) {
      const glId = staffTeam.replace('gl_', '');
      return staff.filter((s) => s.gleague_team_id === glId);
    }
    return staff.filter((s) => s.team_id === staffTeam);
  })();

  const playerCount = (key: string) => {
    if (key === '__fa__') return players.filter((p) => !p.team_id && !p.gleague_team_id).length;
    if (key === '__draft__') return 0;
    if (key.startsWith('gl_')) return players.filter((p) => p.gleague_team_id === key.replace('gl_', '')).length;
    return players.filter((p) => p.team_id === key).length;
  };

  const staffCount = (key: string) => {
    if (key === '__staff_fa__') return staff.filter((s) => !s.team_id && !s.gleague_team_id).length;
    if (key.startsWith('gl_')) return staff.filter((s) => s.gleague_team_id === key.replace('gl_', '')).length;
    return staff.filter((s) => s.team_id === key).length;
  };

  const nbaMap: Record<string, Team> = Object.fromEntries(nbaTeams.map((t) => [t.id, t]));
  const glMap: Record<string, Team> = Object.fromEntries(gleagueTeams.map((t) => [t.id, t]));

  const currentPlayerLabel = playerTeam === '__fa__' ? 'Free Agents'
    : playerTeam === '__draft__' ? 'Draft Pool'
    : playerTeam.startsWith('gl_') ? glMap[playerTeam.replace('gl_', '')]?.full_name || ''
    : nbaMap[playerTeam]?.full_name || '';

  const currentStaffLabel = staffTeam === '__staff_fa__' ? 'Staff Free Agents'
    : staffTeam.startsWith('gl_') ? glMap[staffTeam.replace('gl_', '')]?.full_name || ''
    : nbaMap[staffTeam]?.full_name || '';

  const WORLD_REGIONS = [
    { region: 'Europa', abbrs: ['EFS','ASM','CZV','OAM','FCB','FCB2','FNR','HAP','BAS','ASV','MAC','OLY','PAN','PAR','PAT','RMA','VAL','VIB','ZAL'] },
    { region: 'Ásia', abbrs: ['DUB','LFP'] },
    { region: 'Oceânia', abbrs: ['MEL','SYD'] },
    { region: 'América do Sul', abbrs: ['FLA'] },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 16 }}>
        A carregar...
      </div>
    );
  }

  const tabStyle = (active: boolean) => ({
    padding: '8px 22px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 14,
    background: active ? '#3b82f6' : '#1a1a2e',
    color: active ? '#fff' : '#94a3b8',
  });

  const subTabStyle = (active: boolean) => ({
    padding: '6px 18px', borderRadius: 6, border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
    background: active ? '#1e3a5f' : '#111827',
    color: active ? '#93c5fd' : '#64748b',
  });

  const grid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 12,
  };

  const sectionTitle = (t: string, n?: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 10px', borderBottom: '1px solid #2a2a4a', paddingBottom: 8 }}>
      <span style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>{t}</span>
      {n !== undefined && <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{n}</span>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>📸 Media Manager</h1>
        <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: 13 }}>Logos, fotos de jogadores e staff</p>

        {error && (
          <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Tabs principais */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button style={tabStyle(tab === 'logos')} onClick={() => setTab('logos')}>🏀 Logos</button>
          <button style={tabStyle(tab === 'photos')} onClick={() => setTab('photos')}>👤 Fotos</button>
        </div>

        {/* ── LOGOS ── */}
        {tab === 'logos' && (
          <div>
            {sectionTitle('Equipas NBA', nbaTeams.filter(t => !['ALL','RVS','ROO','SOP'].includes(t.abbreviation)).length)}
            <div style={grid}>
              {nbaTeams.filter(t => !['ALL','RVS','ROO','SOP'].includes(t.abbreviation)).map((t) => (
                <LogoCard key={t.id} id={t.id} name={t.full_name} logo={t.logo_url} type="nba" onSave={saveLogo} />
              ))}
            </div>

            {sectionTitle('G-League', gleagueTeams.length)}
            <div style={grid}>
              {gleagueTeams.map((t) => (
                <LogoCard key={t.id} id={t.id} name={t.full_name} logo={t.logo_url} type="gleague" onSave={saveLogo} />
              ))}
            </div>

            {sectionTitle('Rest of the World')}
            {WORLD_REGIONS.map((r) => {
              const rTeams = r.abbrs.map((a) => worldTeams.find((w) => w.abbreviation === a)).filter(Boolean) as Team[];
              if (rTeams.length === 0) return null;
              return (
                <div key={r.region}>
                  <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 8px' }}>{r.region}</div>
                  <div style={grid}>
                    {rTeams.map((t) => (
                      <LogoCard key={t.id} id={t.id} name={t.full_name} logo={t.logo_url} type="world" onSave={saveLogo} />
                    ))}
                  </div>
                </div>
              );
            })}

            {sectionTitle('Equipas Especiais')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 150px)', gap: 12 }}>
              {['ALL','RVS','ROO','SOP'].map((abbr) => {
                const t = nbaTeams.find((nt) => nt.abbreviation === abbr);
                const labels: Record<string, string> = { ALL: 'All-Stars East', RVS: 'All-Stars West', ROO: 'Rookie Team', SOP: 'Sophomore Team' };
                if (!t) return null;
                return <LogoCard key={abbr} id={t.id} name={labels[abbr]} logo={t.logo_url} type="nba" onSave={saveLogo} />;
              })}
            </div>
          </div>
        )}

        {/* ── FOTOS ── */}
        {tab === 'photos' && (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button style={subTabStyle(photoTab === 'players')} onClick={() => setPhotoTab('players')}>🏀 Jogadores</button>
              <button style={subTabStyle(photoTab === 'staff')} onClick={() => setPhotoTab('staff')}>👔 Staff</button>
            </div>

            {/* JOGADORES */}
            {photoTab === 'players' && (
              <div style={{ display: 'flex', gap: 20 }}>
                <Sidebar
                  nbaTeams={nbaTeams.filter(t => !['ALL','RVS','ROO','SOP'].includes(t.abbreviation))}
                  gleagueTeams={gleagueTeams}
                  selected={playerTeam}
                  onSelect={setPlayerTeam}
                  counts={playerCount}
                  extraItems={[
                    { key: '__fa__', label: 'Free Agents' },
                    { key: '__draft__', label: 'Draft Pool (0)' },
                  ]}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>{currentPlayerLabel}</h3>
                    <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                      {filteredPlayers.length}
                    </span>
                  </div>
                  {filteredPlayers.length === 0 ? (
                    <div style={{ background: '#111827', borderRadius: 8, padding: 32, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                      {playerTeam === '__draft__' ? 'Ainda não há jogadores no Draft Pool.' : 'Nenhum jogador encontrado.'}
                    </div>
                  ) : (
                    <div style={grid}>
                      {filteredPlayers.map((p) => (
                        <PhotoCard key={p.id} id={p.id} name={p.name} photo={p.photo_url} onSave={savePlayerPhoto} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STAFF */}
            {photoTab === 'staff' && (
              <div style={{ display: 'flex', gap: 20 }}>
                <Sidebar
                  nbaTeams={nbaTeams.filter(t => !['ALL','RVS','ROO','SOP'].includes(t.abbreviation))}
                  gleagueTeams={gleagueTeams}
                  selected={staffTeam}
                  onSelect={setStaffTeam}
                  counts={staffCount}
                  extraItems={[
                    { key: '__staff_fa__', label: 'Staff FA' },
                  ]}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>{currentStaffLabel}</h3>
                    <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                      {filteredStaff.length}
                    </span>
                  </div>
                  {staff.length === 0 ? (
                    <div style={{ background: '#111827', borderRadius: 8, padding: 32, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                      <p style={{ margin: '0 0 8px' }}>⚠️ Staff não encontrado.</p>
                      <p style={{ margin: 0, fontSize: 12 }}>Verifica se a API está a retornar dados em /api/admin/media?type=staff</p>
                    </div>
                  ) : filteredStaff.length === 0 ? (
                    <div style={{ background: '#111827', borderRadius: 8, padding: 32, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                      Nenhum membro de staff nesta equipa.
                    </div>
                  ) : (
                    <div style={grid}>
                      {filteredStaff.map((s) => (
                        <PhotoCard key={s.id} id={s.id} name={s.name} photo={s.photo_url} label={s.role} onSave={saveStaffPhoto} />
                      ))}
                    </div>
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
