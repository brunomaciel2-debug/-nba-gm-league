# NBA GM League — DATABASE MASTER

## Stack
- **Frontend:** Next.js 14, Tailwind, Vercel
- **Backend:** Supabase (PostgreSQL)
- **Repo:** https://github.com/brunomaciel2-debug/-nba-gm-league
- **Site:** https://nba-gm-league-mu.vercel.app
- **Supabase project:** kpuvtridtsiyrlmpdkdf

---

## Tabelas principais

| Tabela | Uso |
|--------|-----|
| `players` | Todos os jogadores — atributos, contratos (salary_y1-y5), equipa |
| `contracts` | Uma linha por ano por jogador — o site LÊ DAQUI para mostrar contratos |
| `teams` | 30 equipas NBA |
| `team_cap_room` | VIEW — payroll e cap space por equipa (3 anos) |
| `games` | Calendário de jogos |
| `player_stats` | Estatísticas por jogador/temporada |
| `contracts` | salary, type (guaranteed/team_option), season (ex: '2025-26') |

---

## Estrutura crítica

### players
```
id (bigint PK), name, pos, nationality, age, team_id (FK→teams),
salary (=salary_y1), contract_years, salary_y1-y5,
three, layup, dunk, mid, ft, siq, draw_foul, blk, stl, idef, pdef,
def_reb, off_reb, stamina, durability, ball_hdl, pass_vis, pass_iq,
pressure, consistency, crowd_effect, streaky, trash_talk, assist_role,
pot_three...pot_assist_role (mesmo 21 atributos com prefixo pot_),
status ('active'/'inactive'), health, moral,
potential_grade (A/B/C/D/F), dev_rate, nba_experience,
college, on_gleague_assignment, nba_recruitable
```

### contracts
```
id (uuid PK), player_id (bigint→players.id), player_name (text),
season (text, ex: '2025-26'), salary (int),
type ('guaranteed'|'team_option'), notes, created_at
```

---

## Season mapping (salary_y1-y5 → seasons)
| Coluna | Season |
|--------|--------|
| salary_y1 / Current Year | 2025-26 |
| salary_y2 / Year 2 | 2026-27 |
| salary_y3 / Year 3 | 2027-28 |
| salary_y4 / Year 4 | 2028-29 |
| salary_y5 / Year 5 | 2029-30 |

---

## IDs reais Supabase (todos os 370 jogadores com id fixo)

### ATL (14)
Asa Newell=737, Buddy Hield=998, CJ McCollum=907, Corey Kispert=798,
Dyson Daniels=615, Jalen Johnson=607, Jonathan Kuminga=879, Keaton Wallace=629,
Mouhamed Gueye=741, Nickeil Alexander-Walker=738, Onyeka Okongwu=617, Zaccharie Risacher=616

### BKN (14)
Ben Saraf=719, Danny Wolf=720, Day'Ron Sharpe=717, Drake Powell=718,
Jalen Wilson=523, Josh Minott=563, Michael Porter Jr.=646, Nic Claxton=712,
Noah Clowney=714, Nolan Traore=716, Ochai Agbaji=525, Ziaire Williams=670,
Egor Demin=name (inserido sem id fixo)

### BOS (12 — sem Luke Kornet que está em SAS)
Baylor Scheierman=632, Derrick White=610, Hugo Gonzalez=710, Jaylen Brown=960,
Jayson Tatum=585, Jordan Walsh=561, Luka Garza=647, Neemias Queta=562,
Nikola Vucevic=700, Payton Pritchard=521, Sam Hauser=522

### CHA (15)
Brandon Miller=979, Coby White=702, Grant Williams=685, Josh Green=545,
Kon Knueppel=648, LaMelo Ball=683, Liam McNeeley=546, Miles Bridges=698,
Moussa Diabate=699, Pat Connaughton=549, Ryan Kalkbrenner=1007,
Sion James=565, Tidjane Salaun=564

