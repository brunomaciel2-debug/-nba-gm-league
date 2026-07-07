// Tactical System Familiarity — tech-tree definitions for the 5 offensive
// systems already modeled in game-simulator.ts (ATK_DEF_MATCHUP/
// SHOT_PROFILE_BY_ATK_STYLE keys: motion/pickroll/transition/iso/post).
//
// Each system is a 15-node pyramid (5 level-1, 4 level-2, 3 level-3,
// 2 level-4, 1 level-5). A node's `progress` (0-100, stored in
// tactical_familiarity) counts as MASTERED at 100 — only mastered nodes
// contribute their gameplay effect, and only while their system is the
// team's currently active atk_style (see tactical-resolver.ts).
//
// Every node maps to one of a small set of aggregate multiplier fields
// (TacticalMods) rather than a bespoke code branch each — this keeps the
// hot possession-simulation loop in game-simulator.ts touching one small
// aggregated object, while every node still contributes its own real,
// distinct, additive nudge (several nodes stacking onto the same field is
// intentional and mirrors real overlapping skill development).

export type OffSystem = 'motion' | 'pickroll' | 'transition' | 'iso' | 'post'
export const OFF_SYSTEMS: OffSystem[] = ['motion', 'pickroll', 'transition', 'iso', 'post']

export type EffectField =
  | 'toMult' | 'astMult' | 'midMult' | 'postMult' | 'threeMult' | 'rimMult'
  | 'offRebMult' | 'defRebMult' | 'foulDrawMult' | 'clutchMult' | 'paceMult'
  | 'vsManMult' | 'vsZoneMult' | 'vsPressMult' | 'vsPackMult'
  | 'bigThreeMult' | 'lobMult'

export interface TechNode {
  id: string
  system: OffSystem
  level: 1 | 2 | 3 | 4 | 5
  nameEn: string; namePt: string
  descEn: string; descPt: string
  effectField: EffectField
  magnitude: number // per-level scale: L1 .015, L2 .02, L3 .025, L4 .03, L5 .05
}

export const LEVEL_SIZES: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }
const MAG_BY_LEVEL: Record<number, number> = { 1: 0.015, 2: 0.02, 3: 0.025, 4: 0.03, 5: 0.05 }

function n(system: OffSystem, level: 1|2|3|4|5, slug: string, nameEn: string, namePt: string, descEn: string, descPt: string, effectField: EffectField): TechNode {
  return { id: `${system}_l${level}_${slug}`, system, level, nameEn, namePt, descEn, descPt, effectField, magnitude: MAG_BY_LEVEL[level] }
}

