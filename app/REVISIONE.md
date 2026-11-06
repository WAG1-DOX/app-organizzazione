# Revisione completa dell'app — 5 novembre 2026

Ho guardato ogni pagina su computer e telefono, riletto tutto il codice (circa 5.000
righe), controllato la sicurezza del database di Edoardo e provato le funzioni con
dati simulati. Ho cambiato **solo cose sicuramente sbagliate** e ho preparato degli
**"innesti"**: codice già scritto ma **spento**, che si accende cambiando una riga.

---

## 1. In breve

- **Lo stato generale è buono.** Tutte le 13 sezioni si aprono senza errori, su
  computer e telefono, e nessuna pagina esce dai bordi.
- **Ho corretto 6 problemi**, 4 dei quali reali e fastidiosi (vedi sezione 2).
- **Ho preparato 3 innesti**: salvataggio nel database, notifiche sul Mac, app
  installabile (vedi sezione 3).
- **Il problema più grosso non è nel codice: è nei dati.** L'app contiene ancora
  molti **dati di esempio** mischiati ai tuoi veri (vedi sezione 4.1). Prima di usarla
  "sul serio" vanno tolti.
- **Il rischio più grosso è perdere i dati.** Oggi tutto sta solo nel browser: se
  svuoti la cache di Chrome sparisce tutto, e il piano gratuito di Supabase non fa
  backup. Le priorità sono quindi l'innesto database e un bottone "esporta".

---

## 2. Cosa ho corretto (già fatto)