### CHI (14)
Collin Sexton=684, Guerschon Yabusele=730, Isaac Okoro=756, Josh Giddey=701,
Leonard Miller=810, Matas Buzelis=703, Noa Essengue=733, Patrick Williams=731,
Rob Dillingham=824, Tre Jones=743

### CLE (15)
Craig Porter Jr.=768, Dean Wade=772, Donovan Mitchell=811, Evan Mobley=965,
James Harden=945, Jarrett Allen=760, Jaylon Tyson=771, Keon Ellis=874,
Larry Nance Jr.=773, Sam Merrill=767, Thomas Bryant=770, Tyrese Proctor=536

### DAL (14)
AJ Johnson=804, Brandon Williams=774, Caleb Martin=886, Cooper Flagg=980,
Daniel Gafford=883, Dereck Lively II=935, Dwight Powell=1003, Khris Middleton=799,
Klay Thompson=950, Kyrie Irving=947, Marvin Bagley III=800, Max Christie=857,
Naji Marshall=884, PJ Washington=1000

### DEN (14)
Aaron Gordon=999, Bruce Brown=968, Cameron Johnson=809, Christian Braun=967,
DaRon Holmes II=873, Jalen Pickett=984, Jamal Murray=808, Jonas Valanciunas=969,
Julian Strawther=983, Nikola Jokic=953, Peyton Watson=985, Tim Hardaway Jr.=1001,
Zeke Nnaji=966

### DET (15)
Ausar Thompson=532, Cade Cunningham=971, Caris LeVert=776, Chaz Lanier=779,
Isaac Jones=877, Isaiah Stewart=790, Jalen Duren=775, Javonte Green=781,
Kevin Huerter=758, Marcus Sasser=780, Paul Reed Jr.=782, Ron Holland II=778,
Tobias Harris=509

### GSW (14)
Al Horford=1012, Brandin Podziemski=881, De'Anthony Melton=882, Draymond Green=996,
Gary Payton II=1015, Gui Santos=889, Jimmy Butler III=997, Kristaps Porzingis=961,
Moses Moody=880, Quinten Post=887, Stephen Curry=944, Will Richard=888

### HOU (14)
Aaron Holiday=893, Alperen Sengun=1004, Amen Thompson=501, Clint Capela=896,
Dorian Finney-Smith=894, Jabari Smith Jr.=1005, Jae'Sean Tate=895, Jeff Green=1014,
Josh Okogie=892, Kevin Durant=946, Reed Sheppard=483, Steven Adams=891, Tari Eason=890

### IND (14)
Aaron Nesmith=510, Andrew Nembhard=872, Ben Sheppard=541, Ivica Zubac=924,
Jarace Walker=511, Jay Huff=543, Johnny Furphy=551, Kam Jones=219,
Kobe Brown=1010, Obi Toppin=512, Pascal Siakam=791, Tyrese Haliburton=964

### LAC (15)
Bennedict Mathurin=530, Bogdan Bogdanovic=508, Bradley Beal=858, Brook Lopez=553,
Cam Christie=927, Darius Garland=761, Derrick Jones Jr.=505, Isaiah Jackson=542,
John Collins=926, Kawhi Leonard=951, Kris Dunn=925, Nicolas Batum=506,
Yanic Konan Niederhauser=507

### LAL (14)
Adou Thiero=931, Austin Reaves=853, Bronny James=929, Dalton Knecht=534,
Jaxson Hayes=930, LeBron James=943, Luka Doncic=957, Luke Kennard=739,
Marcus Smart=932, Maxi Kleber=928, Rui Hachimura=856

### MEM (14)
Brandon Clarke=903, Cedric Coward=540, GG Jackson II=897, Ja Morant=959,
Jaylen Wells=900, KCP (Caldwell-Pope)=902, Rayan Rupert=848, Santi Aldama=901,
Taylor Hendricks=992, Ty Jerome=905, Walter Clayton Jr.=537, Zach Edey=899