export const TECH_TREE: TechNode[] = [
  // ── MOTION ──────────────────────────────────────────────
  n('motion',1,'cut','Basic Cutting','Corte Básico','Sharper off-ball cuts create easy baskets near the rim.','Cortes sem bola mais precisos criam cestos fáceis perto do cesto.','rimMult'),
  n('motion',1,'offball_screen','Off-Ball Screening','Bloqueio Indireto','Better screens away from the ball free up catch-and-shoot looks.','Melhores bloqueios longe da bola libertam lançamentos de catch-and-shoot.','threeMult'),
  n('motion',1,'spacing','Floor Spacing','Espaçamento','Disciplined spacing keeps the floor open for more 3-point looks.','Espaçamento disciplinado mantém o campo aberto para mais lançamentos de 3.','threeMult'),
  n('motion',1,'move_pass','Passing on the Move','Passe em Movimento','Cleaner ball movement means fewer live-ball turnovers.','Movimento de bola mais limpo significa menos perdas de bola.','toMult'),
  n('motion',1,'court_reading','Court Reading','Leitura de Jogo','Better shot selection and vision boosts assists.','Melhor seleção de lançamento e visão de jogo aumenta as assistências.','astMult'),
  n('motion',2,'backdoor','Backdoor Cut','Corte de Backdoor','A trained counter to overplaying defenders — bonus vs. Man.','Uma resposta treinada a defesas agressivas — bónus vs. Homem a Homem.','vsManMult'),
  n('motion',2,'handoff','Dribble Handoffs','Handoff','Extra handoff actions boost guard scoring efficiency.','Ações extra de handoff aumentam a eficiência ofensiva dos guardas.','midMult'),
  n('motion',2,'continuity','Continuity Offense','Movimento Contínuo','Keeping the offense alive longer means fewer rushed, late-clock shots.','Manter o ataque vivo mais tempo significa menos lançamentos apressados.','toMult'),
  n('motion',2,'oreb_motion','Offensive Rebounding in Motion','Ressalto em Movimento','Crashing the glass within motion sets boosts offensive rebounding.','Atacar o ressalto dentro do movimento aumenta os ressaltos ofensivos.','offRebMult'),
  n('motion',3,'zone_reading','Reading Zone Defense','Leitura de Zona','Reading zone rotations — a real bonus vs. Zone defense.','Ler as rotações de zona — um bónus real vs. Defesa Zona.','vsZoneMult'),
  n('motion',3,'triangle','Triangle Principles','Princípios do Triângulo','Layered read progressions make the offense less predictable overall.','Progressões de leitura em camadas tornam o ataque menos previsível.','astMult'),
  n('motion',3,'wave_attack','Wave Attacks','Ataque em Ondas','Continuous re-screening pressure pays off in crunch time.','Pressão contínua de re-bloqueio compensa nos momentos decisivos.','clutchMult'),
  n('motion',4,'full_sync','Full Team Synchronization','Sincronia Total','Whole-team ball movement mastery — big assist boost.','Domínio total do movimento de bola em equipa — grande subida nas assistências.','astMult'),
  n('motion',4,'structured_break','Structured Secondary Break','Contra-ataque Estruturado','Quick-hitting offense off defensive rebounds.','Ataque rápido a seguir a ressaltos defensivos.','defRebMult'),
  n('motion',5,'mastery','Motion Offense Mastery','Maestria da Motion Offense','Full system mastery — the maximum overall boost.','Domínio total do sistema — o impulso máximo geral.','astMult'),

  // ── PICK & ROLL ─────────────────────────────────────────
  n('pickroll',1,'onball_screen','On-Ball Screen','Bloqueio Direto','A crisper on-ball screen improves the ball-handler shot quality off the pick.','Um bloqueio direto mais limpo melhora o lançamento do portador da bola.','midMult'),
  n('pickroll',1,'roll','Roll to the Rim','Roll para o Cesto','Better roll-man reads boost finishing near the rim.','Melhores leituras de desfazer aumentam a finalização perto do cesto.','rimMult'),
  n('pickroll',1,'pop','Pick & Pop','Pick & Pop','Screeners popping out — bigger effect on a good-shooting big.','Bloqueadores a abrir para fora — efeito maior num poste com bom lançamento exterior.','bigThreeMult'),
  n('pickroll',1,'hedge_read','Reading the Hedge','Leitura do Hedge','Reading aggressive coverage boosts the pull-up mid-range shot.','Ler coberturas agressivas melhora o lançamento intermédio de pull-up.','midMult'),
  n('pickroll',1,'short_roll_pass','Screener Short-Roll Playmaking','Passe do Bloqueador','The screener reading the short roll adds real playmaking.','O bloqueador a ler o desfazer curto acrescenta passe real.','astMult'),
  n('pickroll',2,'lob','Lob to the Screener','Lob para o Bloqueador','Alley-oop reads — bigger for a high-flying, good-finishing big.','Leituras de alley-oop — maior num poste que finaliza bem no ar.','lobMult'),
  n('pickroll',2,'double_screen','Double Screen PnR','Duplo Bloqueio','Stacked/staggered screens create real extra separation.','Bloqueios em série criam separação extra real.','midMult'),
  n('pickroll',2,'drag','Drag Screen','Drag Screen','Early pick & roll in transition keeps defenses off balance.','Bloqueio direto cedo em transição mantém a defesa desequilibrada.','rimMult'),
  n('pickroll',2,'reject','Screen Rejection','Reject do Bloqueio','A trained screen-fake burst — bonus vs. Man defense.','Uma finta de bloqueio treinada — bónus vs. Homem a Homem.','vsManMult'),
  n('pickroll',3,'switch_read','Reading the Switch','Leitura do Switch','Hunting the mismatch after a switch — bonus vs. Man defense.','Procurar o desajuste depois de um switch — bónus vs. Homem a Homem.','vsManMult'),
  n('pickroll',3,'spread_pnr','Spread PnR','PnR com Espaçador','Shooters spacing the pick & roll create real kick-out 3s.','Lançadores a espaçar o pick & roll criam lançamentos de 3 reais.','threeMult'),
  n('pickroll',3,'beat_blitz','Attacking the Blitz','Ataque ao Blitz','Beating traps on the ball-handler cuts down turnovers.','Vencer duplas marcações ao portador da bola reduz as perdas de bola.','toMult'),
  n('pickroll',4,'elite_duo','Elite PnR Duo','Duo Elite','Signature ball-handler + screener chemistry — big playmaking bump.','Química de assinatura entre portador e bloqueador — grande subida no passe.','astMult'),
  n('pickroll',4,'universal_counter','Universal Counters','Contra-medidas Universais','Trained counters take the sting out of PnR\'s usual Zone weakness.','Contra-medidas treinadas atenuam a fraqueza normal do PnR vs. Zona.','vsZoneMult'),
  n('pickroll',5,'mastery','Pick & Roll Mastery','Maestria do Pick & Roll','Full system mastery — the maximum overall boost.','Domínio total do sistema — o impulso máximo geral.','midMult'),

  // ── TRANSITION ──────────────────────────────────────────
  n('transition',1,'rebound_outlet','Rebound & Outlet','Rebote e Saída Rápida','A faster trigger off defensive boards creates more break chances.','Um gatilho mais rápido a seguir a ressaltos cria mais oportunidades de contra-ataque.','defRebMult'),
  n('transition',1,'wing_lane','Wing Lane Running','Corredor Lateral','Better wing lane running improves fast-break finishing.','Melhor corrida no corredor lateral melhora a finalização em contra-ataque.','rimMult'),
  n('transition',1,'quick_decision','Quick Decision Making','Decisão em Ritmo','Faster, cleaner decisions in the open floor cut down turnovers.','Decisões mais rápidas e limpas em campo aberto reduzem as perdas de bola.','toMult'),
  n('transition',1,'transition_finish','Transition Finishing','Finalização em Contra-ataque','Better touch finishing at speed.','Melhor acabamento em velocidade.','rimMult'),
  n('transition',1,'def_balance','Defensive Transition Balance','Equilíbrio Defensivo','Better floor balance means faster outlets off the very next defensive rebound.','Melhor equilíbrio em campo permite saídas mais rápidas no ressalto seguinte.','defRebMult'),
  n('transition',2,'precision_outlet','Precision Outlet Pass','Outlet Preciso','A cleaner outlet pass means fewer turnovers and faster starts.','Um passe de saída mais limpo significa menos perdas e arranques mais rápidos.','toMult'),
  n('transition',2,'two_on_one','2-on-1 Situations','Ataque de 2 Contra 1','Better reads in numbers-advantage situations.','Melhores leituras em situações de vantagem numérica.','rimMult'),
  n('transition',2,'steal_to_break','Steal-to-Break','Contra-ataque Após Roubo','Turning a live steal into an immediate scoring chance.','Transformar um roubo de bola numa oportunidade de cesto imediata.','rimMult'),
  n('transition',2,'trailer_three','Trailing Shooter','Arremessador Reboque','A trailing shooter behind the break gets a real 3PT bump.','Um lançador atrás do contra-ataque ganha um bónus real de 3 pontos.','threeMult'),
  n('transition',3,'relentless_pace','Relentless Pace','Ritmo Implacável','Sustained tempo across the whole game.','Ritmo sustentado ao longo do jogo todo.','paceMult'),
  n('transition',3,'push_after_make','Push After a Made Basket','Push Após Cesto Sofrido','Quick inbound pushes create some transition chances even after an opponent make.','Saídas rápidas de bola criam algumas oportunidades mesmo depois de cesto sofrido.','rimMult'),
  n('transition',3,'q4_burst','4th Quarter Burst','Explosão de 4º Período','Extra transition urgency late in close games.','Urgência extra em transição no final de jogos equilibrados.','clutchMult'),
  n('transition',4,'fastbreak_machine','Fast Break Machine','Máquina de Contra-ataque','A team-wide pace identity.','Uma identidade de ritmo em toda a equipa.','paceMult'),
  n('transition',4,'beat_press','Press-Breaking','Contra o Press','Trained press-breaking — a real bonus vs. Press defense.','Quebra de pressão treinada — um bónus real vs. Pressão.','vsPressMult'),
  n('transition',5,'mastery','Transition Mastery','Maestria em Transição','Full system mastery — the maximum pace bonus.','Domínio total do sistema — o bónus de ritmo máximo.','paceMult'),

  // ── ISOLATION ───────────────────────────────────────────
  n('iso',1,'basic_1on1','Basic 1-on-1 Creation','Um Contra Um Básico','Sharper one-on-one shot creation.','Criação de lançamento um-contra-um mais afiada.','midMult'),
  n('iso',1,'jab_step','Jab Step','Finta de Arranque','A better jab step creates real separation off the dribble.','Uma finta de arranque melhor cria separação real a partir do drible.','midMult'),
  n('iso',1,'fadeaway','Contested Fadeaway','Fadeaway Contestado','A more reliable contested mid-range touch.','Um toque mais fiável em lançamentos intermédios contestados.','midMult'),
  n('iso',1,'read_double','Reading the Double Team','Leitura da Dupla Marcação','Reading help defense cuts down turnovers when doubled.','Ler a ajuda defensiva reduz as perdas de bola quando há dupla marcação.','toMult'),
  n('iso',1,'baseline_drive','Baseline Drive','Ataque pela Linha de Fundo','A sharper baseline drive.','Um ataque pela linha de fundo mais afiado.','rimMult'),
  n('iso',2,'elite_crossover','Elite Crossover','Crossover de Elite','A real separation move — bonus vs. Man defense.','Um movimento de separação real — bónus vs. Homem a Homem.','vsManMult'),
  n('iso',2,'iso_kickout','Kick-Out from Iso','Passe do Isolamento','Finding the open man when help arrives.','Encontrar o homem livre quando a ajuda chega.','astMult'),
  n('iso',2,'wing_postup','Wing Post-Up Mismatch','Post-up de Perímetro','Exploiting a size mismatch on the wing — a real post-shot bump.','Explorar um desajuste de tamanho na ala — um bónus real de lançamento de poste.','postMult'),
  n('iso',2,'end_clock','End-of-Clock Isolation','Isolamento de Fim de Posse','Better shot quality late in the clock.','Melhor qualidade de lançamento no fim do tempo de posse.','clutchMult'),
  n('iso',3,'attack_switch','Attacking Switches','Ataque ao Switch','Hunting the mismatch after a defensive switch.','Procurar o desajuste depois de um switch defensivo.','vsManMult'),
  n('iso',3,'closer_instinct','Closer Instinct','Instinto de Fechador','A real clutch-time efficiency bump for the go-to scorer.','Um bónus real de eficiência nos momentos decisivos para o marcador principal.','clutchMult'),
  n('iso',3,'full_spacing','Isolation with Full Spacing','Isolamento com Espaço Total','4-out spacing reduces help defense effectiveness.','Espaçamento com 4 jogadores no perímetro reduz a eficácia da ajuda defensiva.','threeMult'),
  n('iso',4,'complete_package','Complete Scoring Package','Repertório Completo','Shot diversity makes this player harder to game-plan against.','A diversidade de lançamentos torna este jogador mais difícil de planear contra.','midMult'),
  n('iso',4,'anti_pack','Anti-Pack Line','Contra a Defesa em Manada','Trained counters take the sting out of Iso\'s usual Pack weakness.','Contra-medidas treinadas atenuam a fraqueza normal do Isolamento vs. Manada.','vsPackMult'),
  n('iso',5,'mastery','Isolation Mastery','Maestria do Isolamento','Full system mastery — the maximum overall boost.','Domínio total do sistema — o impulso máximo geral.','clutchMult'),

  // ── POST-UP ─────────────────────────────────────────────
  n('post',1,'basic_positioning','Basic Post Positioning','Postura Básica no Poste','Better post positioning improves post-up shot quality.','Melhor posicionamento no poste melhora a qualidade do lançamento.','postMult'),
  n('post',1,'hook_shot','Hook Shot','Gancho','A more reliable hook shot.','Um gancho mais fiável.','postMult'),
  n('post',1,'oreb_post','Offensive Rebound Dominance','Domínio do Ressalto Ofensivo','Crashing the glass off post-up misses.','Atacar o ressalto a seguir a lançamentos falhados no poste.','offRebMult'),
  n('post',1,'post_pass','Post Playmaking','Passe do Poste','Kick-outs from a doubled post player.','Passes para fora quando o jogador de poste é duplamente marcado.','astMult'),
  n('post',1,'draw_fouls','Drawing Fouls in the Post','Provocar Faltas no Poste','A real bump to the foul-drawing rate on post touches.','Um bónus real na taxa de faltas sofridas em jogadas de poste.','foulDrawMult'),
  n('post',2,'footwork','Advanced Footwork','Jogo de Pés Avançado','Better shot quality against physical post defense.','Melhor qualidade de lançamento contra defesa física no poste.','postMult'),
  n('post',2,'double_post','Two-Man Post Game','Duplo Poste','A bonus when two bigs both get involved on the glass.','Um bónus quando dois postes se envolvem no ressalto.','offRebMult'),
  n('post',2,'high_post','High Post Facilitation','Poste Alto','Elbow passing creates real assists to cutters.','O passe no lance livre cria assistências reais para cortes.','astMult'),
  n('post',2,'beat_double','Beating the Double Team','Contra a Dupla Marcação','Reduces turnovers when the post is doubled.','Reduz as perdas de bola quando o poste sofre dupla marcação.','toMult'),
  n('post',3,'zone_attack','Attacking Zone from the Post','Ataque à Zona pelo Poste','A real bonus vs. Zone defense.','Um bónus real vs. Defesa Zona.','vsZoneMult'),
  n('post',3,'up_and_under','Up-and-Under','Reviravolta','A more reliable contested finish.','Um acabamento contestado mais fiável.','postMult'),
  n('post',3,'physical_dom','Physical Dominance','Domínio Físico','A real bump to foul-drawing against smaller defenders.','Um bónus real nas faltas sofridas contra defensores mais pequenos.','foulDrawMult'),
  n('post',4,'double_threat','Score-or-Pass Threat','Ameaça Dupla','His gravity in the post opens up shooters elsewhere.','A sua gravidade no poste abre lançadores no resto do campo.','threeMult'),
  n('post',4,'anti_blitz','Post Double-Team Counters','Anti-Blitz no Poste','A big reduction to turnover risk against aggressive post doubles.','Uma grande redução do risco de perda de bola contra duplas marcações agressivas.','toMult'),
  n('post',5,'mastery','Post-Up Mastery','Maestria do Poste','Full system mastery — the maximum overall boost.','Domínio total do sistema — o impulso máximo geral.','postMult'),
]

