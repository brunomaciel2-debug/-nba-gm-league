# NBA GM League — Setup Guide

## Step 1 — Create accounts (free)
1. **Supabase**: https://supabase.com → "Start your project" → sign up with GitHub or email
2. **Vercel**: https://vercel.com → sign up with GitHub (recommended)
3. **GitHub**: https://github.com → needed to connect Vercel (free)

## Step 2 — Create Supabase project
1. New project → name: `nba-gm-league` → choose region: `West EU (Ireland)`
2. Set a database password → save it somewhere safe
3. Go to Settings → API → copy:
   - `Project URL` → save as NEXT_PUBLIC_SUPABASE_URL
   - `anon public key` → save as NEXT_PUBLIC_SUPABASE_ANON_KEY
   - `service_role key` → save as SUPABASE_SERVICE_ROLE_KEY (keep secret)

## Step 3 — Run SQL schema (in Supabase SQL Editor)
Copy the contents of `supabase/schema.sql` and run it in Supabase → SQL Editor

## Step 4 — Run seed data
Copy `supabase/seed.sql` and run it — loads all 30 teams + 422 players

## Step 5 — Deploy to Vercel
1. Push this folder to a GitHub repo
2. Go to Vercel → New Project → import that repo
3. Add environment variables (Settings → Environment Variables):
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - COMMISSIONER_SECRET=choose_a_secret_password
4. Deploy → your site will be at https://your-project.vercel.app

## Step 6 — Create commissioner account
1. Go to your site → /admin/setup (one-time setup page)
2. Enter COMMISSIONER_SECRET → creates your admin account

## Step 7 — Invite GMs
1. Admin panel → Teams → assign GMs
2. Send invite links to each GM