### MIA (14)
Andrew Wiggins=825, Bam Adebayo=554, Davion Mitchell=736, Dru Smith=766,
Jaime Jaquez Jr.=734, Kasparas Jakucionis=514, Kel'el Ware=784, Keshad Johnson=763,
Nikola Jovic=735, Norman Powell=783, Pelle Larsson=765, Simone Fontecchio=764,
Tyler Herro=555

### MIL (14)
AJ Green=706, Andre Jackson Jr.=515, Bobby Portis=704, Gary Harris=705,
Gary Trent Jr.=520, Giannis Antetokounmpo=552, Jericho Sims=517, Kevin Porter Jr.=613,
Kyle Kuzma=518, Myles Turner=519, Ousmane Dieng=832, Ryan Rollins=516, Taurean Prince=707

### MIN (14)
Anthony Edwards=963, Ayo Dosunmu=732, Bones Hyland=819, Donte DiVincenzo=815,
Jaden McDaniels=817, Jaylen Clark=823, Joan Beringer=822, Joe Ingles=1013,
Julian Phillips=757, Julius Randle=986, Mike Conley=816, Naz Reid=818, Rudy Gobert=987

### NOP (15)
Derik Queen=939, Herbert Jones=909, Jeremiah Fears=913, Jordan Hawkins=936,
Jordan Poole=796, Karlo Matkovic=937, Micah Peavy=938, Saddiq Bey=912,
Trey Murphy III=908, Yves Missi=911, Zion Williamson=962

### NYK (15)
Ariel Hukporti=729, Jalen Brunson=721, Jordan Clarkson=727, Jose Alvarado=910,
Josh Hart=723, Karl-Anthony Towns=954, Landry Shamet=728, Mikal Bridges=722,
Miles McBride=725, Mitchell Robinson=724, Mohamed Diawara=745, OG Anunoby=792,
Pacome Dadiet=726, Tyler Kolek=744

### OKC (15)
Aaron Wiggins=834, Ajay Mitchell=836, Alex Caruso=830, Cason Wallace=831,
Chet Holmgren=826, Isaiah Hartenstein=829, Isaiah Joe=833, Jalen Williams=827,
Jared McCain=503, Jaylin Williams=835, Luguentz Dort=828, Shai Gilgeous-Alexander=958

### ORL (14)
Anthony Black=788, Desmond Bane=502, Franz Wagner=785, Goga Bitadze=794,
Jalen Suggs=802, Jase Richardson=793, Jett Howard=821, Jevon Carter=759,
Jonathan Isaac=787, Moritz Wagner=789, Noah Penda=813, Paolo Banchero=973,
Tristan da Silva=820, Wendell Carter Jr.=786

### PHI (14)
Adem Bona=751, Andre Drummond=749, Joel Embiid=952, Johni Broome=752,
Justin Edwards=753, Kelly Oubre Jr.=504, Kyle Lowry=750, Paul George=1009,
Quentin Grimes=754, Trendon Watford=535, Tyrese Maxey=747, VJ Edgecombe=746

### PHX (14)
Collin Gillespie=863, Devin Booker=1043, Dillon Brooks=865, Grayson Allen=860,
Jordan Goodwin=862, Khaman Maluach=539, Mark Williams=1045, Oso Ighodaro=864,
Rasheer Fleming=538, Royce O'Neale=866, Ryan Dunn=861

### POR (15)
Blake Wesley=849, Damian Lillard=948, Deni Avdija=841, Donovan Clingan=842,
Jerami Grant=840, Jrue Holiday=844, Kris Murray=843, Matisse Thybulle=847,
Robert Williams III=850, Scoot Henderson=975, Shaedon Sharpe=839, Toumani Camara=845,
Vit Krejci=740, Yang Hansen=814

### SAC (14)
De'Andre Hunter=762, DeMar DeRozan=867, Devin Carter=870, Domantas Sabonis=933,
Drew Eubanks=875, Keegan Murray=531, Malik Monk=869, Maxime Raynaud=876,
Nique Clifford=871, Zach LaVine=868

