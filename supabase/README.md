# Cartella supabase — parte di Edoardo

Qui va tutto quello che riguarda il database.

## Cosa fare
1. Creare il progetto su [supabase.com](https://supabase.com) (piano gratuito).
2. Creare le tabelle con **esattamente** i nomi dei campi scritti in `CLAUDE.md`
   (sezione "Database — nomi dei campi"). Se un nome deve cambiare, avvisare Luca prima.
   I dati finti di Luca in `app/dati-finti.js` usano già questi nomi.
3. Salvare qui il codice SQL delle tabelle, in `schema.sql`, così resta su GitHub.
4. Attivare la **Row Level Security** su ogni tabella e scrivere le regole.
5. Attivare il login (email/password, poi Google).
6. Passare a Luca **URL del progetto** e **chiave anon**.

## Chiavi
- **anon**: può stare nel sito (la sicurezza la fa la Row Level Security).
- **service_role**: segreta. Solo in `.env`, mai su GitHub, mai nel sito.