export function nodesForSystem(system: OffSystem): TechNode[] {
  return TECH_TREE.filter(t => t.system === system)
}

// Pyramid unlock rule: the Nth node (1-indexed, in tree-definition order
// within its level) at level L unlocks once (N+1) nodes are mastered at
// level L-1. Level 1 is always unlocked.
export function isNodeUnlocked(node: TechNode, masteredCountByLevel: Record<number, number>): boolean {
  if (node.level === 1) return true
  const nodesAtLevel = nodesForSystem(node.system).filter(x => x.level === node.level)
  const posInLevel = nodesAtLevel.findIndex(x => x.id === node.id) + 1 // 1-indexed
  const masteredBelow = masteredCountByLevel[node.level - 1] || 0
  return masteredBelow >= posInLevel + 1
}

export function masteredCountByLevel(progressByNodeId: Record<string, number>, system: OffSystem): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const node of nodesForSystem(system)) {
    if ((progressByNodeId[node.id] || 0) >= 100) counts[node.level]++
  }
  return counts
}

// Familiarity (the heat-bar value, 0-100): level-weighted average across
// all 15 nodes — mastering higher tiers moves the bar more than low ones.
const TOTAL_WEIGHT = Object.entries(LEVEL_SIZES).reduce((s, [lvl, count]) => s + Number(lvl) * count, 0) // 35