| # | Problema | Cosa succedeva | Ora |
|---|---|---|---|
| 1 | **Il calendario saltava ogni 30 secondi** | La sincronizzazione con Google ridisegnava tutto e la vista tornava all'ora di partenza: se guardavi le 21:00 ti riportava alle 16:00 | Ridisegna solo se è cambiato qualcosa; altrimenti aggiorna solo la scritta "aggiornato adesso" |
| 2 | **Dopo ogni modifica le viste a ore tornavano su** | Modificavi un evento alle 20:00 e il calendario (o la Giornata, o l'orario) ripartiva dall'inizio | La posizione resta dov'era |
| 3 | **Tornando sulla scheda, la pagina si ridisegnava** | Supabase a volte ripete "sei dentro" e l'app ridisegnava tutto, rischiando di farti perdere quello che stavi scrivendo | Se sei sempre tu, non succede niente |
| 4 | **Privacy tra account sullo stesso computer** | Se Edoardo entrava dal tuo Mac, vedeva i dati salvati da te | Ogni account ha i suoi dati; il primo che entra si tiene quelli che c'erano già |
| 5 | **Il file vecchio rimasto in memoria rompeva il login** | Il piccolo server che usiamo fa tenere a Chrome i file vecchi: un file nuovo più uno vecchio insieme facevano fallire l'accesso | Il codice ora regge anche questo caso. **Vedi 4.2: ricarica con Cmd + Shift + R** |
| 6 | **Due difetti grafici sul telefono** | Il bottone "Nuovo obiettivo" usciva dal riquadro; nel calendario le parole si spezzavano a metà ("Principl-es") | Sistemati |

In più ho aggiunto l'**icona dell'app** (`icona.svg`) e il **manifest**
(`manifest.json`): il primo pezzo per installarla sul telefono come una vera app (PWA).

Tutto **riprovato dopo le correzioni**, con prove automatiche: posizione del
calendario mantenuta (308 → 308), l'account B non vede i dati dell'account A e A li
ritrova, gli innesti restano spenti, nessun errore in console. Nel progetto non c'è
nessuna chiave segreta.

---

## 3. Innesti pronti (spenti)

Si accendono in `app/js/config.js`, cambiando `false` in `true`.

### 3.1 Salvataggio nel database — `SUPABASE_DATI_ATTIVI` (file `js/dati-supabase.js`)
**Cosa fa quando è acceso:**
- al login scarica i tuoi dati da Supabase; se il database è ancora vuoto, ci carica
  sopra quello che hai nel browser, così non perdi niente;
- gli **eventi** creati nell'app vanno nella tabella `eventi` di Edoardo, **in tempo
  reale**: se Edoardo crea un evento in un gruppo comune, ti compare subito;
- **tutto il resto** (spese, giornata, obiettivi, sonno…) va in `dati_personali`, una
  riga per sezione, e viene mandato 1,5 secondi dopo ogni modifica, solo se è cambiato;
- così hai **gli stessi dati su ogni dispositivo** e **non li perdi più** se svuoti il browser.

**Quando accenderlo:** solo dopo che Edoardo ha eseguito il codice SQL in cima a
`app/tabelle-nuove.md`. La prima volta **va provato insieme**, perché il codice è
scritto ma non ancora provato con il database vero.

### 3.2 Notifiche sul Mac — `NOTIFICHE_ATTIVE` (file `js/notifiche.js`)
Con l'app aperta in Chrome, anche se usi un'altra finestra, avvisa:
- **10 minuti prima** di lezioni ed eventi (con luogo);
- **all'ora esatta** dei micro-eventi della Giornata (es. "20:25 · Creatina 5 g");
- **30 minuti prima** dell'ora di andare a letto;
- **alle 9:00** con i promemoria che scadono oggi.

Gli anticipi si cambiano in cima al file. L'ho provato "a secco": arrivano le notifiche
giuste, all'ora giusta, e non si ripetono.

### 3.3 App installabile — già attivo
Icona e manifest ci sono. Per installarla davvero sul telefono serve anche
**pubblicarla online** (vedi 5.3).

---

## 4. Cose da sapere subito

### 4.1 ⚠️ Dati di esempio mischiati ai tuoi
Questi li avevo messi io per le prove. Oggi si confondono con quelli veri:
- **eventi finti**: "Midterm · Mathematics", "Quiz · Financial Accounting",
  "Allenamento calcio", "Dentista", "Career day", "Allenamento calcio" del 10;
- **orario delle lezioni inventato**: con H-Farm collegato si nasconde da solo, ma esiste;
- **storico finto di 75 giorni**: le spunte della routine e le spese inventate. Per
  questo il **Monitor routine dice 100/100** e il **saldo è 140 €**;
- **promemoria, lista della spesa, obiettivi, mail e la paghetta di 150 €** di esempio;
- il gruppo **"Classe 4B"**, che nel database non esiste.

👉 **Consiglio:** un bottone **"Togli i dati di esempio"** (5 minuti di lavoro) da
premere una volta. Non l'ho fatto perché cancella dati e devi deciderlo tu. In
alternativa c'è già "Ricomincia da capo", ma rimette proprio i dati di esempio.

### 4.2 Ricaricare "per bene"
Quando cambiamo il codice, ricarica con **Cmd + Shift + R** (non solo Cmd + R): così
Chrome non tiene in memoria i file vecchi. Vale anche per Edoardo.

### 4.3 Le mail di Supabase non arrivano
Il servizio di posta gratuito di Supabase è solo per le prove. Per ora confermate gli
account a mano dal SQL Editor (l'hai già fatto). Soluzioni vere in 6.3.

---

## 5. Cosa manca o va migliorato (in ordine di importanza)

### 5.1 Importante
1. **Salvare i dati al sicuro.** Accendere l'innesto database (3.1) appena possibile.
   Nel frattempo, un bottone **"Esporta i miei dati"** che scarica un file di backup:
   15 minuti di lavoro, tranquillità totale.
2. **Togliere i dati di esempio** (4.1).
3. **La chat manca.** Era nel piano iniziale, e Edoardo ha già fatto la tabella
   `messaggi` con il tempo reale. Lato app è il passo naturale dopo il database.
4. **I gruppi veri.** Oggi "Visibile a: Gruppo Classe 4B" è finto. Serve una pagina
   piccola per creare un gruppo (es. "Noi due", "H-Farm") e invitare Edoardo; il
   database è già pronto.
5. **Una pagina Impostazioni**, per avere tutto in un posto: nome e foto, orari di sonno
   predefiniti, quali calendari Google mostrare, notifiche sì/no e anticipi, colore
   principale, esporta dati, esci.

### 5.2 Utile
6. **Quotidiane e Giornata si sovrappongono:** due posti per la stessa routine (denti,
   doccia, zaino). Proposta: la Giornata diventa il posto unico, e "Quotidiane e
   nutrizione" tiene solo acqua e pasti.
7. **Calendario:**
   - **trascinare gli eventi** per spostarli (come su Google);
   - **eventi che si ripetono** (ogni lunedì…): oggi ci sono solo per le attività extra;
   - una **ricerca**;
   - **sul telefono** partire dalla vista Giorno (la Settimana mostra solo 3 giorni).
8. **Spese:**
   - **modificare il budget** e le categorie (oggi sono fissi: 200 €, Cibo 70…);
   - **importare l'estratto conto** della banca (CSV), alternativa gratis al
     collegamento diretto;
   - le foto degli scontrini oggi restano **solo in questo browser**: col database
     andranno in Supabase Storage.
9. **Promemoria:** aggiungere anche l'**ora**, non solo il giorno, e farli suonare
   (con l'innesto notifiche).
10. **Il "+" giallo in basso a destra** oggi aggiunge solo attività extra. Meglio un
    piccolo menu: Evento · Micro-evento · Promemoria · Spesa · Obiettivo.
11. **Dashboard:** aggiungere un riquadro "Obiettivi" (i 2-3 più vicini alla
    scadenza) e "Sonno di stanotte".
12. **Lezioni:** il collegamento evento → materia indovina dal titolo ("Economics",
    "Accounting"…). Se H-Farm usa nomi diversi, aggiungere un campo "parole chiave"
    nella materia.

### 5.3 Più avanti
13. **Pubblicare l'app online** (Vercel o Netlify, gratis): serve per usarla dal
    telefono, per le mail di conferma, per le notifiche ad app chiusa e per
    installarla come app.
14. **Google sempre collegato**, senza premere "Collega" ogni volta: va fatto con
    Supabase (login con Google + refresh token sul server).
15. **Check-up mail vero** con Gmail (stesso collegamento del punto 14).
16. **Assistente AI**, il campo "Chiedi all'assistente…": Claude Haiku tramite una
    Edge Function, come deciso in CLAUDE.md.
17. **Banche:** per ultime; prima l'import CSV (punto 8).

### 5.4 Accessibilità e qualità del codice (quando c'è tempo)
- Alcuni testi grigi molto scuri (colore `--testo-tenue`) si leggono poco: alzare un
  po' il contrasto.
- Il trascinamento funziona solo con il mouse: sul telefono c'è il tocco come
  alternativa, ma non da tastiera.
- `style.css` è cresciuto a strati (1.460 righe con ritocchi in fondo): una pulizia lo
  renderebbe più facile da modificare.
- I dati di esempio stanno in `dati-finti.js` insieme alle cose vere (micro-eventi
  preimpostati, categorie): vanno separati quando si toglie il finto.

---

## 6. Sicurezza e database (per Edoardo)

Lo `schema.sql` è fatto bene: la Row Level Security è attiva ovunque, le regole sono
giuste, i profili si creano da soli e i gruppi hanno admin e membri. Ho trovato queste cose:

### 6.1 Da sistemare
1. **Messaggi: il destinatario può modificare il testo.** La regola "segnare come
   letto" permette di cambiare **tutta** la riga, quindi chi riceve un messaggio
   potrebbe modificarne il testo. Proposta:
   ```sql
   -- chi riceve un messaggio può cambiare SOLO "letto"
   revoke update on public.messaggi from authenticated;
   grant update (letto) on public.messaggi to authenticated;
   ```
2. **Chiunque abbia l'indirizzo può registrarsi** e vedere i **nomi** di tutti i
   profili (regola "profili: vedere" = tutti). Visto che l'app è per voi due:
   quando siete registrati entrambi, **disattivare le nuove registrazioni**
   (Authentication → Sign In / Providers → togliere "Allow new users to sign up").
3. **Le 2 modifiche per collegare l'app**: tipo `produttivita`, i campi luogo, colore
   e Google negli eventi, e la tabella `dati_personali`. Codice pronto in cima a
   `app/tabelle-nuove.md`.

### 6.2 Da sapere
- **Il piano gratuito mette in pausa il progetto dopo circa 7 giorni senza uso.** Si
  riattiva dal pannello, ma nel frattempo l'app non funziona. Basta usarla.
- **Il piano gratuito non fa backup** (in Supabase c'è scritto "No backups"): per
  questo serve il bottone "Esporta i miei dati" (5.1).
- **URL Configuration:** mettere `http://localhost:8000` in Site URL e Redirect URLs
  (e più avanti l'indirizzo online).

### 6.3 Mail che non arrivano
- Per ora: conferma a mano dal SQL Editor, oppure togliere "Confirm email".
- Quando l'app è online: collegare un servizio di posta gratuito (es. **Resend**, 3.000
  mail al mese gratis) in Authentication → Emails → SMTP.

### 6.4 Controllato e a posto ✅
- Nessuna chiave segreta nel progetto: niente `sb_secret`, `service_role` o
  `GOCSPX` (il secret di Google è disattivato).
- `config.js` contiene solo URL e chiave **publishable**, che sono pubblici.
- Il codice dell'app non inserisce mai nella pagina testo scritto dall'utente come
  HTML (niente rischio di "codice iniettato"). Le descrizioni di Google vengono pulite
  in modo sicuro.

---

## 7. Il percorso che consiglio

1. **Stasera (Edoardo):** registrazione, SQL delle 2 modifiche, URL Configuration,
   messaggi (6.1.1).
2. **Prossima volta insieme:** togliere i dati di esempio, accendere l'innesto
   database e provarlo, bottone "Esporta i miei dati".
3. **Poi:** gruppi veri → chat → pagina Impostazioni → unire Quotidiane e Giornata.
4. **Dopo:** pubblicare online → notifiche sul telefono, Google sempre collegato,
   Gmail → assistente AI → banche.
