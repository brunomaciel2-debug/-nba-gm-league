-- Adiciona a data simulada (do calendário do jogo) às mensagens da caixa de
-- entrada dos GMs — até agora só existia created_at (a hora real do servidor),
-- por isso a caixa de entrada mostrava "há 39 minutos" (tempo real) em vez de
-- mostrar a que dia do simulador a mensagem pertence.
--
-- Um trigger (não é preciso mudar nenhum dos ~33 sítios do código que inserem
-- mensagens) preenche sim_date automaticamente com o "Now" do simulador —
-- exatamente o mesmo cálculo que a barra do topo do site já usa
-- (season_config.last_sim_day + 1 dia).

ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS sim_date DATE;

CREATE OR REPLACE FUNCTION set_inbox_message_sim_date()
RETURNS TRIGGER AS $$
DECLARE
  last_day DATE;
BEGIN
  SELECT last_sim_day INTO last_day FROM season_config WHERE id = 1;
  IF last_day IS NOT NULL THEN
    NEW.sim_date := last_day + INTERVAL '1 day';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_inbox_message_sim_date ON inbox_messages;
CREATE TRIGGER trg_set_inbox_message_sim_date
BEFORE INSERT ON inbox_messages
FOR EACH ROW
EXECUTE FUNCTION set_inbox_message_sim_date();

-- Mensagens já existentes não têm sim_date (o trigger só atua em inserções
-- novas) — a página da caixa de entrada mostra a data real formatada como
-- reserva nesse caso, em vez de "há X minutos".
