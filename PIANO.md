# Piano dei prossimi lavori — X-ECUTE

Deciso da Edoardo il 6 novembre 2026 (con il suo Claude). Luca: leggilo e dimmi se ti va bene,
soprattutto la divisione dei blocchi. Prima di iniziare un blocco: **Pull**, e scrivete sul gruppo
chi lo sta facendo. Un blocco finito → Commit + Push subito.

Regola d'oro per non avere conflitti: **Edoardo** lavora in `supabase/` (database, funzioni,
assistente, Telegram); **Luca** lavora in `app/` (schermate, grafica). Se uno deve toccare un file
dell'altro, prima lo dice.

---

## Blocco 1 — L'assistente che FA le cose  · Edoardo — ✅ FATTO (6 nov 2026)
Funzione `assistente` con strumenti: `segna_fatto` (attività quotidiane `q-…` → `registro`, micro-eventi
`mi-…` → `giornate`), `segna_pasto` (`pasti`), `aggiungi_acqua` (`acqua`), `crea_promemoria`
(`promemoria`, con `da_inviare` per Google). Scrive in `dati_personali` con le chiavi dell'app; risponde
con `{ risposta, azioni, cambiati }` e accetta `storia` (chat di oggi) per il Blocco 2.
L'app (`apriAssistente` in app.js) dopo un'azione ricarica i dati dal database e mostra le azioni.
Provato: domanda sulle caselle mancanti + promemoria creato e salvato.

Oggi l'assistente risponde e basta. Deve poter agire:
- **spuntare le abitudini**: "ho pranzato e preso la creatina" → spunta pasto e integratori di oggi;
- **creare promemoria**: "ricordami di chiamare la nonna venerdì alle 18" → promemoria.

Come: nella funzione `assistente` Claude usa degli "strumenti" (tool use) e la funzione scrive nel
database. **Da decidere insieme prima di iniziare**: i nomi esatti di dove l'app salva abitudini e
promemoria (chiavi di `dati_personali`). Li scriviamo in `CLAUDE.md` come "contratto", così nessuno
li cambia senza dirlo.

Dopo: le altre azioni (creare eventi, segnare spese) quando queste due funzionano bene.

## Blocco 2 — Chat dell'assistente in stile Gemini  · Luca (schermata) + Edoardo (salvataggio)
- Toccando "Chiedi all'assistente…" si apre **una finestra dal basso, metà telefono**
  (sul computer: finestra in basso a destra). Si può tirare su a tutto schermo.
- Finestra vuota: **logo X al centro**, sotto "Ciao Edoardo, come posso aiutarti?" e
  **3-4 suggerimenti da toccare** ("Ho appena pranzato", "Ricordami di…", "Cosa ho oggi?").
- In basso **barra arrotondata** per scrivere, con microfono (dettatura) e invio.
- Quando scrivi: **messaggi a catena** (i tuoi a destra in bolla, l'assistente a sinistra),
  animazione mentre pensa. Niente più "cancella la domanda per farne un'altra".
- **Una chat al giorno, senza memoria**: ogni giorno riparte da zero, ma le chat vecchie si
  possono rileggere (☰ in alto nella finestra).
- Stile X-ECUTE (sfondo scuro, verde), non i colori o il logo di Google.
- Dettagli presi dallo screenshot di riferimento (solo la disposizione, rifatta con i nostri colori):
  - **sfondo nero con un alone di luce che sale dal basso** (da noi verde X-ECUTE, molto tenue);
  - **in alto**: a sinistra un pulsante tondo ☰ (chat dei giorni prima), accanto il titolo
    "Assistente"; a destra un pulsante tondo "nuova chat" e l'avatar tondo con l'iniziale;
  - **al centro**: il logo X verde e sotto una frase **grande, sottile, centrata**
    (es. "Cosa facciamo oggi, Edoardo?"), poi i 3-4 suggerimenti come pillole;
  - **barra per scrivere a pillola**, grigio scuro e ben arrotondata: a sinistra "+",
    al centro "Chiedi all'assistente", a destra il microfono e un **pulsante tondo verde** per inviare;
  - la barra sta sopra la tastiera quando scrivi (sul telefono).
- Edoardo: tabella per salvare i messaggi della chat (ognuno vede solo i suoi) e funzione che
  riceve la conversazione del giorno.

## Blocco 3 — Bot Telegram con vocali  · Edoardo
- Un bot "X-ECUTE" su Telegram: gli scrivi o gli mandi un **vocale**.
- Il vocale viene trascritto (servizio **Groq**, gratis) e passato all'assistente del Blocco 1,
  che spunta le caselle / crea il promemoria e risponde su Telegram.
- Ognuno collega il suo Telegram all'account con un codice (dall'app: "Collega Telegram").
- Serve il Blocco 1 finito.

## Blocco 4 — Classifica settimanale + report di fine mese  · Edoardo (punti) + Luca (pagina)
- Classifica **tra amici, dentro un gruppo** (es. Edoardo contro Luca), si azzera ogni lunedì.
- Punti (proposta, da confermare): **1** per ogni abitudine spuntata, **2** per ogni evento o
  allenamento completato, **5** per una sfida finita, **bonus** se completi tutta la giornata.
- **A fine mese** un report: chi ha vinto, cosa sta andando bene, cosa migliorare
  (scritto dall'assistente). Dove arriva: da decidere (Telegram e/o chat dell'assistente).

## Blocco 5 — App più semplice  · Luca
- **Sul telefono il menu va a sinistra**: pulsante ☰ in alto a sinistra, il menu esce da sinistra
  e si richiude quando scegli (non più la fila di icone in alto).
- **Meno sezioni** (oggi sono 14): per esempio "Oggi" che unisce Dashboard + Giornata +
  Quotidiane + Routine; Lezioni e Settimana prossima dentro Calendario; il resto in "Altro".
  Da decidere insieme quali tenere.
- **Meno colori**: verde X-ECUTE + grigi, al massimo 3 colori per i tipi di evento.
- **Tutorial al primo accesso**: 4-5 fumetti saltabili ("qui chiedi all'assistente", "qui il
  calendario"…), oltre alla configurazione guidata che c'è già.

---

## Ordine
1. **Blocco 1** (Edoardo) — intanto Luca fa il **Blocco 5** e la grafica del **Blocco 2**.
2. **Blocco 2** completo (salvataggio chat) e **Blocco 3** (Telegram).
3. **Blocco 4** (classifica e report).

## Lasciato perdere per ora
- Check-up delle email (Gmail): richiede permessi Google "molto sensibili".
- Messenger / WhatsApp: non permettono di collegare la chat personale; usiamo Telegram.

## Da tenere a mente
- Limite di domande al giorno all'assistente (protegge il credito Claude), prima di dare l'app
  ad altri o di attivare i vocali.
- Notifiche sul telefono e riepilogo del mattino: idee per dopo.
