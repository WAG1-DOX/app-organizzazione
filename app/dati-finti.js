// DATI FINTI — servono solo finché il database Supabase non è pronto.
// I nomi dei campi sono gli stessi delle tabelle del database (vedi CLAUDE.md).
// Le tabelle nuove (orario, attività, spese…) sono descritte in app/tabelle-nuove.md:
// vanno confermate con Edoardo.

const profiliFinti = [
  { id: "u-luca", nome: "Luca", avatar_url: null, creato_il: "2026-11-05T17:00:00+01:00" },
  { id: "u-edoardo", nome: "Edoardo", avatar_url: null, creato_il: "2026-11-05T17:00:00+01:00" },
];

const gruppiFinti = [
  { id: "g-classe", nome: "Classe 4B", creato_da: "u-edoardo", creato_il: "2026-11-05T17:00:00+01:00" },
];

const membriGruppoFinti = [
  { gruppo_id: "g-classe", utente_id: "u-edoardo", ruolo: "admin" },
  { gruppo_id: "g-classe", utente_id: "u-luca", ruolo: "membro" },
];

// ===== Eventi (verifiche, allenamenti, impegni…) =====
const eventiFinti = [
  {
    id: "e1", titolo: "Midterm · Mathematics for Business", descrizione: "Capitoli 4 e 5", tipo: "scuola",
    inizio: "2026-11-12T11:00:00+01:00", fine: "2026-11-12T13:00:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-edoardo", gruppo_id: "g-classe", completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e2", titolo: "Allenamento calcio", descrizione: "", tipo: "allenamento",
    inizio: "2026-11-10T17:30:00+01:00", fine: "2026-11-10T19:00:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-luca", gruppo_id: null, completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e3", titolo: "Dentista", descrizione: "Portare la tessera sanitaria", tipo: "impegno",
    inizio: "2026-11-11T15:00:00+01:00", fine: "2026-11-11T16:00:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-luca", gruppo_id: null, completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e4", titolo: "Career day in università", descrizione: "", tipo: "scuola",
    inizio: "2026-11-14T00:00:00+01:00", fine: "2026-11-14T23:59:00+01:00", tutto_il_giorno: true,
    proprietario_id: "u-edoardo", gruppo_id: "g-classe", completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e5", titolo: "Allenamento calcio", descrizione: "Campo comunale", tipo: "allenamento",
    inizio: "2026-11-05T18:00:00+01:00", fine: "2026-11-05T19:30:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-luca", gruppo_id: null, completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e6", titolo: "Quiz · Financial Accounting", descrizione: "Stato patrimoniale", tipo: "scuola",
    inizio: "2026-11-06T09:00:00+01:00", fine: "2026-11-06T10:00:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-luca", gruppo_id: "g-classe", completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
];

// ===== Materie e orario delle lezioni (si ripete ogni settimana) =====
// Si possono modificare dall'app (sezione Lezioni → "Modifica orario").
const materieFinte = [
  { id: "mat-eco", nome: "Principles of Economics", prof: "Bianchi", aula: "Aula 1", colore: "#d1fe17" },
  { id: "mat-acc", nome: "Principles of Financial Accounting", prof: "Rossi", aula: "Aula 3", colore: "#7dd3c0" },
  { id: "mat-mat", nome: "Mathematics for Business", prof: "Verdi", aula: "Aula 2", colore: "#f4a261" },
];

// giorno: 1 = lunedì, 2 = martedì … 6 = sabato
const orarioFinto = [
  [1, "09:00", "11:00", "mat-eco"], [1, "11:00", "13:00", "mat-acc"],
  [2, "09:00", "11:00", "mat-mat"], [2, "14:00", "16:00", "mat-eco"],
  [3, "10:00", "12:00", "mat-acc"], [3, "12:00", "13:00", "mat-mat"],
  [4, "09:00", "11:00", "mat-eco"], [4, "11:00", "13:00", "mat-mat"],
  [5, "09:00", "11:00", "mat-acc"],
].map(([giorno, inizio, fine, materia_id], i) => ({ id: `lez-${i + 1}`, giorno, inizio, fine, materia_id }));

// ===== Lista della spesa =====
const listaSpesaFinta = [
  { id: "ls1", nome: "Pasta integrale", quantita: "2 pacchi", categoria: "carboidrati", preso: false },
  { id: "ls2", nome: "Riso basmati", quantita: "1 kg", categoria: "carboidrati", preso: false },
  { id: "ls3", nome: "Petto di pollo", quantita: "500 g", categoria: "proteine", preso: false },
  { id: "ls4", nome: "Uova", quantita: "6", categoria: "proteine", preso: false },
  { id: "ls5", nome: "Yogurt greco", quantita: "4", categoria: "proteine", preso: false },
  { id: "ls6", nome: "Olio extravergine", quantita: "1 l", categoria: "grassi", preso: false },
  { id: "ls7", nome: "Mandorle", quantita: "200 g", categoria: "grassi", preso: false },
  { id: "ls8", nome: "Zucchine", quantita: "4", categoria: "verdure", preso: false },
  { id: "ls9", nome: "Spinaci", quantita: "1 busta", categoria: "verdure", preso: false },
];

// ===== Attività quotidiane preimpostate =====
const attivitaQuotidianeFinte = [
  { id: "q-denti", nome: "Lavare i denti", minuti: 2, volte_al_giorno: 2, icona: "dente" },
  { id: "q-doccia", nome: "Doccia", minuti: 25, volte_al_giorno: 1, icona: "goccia" },
  { id: "q-zaino", nome: "Preparare lo zaino", minuti: 5, volte_al_giorno: 1, icona: "zaino" },
];

// ===== Attività extra salvate (si aggiungono al calendario col +) =====
const modelliExtraFinti = [
  { id: "x-palestra", nome: "Palestra", minuti: 90, tipo: "allenamento" },
  { id: "x-calcio", nome: "Allenamento calcio", minuti: 90, tipo: "allenamento" },
  { id: "x-corsa", nome: "Corsa", minuti: 40, tipo: "allenamento" },
  { id: "x-studio", nome: "Studio / ripasso", minuti: 60, tipo: "produttivita" },
  { id: "x-chitarra", nome: "Chitarra", minuti: 30, tipo: "altro" },
];

// ===== Promemoria =====
const promemoriaFinti = [
  { id: "p1", testo: "Pagare la quota della palestra", scadenza: "2026-11-04", fatto: false },
  { id: "p2", testo: "Portare il libro di arte", scadenza: "2026-11-07", fatto: false },
  { id: "p3", testo: "Firma autorizzazione gita", scadenza: "2026-11-09", fatto: false },
  { id: "p4", testo: "Comprare un quaderno a quadretti", scadenza: null, fatto: false },
  { id: "p5", testo: "Restituire il libro in biblioteca", scadenza: "2026-11-02", fatto: true },
];

// ===== Budget mensile (euro) =====
const budgetFinto = {
  mensile: 200,
  categorie: { "Cibo": 70, "Svago": 50, "Trasporti": 30, "Scuola": 30, "Altro": 20 },
};
const categorieEntrate = ["Paghetta", "Lavoretti", "Regali", "Altro"];

// ===== Mail (solo esempio: il collegamento a Gmail arriverà dopo) =====
const regoleMailFinte = {
  mittenti: ["scuola.edu.it", "segreteria"],
  parole: ["verifica", "scadenza", "pagamento", "gita", "bolletta"],
};

const mailFinte = [
  { id: "m1", mittente: "Segreteria Liceo", email: "segreteria@scuola.edu.it", oggetto: "Autorizzazione gita a Firenze", anteprima: "Si ricorda di consegnare l'autorizzazione firmata entro lunedì…", data: "2026-11-05T08:12:00+01:00" },
  { id: "m2", mittente: "Prof. Rossi", email: "rossi@scuola.edu.it", oggetto: "Argomenti del midterm di Mathematics for Business", anteprima: "Il midterm del 12 comprende i capitoli 4 e 5, porta la calcolatrice…", data: "2026-11-04T19:40:00+01:00" },
  { id: "m3", mittente: "Netflix", email: "info@netflix.com", oggetto: "Nuove uscite questa settimana", anteprima: "Scopri le serie più viste…", data: "2026-11-04T12:00:00+01:00" },
  { id: "m4", mittente: "Palestra FitZone", email: "info@fitzone.it", oggetto: "Promemoria pagamento quota", anteprima: "La quota di novembre è in scadenza il 4…", data: "2026-11-03T09:30:00+01:00" },
  { id: "m5", mittente: "Amazon", email: "ordini@amazon.it", oggetto: "Il tuo ordine è stato spedito", anteprima: "Il pacco arriverà giovedì…", data: "2026-11-03T08:00:00+01:00" },
  { id: "m6", mittente: "Instagram", email: "no-reply@instagram.com", oggetto: "Hai 5 nuove notifiche", anteprima: "Guarda chi ha messo mi piace…", data: "2026-11-02T21:00:00+01:00" },
  { id: "m7", mittente: "Edoardo", email: "edoardo@gmail.com", oggetto: "Database pronto?", anteprima: "Ho quasi finito le tabelle, ti mando l'URL…", data: "2026-11-02T18:15:00+01:00" },
];

// ===== Giornata: micro-eventi preimpostati da trascinare nella giornata =====
// categoria: routine, integratori, pasti, riposo, movimento
// quotidiana_id: se segni fatto il micro-evento, conta anche per l'attività quotidiana (Monitor routine)
const microModelliFinti = [
  { id: "mm-sveglia", nome: "Sveglia e bicchiere d'acqua", minuti: 5, categoria: "routine", note: "" },
  { id: "mm-denti", nome: "Lavare i denti", minuti: 2, categoria: "routine", note: "", quotidiana_id: "q-denti" },
  { id: "mm-doccia", nome: "Doccia", minuti: 25, categoria: "routine", note: "", quotidiana_id: "q-doccia" },
  { id: "mm-skincare", nome: "Skincare", minuti: 5, categoria: "routine", note: "" },
  { id: "mm-zaino", nome: "Preparare lo zaino", minuti: 5, categoria: "routine", note: "Guarda le lezioni di domani", quotidiana_id: "q-zaino" },
  { id: "mm-int-mattina", nome: "Vitamina D3 + Omega 3", minuti: 1, categoria: "integratori", note: "Con la colazione (vanno presi con un pasto che contiene grassi)" },
  { id: "mm-creatina", nome: "Creatina 5 g", minuti: 1, categoria: "integratori", note: "Ogni giorno, in acqua; l'orario non è importante" },
  { id: "mm-magnesio", nome: "Magnesio", minuti: 1, categoria: "integratori", note: "Circa 30 minuti prima di dormire" },
  { id: "mm-colazione", nome: "Colazione", minuti: 15, categoria: "pasti", note: "" },
  { id: "mm-cucinare", nome: "Cucinare", minuti: 30, categoria: "pasti", note: "" },
  { id: "mm-pranzo", nome: "Pranzo", minuti: 30, categoria: "pasti", note: "" },
  { id: "mm-spuntino", nome: "Spuntino", minuti: 10, categoria: "pasti", note: "" },
  { id: "mm-cena", nome: "Cena", minuti: 40, categoria: "pasti", note: "" },
  { id: "mm-riposo", nome: "Riposo", minuti: 20, categoria: "riposo", note: "Niente telefono, occhi chiusi" },
  { id: "mm-letto", nome: "A letto, schermi spenti", minuti: 15, categoria: "riposo", note: "" },
  { id: "mm-stretching", nome: "Stretching", minuti: 10, categoria: "movimento", note: "" },
  { id: "mm-camminata", nome: "Camminata", minuti: 20, categoria: "movimento", note: "" },
];

// La "routine base": la giornata tipo che puoi applicare a ogni giorno con un clic
const routineBaseFinta = [
  ["07:00", "mm-sveglia"], ["07:05", "mm-doccia"], ["07:30", "mm-colazione"], ["07:45", "mm-int-mattina"],
  ["07:46", "mm-creatina"], ["07:50", "mm-denti"], ["13:00", "mm-cucinare"], ["13:30", "mm-pranzo"],
  ["14:00", "mm-riposo"], ["16:30", "mm-spuntino"], ["19:30", "mm-cucinare"], ["20:00", "mm-cena"],
  ["21:00", "mm-stretching"], ["22:15", "mm-zaino"], ["22:20", "mm-skincare"], ["22:25", "mm-denti"],
  ["22:30", "mm-magnesio"], ["22:35", "mm-letto"],
].map(([inizio, modello_id]) => ({ inizio, modello_id }));

// ===== Obiettivi a lungo termine =====
const categorieObiettiviFinte = [
  { id: "co-scuola", nome: "Scuola", colore: "#d1fe17" },
  { id: "co-salute", nome: "Salute e sport", colore: "#7dd3c0" },
  { id: "co-personale", nome: "Personale", colore: "#c3a6ff" },
  { id: "co-soldi", nome: "Soldi", colore: "#f4a261" },
];

const obiettiviLungoFinti = [
  { id: "ol1", categoria_id: "co-scuola", titolo: "Media del 28 a fine semestre", descrizione: "", scadenza: "2027-02-28", fatto: false,
    passi: [{ id: "p1", testo: "Passare il midterm di Mathematics", fatto: false }, { id: "p2", testo: "Consegnare tutti gli assignment in tempo", fatto: false }, { id: "p3", testo: "Ripasso settimanale di Accounting", fatto: true }] },
  { id: "ol2", categoria_id: "co-salute", titolo: "Correre 10 km senza fermarmi", descrizione: "", scadenza: "2027-03-31", fatto: false,
    passi: [{ id: "p1", testo: "5 km", fatto: true }, { id: "p2", testo: "7 km", fatto: false }, { id: "p3", testo: "10 km", fatto: false }] },
  { id: "ol3", categoria_id: "co-soldi", titolo: "Risparmiare 500 €", descrizione: "Mettere da parte quello che avanza del budget", scadenza: "2027-06-30", fatto: false, passi: [] },
  { id: "ol4", categoria_id: "co-personale", titolo: "Leggere 12 libri quest'anno", descrizione: "", scadenza: "2026-12-31", fatto: false,
    passi: [{ id: "p1", testo: "Libro 1", fatto: true }, { id: "p2", testo: "Libro 2", fatto: true }, { id: "p3", testo: "Libro 3", fatto: false }] },
];