### SAS (15)
Bismack Biyombo=918, Carter Bryant=923, De'Aaron Fox=934, Devin Vassell=915,
Dylan Harper=981, Harrison Barnes=917, Jordan McLaughlin=920, Julian Champagnie=916,
Keldon Johnson=921, Luke Kornet=618, Mason Plumlee=566, Stephon Castle=1008,
Victor Wembanyama=974

### TOR (14)
Brandon Ingram=940, Collin Murray-Boyles=544, Garrett Temple=919, Gradey Dick=608,
Immanuel Quickley=854, Jakob Poeltl=524, Jamal Shead=855, Jamison Battle=526,
Jonathan Mogbo=528, RJ Barrett=941, Sandro Mamukelashvili=527, Scottie Barnes=972,
Trayce Jackson-Davis=1006

### UTA (13)
Ace Bailey=982, Brice Sensabaugh=609, Cody Williams=995, Isaiah Collier=991,
Jaren Jackson Jr.=942, John Konchar=904, Jusuf Nurkic=859, Kevin Love=994,
Keyonte George=988, Kyle Filipowski=989, Lauri Markkanen=851, Svi Mykhailiuk=990,
Walker Kessler=852

### WAS (13)
Alex Sarr=533, Anthony Davis=949, Anthony Gill=806, Bilal Coulibaly=795,
Bub Carrington=803, Cam Whitmore=922, D'Angelo Russell=1002, Jaden Hardy=885,
Justin Champagnie=805, Kyshawn George=807, Trae Young=606

---

## Jogadores inseridos sem id fixo (match por nome)
Gabe Vincent, Jock Landale, Amari Williams, Terance Mann, Egor Demin,
Anfernee Simons, Zach Collins, Jalen Smith, Nick Richards, Tre Mann,
Xavier Tillman Sr., Max Strus, Dennis Schroder, Nae'Qwan Tomlin, Spencer Jones,
Duncan Robinson, Daniss Jenkins, Seth Curry, Pat Spencer, Fred VanVleet,
T.J. McConnell, Micah Potter, Jordan Miller, Kobe Sanders, Jarred Vanderbilt,
Deandre Ayton, Jake LaRavia, Cam Spencer, Scotty Pippen Jr., Myron Gardner,
Thanasis Antetokounmpo, Terrence Shannon Jr., Dejounte Murray, Kevon Looney,
DeAndre Jordan, Bryce McGowens, Jeremy Sochan, Kenrich Williams, Nikola Topic,
Thomas Sorber, Dominick Barlow, Jabari Walker, Jalen Green, Amir Coffey,
Haywood Highsmith, Sidy Cissoko, Russell Westbrook, Doug McDermott,
Precious Achiuwa, Killian Hayes, Kelly Olynyk, Lindy Waters III,
Ja'Kobe Walter, Tre Johnson, Will Riley

---

## Ficheiros SQL gerados (outputs)
| Ficheiro | Descrição |
|----------|-----------|
| roster_sync_v3.sql | Reset + assign por nome (falhou parcialmente) |
| roster_sync_v4.sql | Assign por id real — 370 jogadores |
| missing_players_insert.sql | 23 accent fixes + 55 INSERTs novos |
| salary_contract_update.sql | salary/contract_years em players |
| contracts_rebuild.sql | Rebuild completo tabela contracts |
| attributes_update.sql | Atributos para 87 jogadores sem three/layup |

---

## Regras de negócio importantes
1. **Roster change** → actualizar `players.team_id` + `contracts` table
2. **FA** → `team_id=NULL`, `salary=NULL`, `contract_years=NULL`, `salary_y1-y5=NULL`
3. **Contratos** → o site lê SEMPRE de `contracts` (não de `players.salary`)
4. **Cap room** → VIEW `team_cap_room` usa `players.salary_y1-y5`
5. **OVR** → calculado dinamicamente pelo site via `calcOvr()` dos atributos
6. **Salary cap 2025-26** → $140,588,000
