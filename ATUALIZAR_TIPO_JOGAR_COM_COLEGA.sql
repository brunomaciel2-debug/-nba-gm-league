-- ============================================
-- CORRIGE "wants_to_play_with_teammate" PARA SER MONITORIZADA A SÉRIO
-- Cola no Supabase SQL Editor e corre (uma vez só)
--
-- Esta razão era do tipo "imediata" — bastava carregar em "Ceder" para os
-- dois jogadores subirem de moral, sem verificar se realmente jogaram
-- juntos. Passa a ser monitorizada como as outras: o sistema verifica se
-- os dois foram titulares juntos nos jogos reais das 2 semanas seguintes.
-- ============================================

UPDATE player_interaction_types SET
  resolution_type = 'monitored',
  monitor_metric = 'shared_starts',
  monitor_weeks = 2,
  moral_met = 20,
  moral_partial = 5,
  moral_ignored = -15
WHERE reason_key = 'wants_to_play_with_teammate';

UPDATE player_interaction_types_preteste SET
  resolution_type = 'monitored',
  monitor_metric = 'shared_starts',
  monitor_weeks = 2,
  moral_met = 20,
  moral_partial = 5,
  moral_ignored = -15
WHERE reason_key = 'wants_to_play_with_teammate';

SELECT 'Tipo wants_to_play_with_teammate atualizado para monitorizado!' as resultado;
