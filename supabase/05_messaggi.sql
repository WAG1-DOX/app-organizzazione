-- =====================================================================
-- 05_messaggi.sql — chi riceve un messaggio può cambiare SOLO "letto"
-- Eseguito a mano nel SQL Editor di Supabase (6 novembre 2026).
--
-- Il problema: la regola "messaggi: segnare come letto" permette al
-- destinatario di modificare la riga del messaggio. Senza limiti, poteva
-- cambiare anche il TESTO di un messaggio ricevuto (o il mittente).
--
-- La soluzione: togliamo il permesso di modificare la tabella e lo ridiamo
-- solo per la colonna "letto". La regola (policy) resta quella di prima:
-- solo il destinatario può farlo.
-- L'app (app/js/sezioni/chat.js) fa solo .update({ letto: true }): non cambia niente.
-- =====================================================================

revoke update on public.messaggi from authenticated, anon;
grant update (letto) on public.messaggi to authenticated;
