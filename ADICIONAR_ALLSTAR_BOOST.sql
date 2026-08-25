-- Marca até que semana um jogador beneficia do "efeito All-Star" (moral mais
-- alta e mais vendas de camisolas) depois de ser convocado — ver
-- src/lib/allstar-constants.ts (ALLSTAR_BOOST_WEEKS), src/app/api/cron/simulate/run.ts
-- (drift de moral) e src/lib/merchandising.ts (vendas de camisolas).

ALTER TABLE players ADD COLUMN IF NOT EXISTS allstar_boost_until_week INTEGER;
