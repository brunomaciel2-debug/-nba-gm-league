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

  if (type === 'nba_teams') {
    const { data } = await supabase
      .from('teams')
      .select('id, abbreviation, full_name, logo_url')
      .order('full_name');
    return NextResponse.json({ teams: data || [] });
  }

  if (type === 'gleague_teams') {
    const { data } = await supabase
      .from('gleague_teams')
      .select('id, abbreviation, full_name, logo_url')
      .order('full_name');
    return NextResponse.json({ teams: data || [] });
  }

  if (type === 'world_teams') {
    const { data } = await supabase
      .from('world_teams')
      .select('id, abbreviation, full_name, logo_url')
      .order('full_name');
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
    const { data } = await supabase
      .from('coaches')
      .select('id, name, role, photo_url, team_id, gleague_team_id')
      .order('name');
    return NextResponse.json({ staff: data || [] });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { type, id, url } = body;

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

  if (type === 'nba_logo') {
    await supabase.from('teams').update({ logo_url: url }).eq('id', id);
    revalidatePath('/teams');
    return NextResponse.json({ success: true });
  }

  if (type === 'gleague_logo') {
    await supabase.from('gleague_teams').update({ logo_url: url }).eq('id', id);
    revalidatePath('/gleague');
    return NextResponse.json({ success: true });
  }

  if (type === 'world_logo') {
    await supabase.from('world_teams').update({ logo_url: url }).eq('id', id);
    revalidatePath('/teams');
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
