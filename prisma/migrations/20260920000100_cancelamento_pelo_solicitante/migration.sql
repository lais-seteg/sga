-- Cancelamento: o solicitante pode desistir do próprio pedido.
--
-- Quem pediu pode deixar de precisar — o evento foi adiado, a campanha mudou,
-- a peça não será mais usada. É melhor ele cancelar do que a equipe produzir
-- algo que ninguém vai usar.
--
-- Cancelar NÃO é apagar: a solicitação continua na lista, com status
-- Cancelado e o motivo registrado. O pedido existiu, ocupou fila e às vezes
-- consumiu produção; sumir da vista significaria perder esse registro e
-- transformar "por que isso não foi feito?" numa discussão sem resposta.
--
-- O estado novo entra em statement separado: um valor de enum recém-criado
-- não pode ser USADO na mesma transação que o criou.
--
-- A justificativa reaproveita `solicitacao_eventos.observacao`, criada na
-- migration anterior para os pedidos de ajuste — é a mesma necessidade
-- (explicar por escrito uma transição) no mesmo lugar.

ALTER TYPE public."StatusSolicitacao" ADD VALUE IF NOT EXISTS 'cancelado' AFTER 'concluido';