export function computeFamiliarity(progressByNodeId: Record<string, number>, system: OffSystem): number {
  let sum = 0
  for (const node of nodesForSystem(system)) {
    const progress = Math.max(0, Math.min(100, progressByNodeId[node.id] || 0))
    sum += (progress / 100) * node.level
  }
  return Math.max(0, Math.min(100, (sum / TOTAL_WEIGHT) * 100))
}

// General matchup resistance — multiplies straight onto ATK_DEF_MATCHUP in
// game-simulator.ts. A neutral-40 familiarity (a system nobody has touched
// yet) is a slight penalty; full mastery claws back a real chunk of even a
// bad on-paper matchup, capped so no amount of familiarity fully cancels a
// genuine counter.
export function familiarityBoost(familiarity: number): number {
  return Math.max(-0.08, Math.min(0.12, (familiarity - 40) / 60 * 0.12))
}

export interface TacticalMods {
  toMult: number; astMult: number; midMult: number; postMult: number; threeMult: number; rimMult: number
  offRebMult: number; defRebMult: number; foulDrawMult: number; clutchMult: number; paceMult: number
  vsManMult: number; vsZoneMult: number; vsPressMult: number; vsPackMult: number
  bigThreeMult: number; lobMult: number
}

const NEUTRAL_MODS: TacticalMods = {
  toMult: 1, astMult: 1, midMult: 1, postMult: 1, threeMult: 1, rimMult: 1,
  offRebMult: 1, defRebMult: 1, foulDrawMult: 1, clutchMult: 1, paceMult: 1,
  vsManMult: 1, vsZoneMult: 1, vsPressMult: 1, vsPackMult: 1,
  bigThreeMult: 1, lobMult: 1,
}

// Aggregates every MASTERED node's effect for one system into the handful
// of multipliers game-simulator.ts actually reads. toMult is phrased as a
// reduction (mastering a turnover-focused node subtracts from it); every
// other field is phrased as a boost (adds to it). Several nodes stacking
// onto the same field is intentional — real, distinct, additive credit for
// each one, without needing a bespoke code branch per node.
export function computeTacticalMods(progressByNodeId: Record<string, number>, system: OffSystem): TacticalMods {
  const mods = { ...NEUTRAL_MODS }
  for (const node of nodesForSystem(system)) {
    if ((progressByNodeId[node.id] || 0) < 100) continue
    if (node.effectField === 'toMult') mods.toMult -= node.magnitude
    else (mods as any)[node.effectField] += node.magnitude
  }
  return mods
}
