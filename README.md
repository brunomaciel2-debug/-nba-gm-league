# NBA GM League — 2025-26

A full-stack NBA General Manager simulation league. 30 teams, 422 players, automatic simulations every Monday and Thursday.

## Quick Deploy (30 minutes)

### 1. Create accounts (free)
- **GitHub**: https://github.com/signup
- **Supabase**: https://supabase.com → sign up → New project → `nba-gm-league` → region `West EU (Ireland)`
- **Vercel**: https://vercel.com → sign up with GitHub

### 2. Set up Supabase database
1. In Supabase → SQL Editor → paste `supabase/schema.sql` → Run
2. In Supabase → SQL Editor → paste `supabase/seed.sql` → Run (loads all 422 players)
3. Go to Settings → API → copy your 3 keys

### 3. Push to GitHub
```bash
cd nba-gm-league
git init
git add .
git commit -m "Initial commit"
gh repo create nba-gm-league --public --push
# or manually create a repo at github.com and follow the instructions
```

### 4. Deploy to Vercel
1. Go to vercel.com → New Project → Import from GitHub → select `nba-gm-league`
2. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key (keep secret)
   - `COMMISSIONER_SECRET` = choose a strong password
   - `CRON_SECRET` = choose another strong password
3. Deploy → your site will be at `https://nba-gm-league.vercel.app`

### 5. Activate the season
In Supabase → SQL Editor:
```sql
UPDATE season_config SET status = 'active' WHERE id = 1;
```

### 6. Commissioner: write first article
- Go to your site → /admin → enter your COMMISSIONER_SECRET → Write Article

### 7. Invite GMs
- Share `/gm/orders/[TEAM_ID]` links with each GM (e.g. `/gm/orders/ORL` for Orlando)
- GMs submit orders before Sunday 23:59 Lisbon time
- Simulation runs automatically Monday and Thursday at midnight

## Page structure
| Page | URL | Update |
|------|-----|--------|
| Home/News | / | Commissioner writes manually |
| Standings | /standings | Auto after each simulation |
| Schedule | /schedule | Auto after each simulation |
| Teams | /teams | Auto |
| Team detail | /team/[id] | Auto + GM panel |
| Game/Box Score | /game/[id] | Auto after game |
| League Leaders | /league-leaders | Auto |
| Transactions | /transactions | Real-time |
| Free Agents | /free-agents | Auto |
| Trade Center | /trade-center | GM initiated |
| GM Orders | /gm/orders/[id] | GM edits weekly |
| Admin | /admin | Commissioner only |

## Cron schedule
- **Monday 00:00 UTC** = Monday midnight Portugal time (winter)
- **Thursday 00:00 UTC** = Thursday midnight Portugal time (winter)
- In summer (UTC+1), runs at 01:00 local. Adjust `vercel.json` schedule to `"0 23 * * 0,3"` for summer.

## Tech stack
- **Next.js 14** + TypeScript — frontend
- **Supabase** — PostgreSQL database + authentication + real-time
- **Vercel** — hosting + cron jobs
- **Tailwind CSS** — styling
