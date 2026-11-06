// ===== suggerimenti.js: le proposte della configurazione guidata =====
//
// Qui NON ci sono dati di qualcuno: sono solo idee che la configurazione guidata
// (js/configurazione.js) propone la prima volta che entri. Scegli tu quali tenere;
// quello che scegli finisce nei TUOI dati (e su Supabase).
// Gli id (es. "q-denti") servono anche ai consigli del Monitor routine: non cambiarli.

const SUGGERIMENTI = {
  // ---------- Scuola (H-Farm) ----------
  materie: [
    { id: "mat-eco", nome: "Principles of Economics", prof: "", aula: "", colore: "#d1fe17" },
    { id: "mat-acc", nome: "Principles of Financial Accounting", prof: "", aula: "", colore: "#7dd3c0" },
    { id: "mat-mat", nome: "Mathematics for Business", prof: "", aula: "", colore: "#f4a261" },
  ],

  // ---------- Attività quotidiane (contano per il Monitor routine) ----------
  quotidiane: [
    { id: "q-denti", nome: "Lavare i denti", minuti: 2, volte_al_giorno: 2, icona: "dente" },
    { id: "q-doccia", nome: "Doccia", minuti: 25, volte_al_giorno: 1, icona: "goccia" },
    { id: "q-zaino", nome: "Preparare lo zaino", minuti: 5, volte_al_giorno: 1, icona: "zaino" },
    { id: "q-letto", nome: "Rifare il letto", minuti: 3, volte_al_giorno: 1, icona: "sole" },
    { id: "q-skincare", nome: "Skincare", minuti: 5, volte_al_giorno: 2, icona: "goccia" },
    { id: "q-lettura", nome: "Leggere", minuti: 20, volte_al_giorno: 1, icona: "stella" },
  ],

  // ---------- Attività extra (si mettono in calendario col +) ----------
  extra: [
    { id: "x-palestra", nome: "Palestra", minuti: 90, tipo: "allenamento" },
    { id: "x-calcio", nome: "Allenamento calcio", minuti: 90, tipo: "allenamento" },
    { id: "x-corsa", nome: "Corsa", minuti: 40, tipo: "allenamento" },
    { id: "x-nuoto", nome: "Nuoto", minuti: 60, tipo: "allenamento" },
    { id: "x-studio", nome: "Studio / ripasso", minuti: 60, tipo: "produttivita" },
    { id: "x-progetto", nome: "Lavoro su un progetto", minuti: 90, tipo: "produttivita" },
    { id: "x-chitarra", nome: "Chitarra", minuti: 30, tipo: "altro" },
  ],

  // ---------- Giornata: micro-eventi da trascinare (categoria: routine, integratori, pasti, riposo, movimento) ----------
  // quotidiana_id: se lo segni fatto, conta anche per quell'attività quotidiana
  micro: [
    { id: "mm-sveglia", nome: "Sveglia e bicchiere d'acqua", minuti: 5, categoria: "routine", note: "" },
    { id: "mm-denti", nome: "Lavare i denti", minuti: 2, categoria: "routine", note: "", quotidiana_id: "q-denti" },
    { id: "mm-doccia", nome: "Doccia", minuti: 25, categoria: "routine", note: "", quotidiana_id: "q-doccia" },
    { id: "mm-skincare", nome: "Skincare", minuti: 5, categoria: "routine", note: "", quotidiana_id: "q-skincare" },
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
  ],

  // ---------- Soldi: categorie delle uscite con un budget proposto (euro al mese) ----------
  categorieSpesa: [
    { nome: "Cibo", budget: 80 }, { nome: "Svago", budget: 50 }, { nome: "Trasporti", budget: 30 },
    { nome: "Scuola", budget: 20 }, { nome: "Abbonamenti", budget: 15 }, { nome: "Sport", budget: 30 },
    { nome: "Altro", budget: 20 },
  ],

  // ---------- Obiettivi a lungo termine: categorie ----------
  categorieObiettivi: [
    { id: "co-scuola", nome: "Scuola", colore: "#d1fe17" },
    { id: "co-salute", nome: "Salute e sport", colore: "#7dd3c0" },
    { id: "co-personale", nome: "Personale", colore: "#c3a6ff" },
    { id: "co-soldi", nome: "Soldi", colore: "#f4a261" },
    { id: "co-progetti", nome: "Lavoro e progetti", colore: "#8ab4f8" },
    { id: "co-relazioni", nome: "Amici e famiglia", colore: "#f28b82" },
  ],
};

// Categorie delle entrate (fisse)
const categorieEntrate = ["Paghetta", "Lavoretti", "Regali", "Altro"];

// Regole del Check-up mail di partenza (si cambiano nella sezione Mail)
const regoleMailIniziali = {
  mittenti: [],
  parole: ["scadenza", "pagamento", "esame", "midterm", "deadline", "verifica"],
};
