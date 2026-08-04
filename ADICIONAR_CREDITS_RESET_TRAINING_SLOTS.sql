-- Adiciona uma marca temporal a cada slot de treino, indicando quando esse
-- slot recebeu o lote atual de 10 créditos. É usada para somar quanto já
-- foi gasto em cada jogador DESDE esse momento, e assim aplicar
-- corretamente o limite de 3 créditos por jogador por lote (antes o limite
-- só era verificado dentro de uma única sessão do ecrã, permitindo
-- contornar o limite ao aplicar treino várias vezes seguidas).

ALTER TABLE training_slots ADD COLUMN IF NOT EXISTS credits_reset_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE training_slots_preteste ADD COLUMN IF NOT EXISTS credits_reset_at timestamptz NOT NULL DEFAULT now();
