'use client'
import { useTranslation } from '@/components/I18nProvider'

function RuleCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div style={{ display:'flex', gap:14, padding:'16px 18px', background:'#faf8f5', border:'1px solid #d4cdc5', borderRadius:12 }}>
      <div style={{ fontSize:24, flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:'#1a1512', marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:13, color:'#5c554e', lineHeight:1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

export default function TechnicalFoulsRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🟨', title:'Como Acontece uma Falta Técnica', desc:'Em cada período, cada jogador em campo tem uma pequena hipótese de sofrer uma falta técnica — jogadores com o atributo Trash Talk mais alto arriscam mais. É aleatório, mas mais provável nos jogadores mais "quentes".' },
    { icon:'📋', title:'Conta a Dobrar', desc:'Uma falta técnica soma-se ao total de faltas pessoais (PF) do jogador E ao total de faltas técnicas (TECH), que aparecem como colunas separadas na box score. A equipa adversária recebe sempre 1 lance livre.' },
    { icon:'⛔', title:'Expulsão Imediata', desc:'Se um jogador sofrer 2 faltas técnicas no mesmo jogo, é expulso e não pode voltar a jogar nesse jogo — aparece com a etiqueta "EJECTED" na box score.' },
    { icon:'🚫', title:'Suspensão — Época Regular', desc:'Ao chegar às 16 faltas técnicas na época regular, o jogador é suspenso por 1 jogo. Depois disso, cada 2 faltas técnicas adicionais (18, 20, 22...) somam mais 1 jogo de suspensão.' },
    { icon:'🏆', title:'Suspensão — Playoffs', desc:'Nos playoffs, o contador reinicia e o limite é mais apertado: 7 faltas técnicas para a primeira suspensão, com a mesma lógica de mais 1 jogo a cada 2 adicionais.' },
    { icon:'📬', title:'És Sempre Avisado', desc:'Sempre que um jogador teu sofre uma falta técnica, recebes uma notificação a dizer que técnica é essa da época e quantas faltam para a próxima suspensão. Se a suspensão for mesmo aplicada, a notificação diz isso diretamente.' },
    { icon:'🔒', title:'Enquanto Suspenso', desc:'Um jogador suspenso fica automaticamente indisponível para jogar — volta a estar disponível assim que cumprir os jogos de suspensão que a equipa tiver nessa semana.' },
    { icon:'👨‍⚖️', title:'O Árbitro Também Conta', desc:'Cada jogo real é atribuído a um árbitro de uma pool de 40 árbitros reais da NBA — com antecedência, já visível no calendário. A impaciência dele com reclamações mexe mesmo na frequência de faltas técnicas, sobretudo em jogos de rivalidade ou decisivos. Vê o perfil dele para veres as características todas.' },
  ] : [
    { icon:'🟨', title:'How a Technical Foul Happens', desc:'Every quarter, each player on the court has a small chance of picking up a technical foul — players with a higher Trash Talk attribute risk more. It\'s random, but more likely for hot-headed players.' },
    { icon:'📋', title:'Counts Twice', desc:'A technical foul adds to the player\'s personal foul total (PF) AND to the technical foul total (TECH), shown as separate columns in the box score. The opposing team always gets 1 free throw.' },
    { icon:'⛔', title:'Immediate Ejection', desc:'If a player picks up 2 technical fouls in the same game, he\'s ejected and can\'t return for the rest of that game — shown with an "EJECTED" tag in the box score.' },
    { icon:'🚫', title:'Suspension — Regular Season', desc:'Upon reaching 16 technical fouls in the regular season, the player is suspended for 1 game. After that, every 2 additional technicals (18, 20, 22...) adds another 1-game suspension.' },
    { icon:'🏆', title:'Suspension — Playoffs', desc:'In the playoffs, the counter resets and the threshold is stricter: 7 technical fouls for the first suspension, with the same +1-game-per-2-more logic.' },
    { icon:'📬', title:'You\'re Always Notified', desc:'Whenever one of your players picks up a technical, you get a notification saying which one it is for the season and how many more until the next suspension. If a suspension actually triggers, the notification says so directly.' },
    { icon:'🔒', title:'While Suspended', desc:'A suspended player automatically becomes unavailable to play — he returns once his team has played through the number of suspended games he owes.' },
    { icon:'👨‍⚖️', title:'The Referee Matters Too', desc:"Every real game is assigned a referee from a pool of 40 real NBA officials — ahead of time, already visible on the calendar. His impatience with players who complain genuinely changes how often technicals actually get called, especially in rivalry or decisive games. Check his profile to see all his traits." },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>🟨 {isPT?'Regras de Faltas Técnicas':'Technical Foul Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:6 }}>
        {isPT?'Como as faltas técnicas acontecem, quando levam a expulsão, e quando se acumulam em suspensões.':'How technical fouls happen, when they lead to ejection, and when they add up to suspensions.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#fee2e2', border:'1px solid #fca5a5' }}>
        <div style={{ fontSize:12, color:'#dc2626', lineHeight:1.7 }}>
          {isPT
            ? '2 técnicas no mesmo jogo = expulsão imediata · Época regular: 16 técnicas = 1 jogo, +1 jogo a cada 2 adicionais · Playoffs: 7 técnicas, mesma lógica · Notificação a cada técnica.'
            : '2 technicals in the same game = immediate ejection · Regular season: 16 technicals = 1 game, +1 game every 2 more · Playoffs: 7 technicals, same logic · Notified on every technical.'}
        </div>
      </div>
    </div>
  )
}
