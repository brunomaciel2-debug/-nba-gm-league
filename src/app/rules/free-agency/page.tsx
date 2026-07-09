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

export default function FreeAgencyRulesPage() {
  const { t } = useTranslation()
  const isPT = t('common.save') === 'Guardar'

  const rules = isPT ? [
    { icon:'🗓️', title:'Duas Fases Distintas', desc:'A Free Agency tem uma semana de negociação real (Semana 1, 4-10 Julho) seguida por uma janela permanente de contratação rápida que fica aberta o resto da época — são mecânicas diferentes, não a mesma coisa.' },
    { icon:'💰', title:'Semana de Free Agency — Propostas Reais', desc:'Durante a Semana 1, propões o contrato que quiseres a qualquer agente livre — salário (até $50M/ano) e duração (1-5 anos), limitado apenas pelo teu tecto salarial disponível. Não há valor fixo.' },
    { icon:'⚖️', title:'Como o Jogador Decide', desc:'Cada agente livre escolhe a melhor proposta com base numa fórmula: 50% salário oferecido (relativo à melhor proposta que recebeu), 20% ambição pessoal (jogadores ambiciosos preferem ser a cara da equipa; menos ambiciosos preferem uma equipa com mais garantias de ganhar), 15% popularidade da franquia, 15% qualidade do staff técnico + ter uma estrela (88+ OVR) já no plantel. Por cima desta fórmula, um ginásio de Grau A dá ainda um bónus extra de até +12 pontos (Grau B: +5) — um plantel a treinar em boas instalações atrai mais agentes livres.' },
    { icon:'⏰', title:'Prazo de Decisão', desc:'O jogador decide 1 dia depois da primeira proposta se for óbvio (só uma proposta, ou uma claramente melhor que as outras), ou 2 dias se for uma escolha equilibrada entre propostas próximas.' },
    { icon:'🔄', title:'Depois da Semana de Free Agency', desc:'A partir da Semana 2, qualquer agente livre restante pode ser contratado por um contrato fixo de $650K/1 ano. Se várias equipas quiserem o mesmo jogador, é sorteado ao acaso entre as que tenham espaço no tecto e no plantel — resolve-se todas as noites.' },
    { icon:'🔒', title:'Fecho da Free Agency', desc:'A contratação de agentes livres fecha por completo 2 semanas antes do play-in — não é possível assinar mais ninguém depois disso até à época seguinte.' },
  ] : [
    { icon:'🗓️', title:'Two Distinct Phases', desc:'Free Agency has one real negotiation week (Week 1, Jul 4-10) followed by an ongoing quick-signing window open the rest of the season — these are different mechanics, not the same thing.' },
    { icon:'💰', title:'Free Agency Week — Real Offers', desc:'During Week 1, you offer any contract you want to any free agent — salary (up to $50M/yr) and length (1-5 years), limited only by your available cap space. There is no fixed value.' },
    { icon:'⚖️', title:'How the Player Decides', desc:'Each free agent picks the best offer using a formula: 50% salary offered (relative to the best offer they received), 20% personal ambition (ambitious players prefer being the face of the franchise; less ambitious ones prefer a team with better winning guarantees), 15% franchise popularity, 15% coaching staff quality + already having a star (88+ OVR) teammate on the roster. On top of that formula, a Grade A practice facility adds a further bonus of up to +12 points (Grade B: +5) — good facilities genuinely attract free agents.' },
    { icon:'⏰', title:'Decision Timer', desc:'The player decides 1 day after the first offer if it\'s a no-brainer (only one offer, or one clearly better than the rest), or 2 days if it\'s a close call between similar offers.' },
    { icon:'🔄', title:'After Free Agency Week', desc:'From Week 2 onward, any remaining free agent can be signed to a flat $650K/1yr deal. If multiple teams want the same player, one is picked at random among those with cap and roster room — resolved every night.' },
    { icon:'🔒', title:'Free Agency Closes', desc:'Free agent signings shut down completely 2 weeks before the play-in — nobody can be signed after that until next season.' },
  ]

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 16px' }}>
      <h1 style={{ fontSize:24, fontWeight:900, color:'#1a1512', margin:0, marginBottom:6 }}>💰 {isPT?'Regras de Free Agency':'Free Agency Rules'}</h1>
      <p style={{ fontSize:13, color:'#8a8279', marginBottom:24 }}>
        {isPT?'Como funciona a contratação de agentes livres, da semana de negociação real ao mercado permanente.':'How signing free agents works, from the real negotiation week to the ongoing market.'}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {rules.map((r,i) => <RuleCard key={i} icon={r.icon} title={r.title} desc={r.desc} />)}
      </div>
      <div style={{ marginTop:20, padding:'16px 18px', borderRadius:12, background:'#dbeafe', border:'1px solid #93c5fd' }}>
        <div style={{ fontSize:12, color:'#1d4ed8', lineHeight:1.7 }}>
          {isPT
            ? 'Semana 1: propostas reais, decisão por fórmula (50% salário · 20% ambição · 15% popularidade · 15% staff/estrela) · Depois: $650K/1 ano fixo, sorteio entre propostas válidas · Fecha 2 semanas antes do play-in.'
            : 'Week 1: real offers, formula-based decision (50% salary · 20% ambition · 15% popularity · 15% staff/star) · After that: flat $650K/1yr, random draw among valid offers · Closes 2 weeks before the play-in.'}
        </div>
      </div>
    </div>
  )
}
