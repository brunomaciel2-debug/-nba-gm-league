import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const team = searchParams.get('team');

  if (type === 'nba_teams') {
    const { data } = await supabase
      .from('teams')
      .select('id, name, logo_url')
      .order('name');
    return NextResponse.json({ teams: data || [] });
  }

  if (type === 'gleague_teams') {
    const { data } = await supabase
      .from('gleague_teams')
      .select('id, name, logo_url')
      .order('name');
    return NextResponse.json({ teams: data || [] });
  }

  if (type === 'world_teams') {
    const { data } = await supabase
      .from('world_teams')
      .select('id, name, logo_url')
      .order('name');
    return NextResponse.json({ teams: data || [] });
  }

  if (type === 'players') {
    const { data } = await supabase
      .from('players')
      .select('id, name, photo_url, team_id, gleague_team_id')
      .is('world_team_id', null)
      .order('name');
    return NextResponse.json({ players: data || [] });
  }

  if (type === 'staff') {
    let query = supabase
      .from('coaches')
      .select('id, name, role, photo_url, team_id, gleague_team_id')
      .order('name');

    if (team === 'GLEAGUE') {
      query = query.not('gleague_team_id', 'is', null);
    } else if (team === 'FA') {
      query = query.is('team_id', null).is('gleague_team_id', null);
    } else if (team) {
      query = query.eq('team_id', team);
    }

    const { data, error } = await query;
    return NextResponse.json({ staff: data || [], error: error?.message });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { type, id, url, table, field, value } = body;

  // Novo formato
  if (type === 'player_photo') {
    await supabase.from('players').update({ photo_url: url }).eq('id', id);
    revalidatePath('/');
    return NextResponse.json({ success: true });
  }

  if (type === 'staff_photo') {
    await supabase.from('coaches').update({ photo_url: url }).eq('id', id);
    revalidatePath('/');
    return NextResponse.json({ success: true });
  }

  // Formato antigo (logos)
  if (table && field && value !== undefined) {
    const { error } = await supabase.from(table).update({ [field]: value }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath('/');
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
