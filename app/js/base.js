// ===== base.js: strumenti usati da tutte le sezioni =====

// Ogni sezione (file in js/sezioni/) aggiunge qui la sua funzione che la disegna.
const Viste = {};

// Chi sta usando l'app: si riempie al login (accesso.js) con i dati del tuo account.
const utenteAttuale = { id: "", nome: "", email: "", avatar_url: null };

// ---------- Date e orari ----------
const GIORNI_BREVI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

const pad = (n) => String(n).padStart(2, "0");

// Data → "2026-11-05" (utile per confrontare i giorni)
function chiaveGiorno(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// "2026-11-05" → Data
function daChiave(k) {
  const [a, m, g] = k.split("-").map(Number);
  return new Date(a, m - 1, g);
}
const oggiChiave = () => chiaveGiorno(new Date());

function aggiungiGiorni(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// Il lunedì della settimana di una data
function inizioSettimana(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
// "08:30" → 510 minuti dalla mezzanotte
function minutiDa(ora) {
  const [h, m] = ora.split(":").map(Number);
  return h * 60 + m;
}
// Data → "2026-11-05T17:30:00+01:00" (il formato del database)
function isoLocale(d) {
  const off = -d.getTimezoneOffset();
  const segno = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${chiaveGiorno(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${segno}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
const oraDi = (d) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const dataLunga = (d) => d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
const dataBreve = (d) => d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
const nomeMese = (d) => d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// 95 → "1 h 35 min"
function durata(min) {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
const formatoEuro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const euro = (n) => formatoEuro.format(n);

const nuovoId = (prefisso) => `${prefisso}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- Stato: tutti i dati dell'app ----------
// Per ora si salvano nel browser (localStorage). Quando c'è Supabase, si salveranno lì.
const CHIAVE_SALVATAGGIO = "organizza-v2";

// Si parte da zero: niente dati di esempio. Le cose da cui partire le scegli
// nella configurazione guidata (js/configurazione.js), tra i suggerimenti di suggerimenti.js.
function statoIniziale() {
  return {
    eventi: [],
    quotidiane: [],             // { id, nome, minuti, volte_al_giorno, icona }
    modelliExtra: [],           // { id, nome, minuti, tipo }
    promemoria: [],             // { id, testo, scadenza, ora, fatto }
    movimenti: [],              // { id, tipo: "entrata" | "uscita", importo, categoria, descrizione, data }
    budget: { mensile: 0, categorie: {} },   // 0 = nessun budget
    registro: {},               // { "2026-11-05": { "q-denti": 2, ... } } quante volte fatta ogni attività
    acqua: {},                  // { "2026-11-05": 5 } bicchieri d'acqua
    pasti: {},                  // { "2026-11-05": { colazione: "latte e biscotti" } }
    regoleMail: structuredClone(regoleMailIniziali),
    materie: [],                // { id, nome, prof, aula, colore }
    orario: [],                 // { id, giorno, inizio, fine, materia_id } (serve solo senza il calendario H-Farm)
    listaSpesa: [],
    scontrini: [],              // { id, negozio, data, totale, movimento_id, foto_id }
    google: { clientId: "", collegato: false, ultimoSync: null },
    microModelli: [],           // { id, nome, minuti, categoria, note, quotidiana_id? }
    routineBase: [],            // { inizio: "07:00", modello_id }
    giornate: {},               // { "2026-11-05": [ { id, nome, inizio: "07:45", minuti, categoria, note, fatto } ] }
    obiettivi: {},              // { "2026-11-09": [ { id, testo, fatto } ] } obiettivi per settimana (chiave = lunedì)
    sonno: { sveglia: "07:00", dormire: "23:00", giorni: {} },   // orari predefiniti + eccezioni per giorno
    categorieObiettivi: [],     // { id, nome, colore }
    obiettiviLungo: [],
    // configurazione guidata: completata = già fatta; dal = giorno da cui contano Monitor e punteggi
    configurazione: { completata: false, dal: oggiChiave() },
  };
}

function caricaStato() {
  const base = statoIniziale();
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE_SALVATAGGIO));
    // se nel salvataggio manca qualcosa di nuovo, lo prendiamo dallo stato vuoto
    // salvataggio di una versione vecchia (senza "configurazione") = dati di esempio: si riparte
    // da zero, tenendo solo il Client ID di Google. Se hai l'account, i tuoi dati veri arrivano da Supabase.
    if (salvato && salvato.eventi && !salvato.configurazione) {
      if (salvato.google && salvato.google.clientId) base.google.clientId = salvato.google.clientId;
      return base;
    }
    if (salvato && salvato.eventi) {
      const s = { ...base, ...salvato };
      // dati salvati con versioni vecchie dell'app: aggiungiamo quello che manca
      for (const i of s.listaSpesa) if (!i.categoria) i.categoria = indovinaCategoria(i.nome);
      return s;
    }
  } catch (e) { /* niente salvataggio: si parte da zero */ }
  return base;
}

const stato = caricaStato();

// Salva nel browser (copia veloce, funziona anche senza internet)
// e, se hai fatto il login, manda le modifiche anche a Supabase (vedi sincronizza.js).
function salva() {
  try { localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(stato)); } catch (e) { /* il browser non salva: pazienza */ }
  if (typeof programmaInvio === "function") programmaInvio();
}

function ricominciaDaCapo() {
  try { localStorage.removeItem(CHIAVE_SALVATAGGIO); } catch (e) {}
  location.reload();
}

// ---------- Calcoli usati da più sezioni ----------
// Una lezione dell'orario + i dati della sua materia (nome, prof, aula, colore)
function conMateria(l) {
  const m = stato.materie.find((x) => x.id === l.materia_id) || { nome: "Materia eliminata", prof: "", aula: "", colore: "#66666e" };
  return { ...l, materia: m.nome, prof: m.prof, aula: m.aula, colore: m.colore };
}

// Se hai collegato il calendario di H-Farm, le lezioni arrivano da lì (e l'orario manuale non serve)
function calendariScuola() {
  return ((stato.google && stato.google.calendari) || []).filter((c) => c.scuola && c.attivo);
}
function usaCalendarioScuola() {
  const ids = new Set(calendariScuola().map((c) => c.id));
  return ids.size > 0 && stato.eventi.some((e) => ids.has(e.google_cal));
}

function lezioniDelGiorno(d) {
  if (usaCalendarioScuola()) return [];
  return stato.orario
    .filter((l) => l.giorno === d.getDay())
    .map(conMateria)
    .sort((a, b) => a.inizio.localeCompare(b.inizio));
}

// ---------- Eventi: salvare ed eliminare (anche su Google Calendar, se collegato) ----------
function salvaEvento(evento) {
  const i = stato.eventi.findIndex((e) => e.id === evento.id);
  if (i >= 0) stato.eventi[i] = evento;
  else stato.eventi.push(evento);
  salva();
  if (typeof inviaAGoogle === "function") inviaAGoogle(evento);
  if (typeof salvaEventoNelDatabase === "function") salvaEventoNelDatabase(evento);
}

function eliminaEvento(evento) {
  stato.eventi = stato.eventi.filter((e) => e.id !== evento.id);
  salva();
  if (typeof eliminaDaGoogle === "function") eliminaDaGoogle(evento);
  if (typeof eliminaEventoDalDatabase === "function") eliminaEventoDalDatabase(evento);
}

function nuovoEvento(dati) {
  return {
    id: nuovoId("e"), titolo: "", descrizione: "", tipo: "impegno",
    inizio: isoLocale(new Date()), fine: isoLocale(new Date(Date.now() + 3600000)), tutto_il_giorno: false,
    proprietario_id: utenteAttuale.id, gruppo_id: null, completato: false, creato_il: isoLocale(new Date()),
    ...dati,
  };
}

// ---------- Colori degli eventi ----------
// Gli stessi 11 colori di Google Calendar (l'id è quello che usa Google)
const COLORI_EVENTO = [
  { id: "1", nome: "Lavanda", hex: "#7986cb" }, { id: "2", nome: "Salvia", hex: "#33b679" },
  { id: "3", nome: "Uva", hex: "#8e24aa" }, { id: "4", nome: "Fenicottero", hex: "#e67c73" },
  { id: "5", nome: "Banana", hex: "#f6bf26" }, { id: "6", nome: "Mandarino", hex: "#f4511e" },
  { id: "7", nome: "Pavone", hex: "#039be5" }, { id: "8", nome: "Grafite", hex: "#616161" },
  { id: "9", nome: "Mirtillo", hex: "#3f51b5" }, { id: "10", nome: "Basilico", hex: "#0b8043" },
  { id: "11", nome: "Pomodoro", hex: "#d50000" },
];

const eScuola = (e) => e.tipo === "scuola";
const ePassato = (e) => new Date(e.fine) < new Date();

// Colore con cui disegnare un evento: prima quello scelto da te, poi la scuola resta gialla,
// poi il colore del suo calendario di Google; null = colore del tipo
function coloreEvento(e) {
  if (e.colore_scelto) return e.colore_scelto;
  if (eScuola(e)) return null;
  return e.colore || null;
}
// Classe CSS dell'evento (la scuola ha il giallo sfumato)
function classeEvento(e) {
  if (e.colore_scelto) return "ev-colorato";
  if (eScuola(e)) return "ev-scuola";
  return e.colore ? "ev-colorato" : `ev-${e.tipo}`;
}

// Le cose di scuola "speciali": esami, quiz, consegne
const eScadenza = (e) => /esame|exam|midterm|final|quiz|test|assignment|consegna|deadline|due\b|scadenza/i.test(e.titolo || "");

// A quale materia appartiene un evento (cercando il nome della materia nel titolo)
const PAROLE_GENERICHE = new Set(["principles", "business", "financial", "introduction", "lecture", "corso"]);
function materiaDi(titolo = "") {
  const t = titolo.toLowerCase();
  return stato.materie.find((m) => {
    if (t.includes(m.nome.toLowerCase())) return true;
    return m.nome.toLowerCase().split(/[^a-zà-ù]+/).some((p) => p.length >= 6 && !PAROLE_GENERICHE.has(p) && t.includes(p));
  }) || null;
}

// ---------- Lista della spesa: 4 gruppi ----------
const CATEGORIE_SPESA = {
  carboidrati: { nome: "Carboidrati", colore: "#f4a261" },
  proteine: { nome: "Proteine", colore: "#f28b82" },
  grassi: { nome: "Grassi", colore: "#d1fe17" },
  verdure: { nome: "Verdure e frutta", colore: "#7dd3c0" },
};
function indovinaCategoria(nome = "") {
  const n = nome.toLowerCase();
  if (/poll|tacchin|manzo|carne|pesce|tonno|salmon|merluzz|uov|yogurt|latte|formagg|ricott|mozzarell|skyr|legum|cec|lenticch|fagiol|tofu|prosciutt|bresaol|whey|protein|fesa|seitan|tempeh|albume/.test(n)) return "proteine";
  if (/olio|burro|avocad|noc|mandorl|nocciol|pistacch|anacard|semi|cioccolat|frutta secca|arachid/.test(n)) return "grassi";
  if (/insalat|zucchin|pomodor|carot|spinac|broccol|verdur|lattug|peperon|melanzan|cavol|fungh|cipoll|rucola|mel[ae]\b|frutt|banan|aranc|fragol|kiwi|pera|frutti di bosco|limon|cetriol|finocch|asparag/.test(n)) return "verdure";
  return "carboidrati";
}

// ---------- Testi delle descrizioni ----------
// Google salva le descrizioni con la formattazione (HTML): qui le trasformiamo in testo pulito.
// DOMParser legge l'HTML senza eseguire niente, quindi è sicuro.
function testoDaHtml(html) {
  if (!html) return "";
  if (!/<[a-z!\/]/i.test(html)) return html.trim();
  const conACapo = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    // un link <a href="x">testo</a> diventa "testo (x)" se testo e indirizzo sono diversi
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_, url, testo) => {
      const t = testo.replace(/<[^>]+>/g, "").trim();
      return !t || t === url ? url : `${t} (${url})`;
    });
  const doc = new DOMParser().parseFromString(conACapo, "text/html");
  return doc.body.textContent.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Testo → elementi, con gli indirizzi web trasformati in link cliccabili
function testoConLink(testo) {
  const frammento = document.createDocumentFragment();
  const pezzi = String(testo || "").split(/(https?:\/\/[^\s<>()"']+)/g);
  pezzi.forEach((p, i) => {
    if (i % 2 === 1) {
      const pulito = p.replace(/[.,;:!?]+$/, "");
      frammento.append(h("a", { href: pulito, target: "_blank", rel: "noopener noreferrer", class: "link" }, pulito.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)));
      if (pulito !== p) frammento.append(p.slice(pulito.length));
    } else if (p) frammento.append(p);
  });
  return frammento;
}

const primaRiga = (testo) => String(testo || "").split("\n").map((r) => r.trim()).find(Boolean) || "";

// ---------- Foto (scontrini): salvate nel browser con IndexedDB, che regge file grandi ----------
const Foto = {
  _db: null,
  apri() {
    if (!this._db) this._db = new Promise((ok, ko) => {
      const r = indexedDB.open("organizza-foto", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("foto");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    return this._db;
  },
  async _azione(modo, fn) {
    const db = await this.apri();
    return new Promise((ok, ko) => {
      const t = db.transaction("foto", modo);
      const r = fn(t.objectStore("foto"));
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => ko(t.error);
    });
  },
  salva(id, dataUrl) { return this._azione("readwrite", (s) => s.put(dataUrl, id)); },
  leggi(id) { return this._azione("readonly", (s) => s.get(id)); },
  elimina(id) { return this._azione("readwrite", (s) => s.delete(id)); },
};

// Rimpicciolisce una foto (così occupa poco spazio) e la restituisce come testo "data:image/jpeg…"
function rimpicciolisciFoto(file, lato = 1400) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => {
      const scala = Math.min(1, lato / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scala);
      c.height = Math.round(img.height * scala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => ko(new Error("Non riesco ad aprire la foto"));
    img.src = URL.createObjectURL(file);
  });
}

function eventiDelGiorno(d) {
  const k = chiaveGiorno(d);
  return stato.eventi
    .filter((e) => chiaveGiorno(new Date(e.inizio)) === k)
    .sort((a, b) => a.inizio.localeCompare(b.inizio));
}

const minutiEvento = (e) => (new Date(e.fine) - new Date(e.inizio)) / 60000;

// La prossima lezione dopo "adesso" (cerca nei prossimi 8 giorni):
// dal calendario di H-Farm se è collegato, altrimenti dall'orario manuale
function prossimaLezione(adesso = new Date()) {
  const ids = new Set(calendariScuola().map((c) => c.id));
  const daHFarm = usaCalendarioScuola();
  for (let i = 0; i < 8; i++) {
    const d = aggiungiGiorni(adesso, i);
    const candidati = [];
    for (const l of lezioniDelGiorno(d)) {
      const [h, m] = l.inizio.split(":").map(Number), [hf, mf] = l.fine.split(":").map(Number);
      candidati.push({ ...l, data: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m), dataFine: new Date(d.getFullYear(), d.getMonth(), d.getDate(), hf, mf) });
    }
    if (daHFarm) {
      for (const e of eventiDelGiorno(d)) {
        if (!ids.has(e.google_cal) || e.tutto_il_giorno || eScadenza(e)) continue;
        const inizio = new Date(e.inizio), fine = new Date(e.fine);
        const materia = materiaDi(e.titolo);
        candidati.push({ materia: materia ? materia.nome : e.titolo, aula: e.luogo || "", prof: "", inizio: oraDi(inizio), fine: oraDi(fine), data: inizio, dataFine: fine });
      }
    }
    const prossima = candidati.sort((a, b) => a.data - b.data).find((c) => c.dataFine > adesso);
    if (prossima) return { ...prossima, inCorso: prossima.data <= adesso };
  }
  return null;
}

const minutiQuotidiane = () => stato.quotidiane.reduce((s, a) => s + a.minuti * a.volte_al_giorno, 0);

// Quante attività quotidiane sono state fatte in un giorno (da 0 a 1)
function quotaQuotidiane(k) {
  const reg = stato.registro[k] || {};
  let fatte = 0, totali = 0;
  for (const a of stato.quotidiane) {
    totali += a.volte_al_giorno;
    fatte += Math.min(reg[a.id] || 0, a.volte_al_giorno);
  }
  return { fatte, totali, quota: totali ? fatte / totali : 0 };
}

const usciteDelGiorno = (k) =>
  stato.movimenti.filter((m) => m.tipo === "uscita" && m.data === k).reduce((s, m) => s + m.importo, 0);

const giorniNelMese = (anno, mese) => new Date(anno, mese + 1, 0).getDate();
// Categorie delle uscite: quelle del tuo budget (o, se non l'hai ancora fatto, alcune di base)
const categorieUscite = () => {
  const c = Object.keys(stato.budget.categorie);
  return c.length ? c : ["Cibo", "Svago", "Trasporti", "Scuola", "Altro"];
};

// Budget di un giorno. Senza budget (0) non c'è limite: Infinity.
const budgetGiornaliero = (d) => stato.budget.mensile > 0 ? stato.budget.mensile / giorniNelMese(d.getFullYear(), d.getMonth()) : Infinity;

function movimentiDelMese(anno, mese) {
  const prefisso = `${anno}-${pad(mese + 1)}`;
  return stato.movimenti.filter((m) => m.data.startsWith(prefisso));
}

function totaliMese(anno, mese) {
  const lista = movimentiDelMese(anno, mese);
  const entrate = lista.filter((m) => m.tipo === "entrata").reduce((s, m) => s + m.importo, 0);
  const uscite = lista.filter((m) => m.tipo === "uscita").reduce((s, m) => s + m.importo, 0);
  return { entrate, uscite, saldo: entrate - uscite, lista };
}

// Regola della routine: un giorno è "rispettato" se fai almeno il 75% delle
// attività quotidiane E non superi il budget giornaliero.
const SOGLIA_ROUTINE = 0.75;

function punteggioMese(anno, mese) {
  const oggiK = oggiChiave();
  const giorni = [];
  let rispettati = 0, contati = 0, serie = 0, serieMax = 0;

  for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
    const d = new Date(anno, mese, g);
    const k = chiaveGiorno(d);
    // i giorni prima che iniziassi a usare l'app non contano (né in bene né in male)
    const dal = (stato.configurazione && stato.configurazione.dal) || "";
    const futuro = k > oggiK || k < dal;
    const oggi = k === oggiK;
    const q = quotaQuotidiane(k);
    const uscite = usciteDelGiorno(k);
    const limite = budgetGiornaliero(d);
    const rispettato = !futuro && q.quota >= SOGLIA_ROUTINE && uscite <= limite;

    if (rispettato) { rispettati++; contati++; serie++; serieMax = Math.max(serieMax, serie); }
    else if (!futuro && !oggi) { contati++; serie = 0; }   // oggi non ti penalizza: la giornata non è finita

    giorni.push({ d, k, futuro, oggi, rispettato, quota: q.quota, uscite, limite });
  }
  const punteggio = contati ? Math.round((rispettati / contati) * 100) : 0;
  return { giorni, rispettati, contati, punteggio, serie, serieMax };
}

// ---------- Costruire l'HTML da JavaScript ----------
// h("div", { class: "card" }, "testo", altroElemento) crea <div class="card">testo…</div>
function h(tag, props, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const f of figli.flat()) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : String(f));
  }
  return el;
}

// Un riquadro della dashboard, con titolo e (opzionale) qualcosa a destra
function pannello(classe, titolo, destra, ...contenuto) {
  return h("section", { class: `pannello ${classe || ""}` },
    titolo && h("div", { class: "pannello-testa" }, h("h3", {}, titolo), destra && h("div", { class: "pannello-azioni" }, destra)),
    ...contenuto);
}

// Un campo di un modulo: etichetta + input
const campo = (etichetta, input) => h("label", { class: "campo" }, h("span", {}, etichetta), input);

// ---------- Icone (disegni SVG semplici) ----------
const ICONE = {
  home: '<path d="M3 11l9-7 9 7v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/>',
  scuola: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3.5 2.5 8.5 2.5 12 0v-5"/><path d="M22 9v5"/>',
  sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  stella: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  portafoglio: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M7 6l9-3 1 3"/><circle cx="16.5" cy="15" r="1.2"/>',
  griglia: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>',
  piu: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sinistra: '<path d="M15 5l-7 7 7 7"/>',
  destra: '<path d="M9 5l7 7-7 7"/>',
  freccia: '<path d="M7 17L17 7M9 7h8v8"/>',
  cestino: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  orologio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  scintilla: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  ingranaggio: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  dente: '<path d="M7.5 3C5 3 3.5 5 3.5 7.5c0 2.2.8 3.8 1.5 5.8.8 2.5 1 7.7 3 7.7 1.7 0 1.6-4.5 4-4.5s2.3 4.5 4 4.5c2 0 2.2-5.2 3-7.7.7-2 1.5-3.6 1.5-5.8C20.5 5 19 3 16.5 3c-2 0-2.8 1-4.5 1s-2.5-1-4.5-1z"/>',
  goccia: '<path d="M12 3s6.5 6.6 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3z"/>',
  zaino: '<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7M9 13h6"/>',
  bicchiere: '<path d="M6 3h12l-1.5 17a1.5 1.5 0 0 1-1.5 1.4H9a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M6.6 9h10.8"/>',
  mela: '<path d="M12 7c-1.5-1-5-1.5-6.5 1.5S5 16 7 19s3.5 2 5 1.3c1.5.7 3 1.7 5-1.3s3-7.5 1.5-10.5S13.5 6 12 7z"/><path d="M12 7c0-2 1-3.5 3-4"/>',
  peso: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  frecciaSu: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  frecciaGiu: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  lucchetto: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  matita: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  carrello: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.6"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  fotocamera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  scontrino: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  google: '<path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5z"/><path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.5c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z"/><path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V8H4a9 9 0 0 0 0 8z"/><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  luna: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  bandiera: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  persone: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
};

function icona(nome, misura = 20) {
  const s = h("span", { class: "icona", "aria-hidden": "true" });
  s.innerHTML = `<svg width="${misura}" height="${misura}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONE[nome] || ""}</svg>`;
  return s;
}

// Colore di ogni tipo di evento (definiti in style.css)
const ETICHETTE_TIPO = { scuola: "Scuola", produttivita: "Produttività", allenamento: "Allenamento", impegno: "Impegno", altro: "Altro" };

// ---------- Grafico ad area (usato in Dashboard e Spese) ----------
// punti: [{ etichetta: "1", valore: 12.5 }, ...]
function graficoArea(punti, { formato = (v) => v, altezza = 220 } = {}) {
  const box = h("div", { class: "grafico", style: `height:${altezza}px` });
  if (punti.length < 2) {
    box.append(h("p", { class: "vuoto" }, "Servono almeno due giorni di dati per il grafico."));
    return box;
  }
  const valori = punti.map((p) => p.valore);
  let min = Math.min(0, ...valori), max = Math.max(...valori);
  if (max === min) max = min + 1;
  const margine = (max - min) * 0.12;
  min -= min < 0 ? margine : 0;
  max += margine;

  const x = (i) => (i / (punti.length - 1)) * 100;
  const y = (v) => 100 - ((v - min) / (max - min)) * 100;
  const linea = punti.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.valore).toFixed(2)}`).join(" ");

  const svg = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="grafico-svg">
      <defs><linearGradient id="riempimento" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accento)" stop-opacity="0.35"/>
        <stop offset="1" stop-color="var(--accento)" stop-opacity="0"/></linearGradient></defs>
      <path d="${linea} L100,100 L0,100 Z" fill="url(#riempimento)"/>
      <path d="${linea}" fill="none" stroke="var(--accento)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    </svg>`;
  const area = h("div", { class: "grafico-area" });
  area.innerHTML = svg;

  // righe orizzontali con i valori
  for (let i = 0; i <= 3; i++) {
    const v = min + ((max - min) * i) / 3;
    area.append(h("div", { class: "grafico-riga", style: `top:${y(v)}%` }, h("span", {}, formato(v))));
  }
  // pallino sull'ultimo valore, con etichetta
  const ultimo = punti[punti.length - 1];
  area.append(h("div", { class: "grafico-punto", style: `left:${x(punti.length - 1)}%;top:${y(ultimo.valore)}%` }));
  // se il punto è in alto, il fumetto va sotto (così non copre il titolo)
  area.append(h("div", { class: `grafico-fumetto${y(ultimo.valore) < 35 ? " sotto" : ""}`, style: `left:${x(punti.length - 1)}%;top:${y(ultimo.valore)}%` },
    h("small", {}, ultimo.etichettaLunga || ultimo.etichetta), h("strong", {}, formato(ultimo.valore))));

  // etichette sotto (ne mostriamo al massimo 8)
  const passo = Math.ceil(punti.length / 8);
  const asse = h("div", { class: "grafico-asse" },
    punti.map((p, i) => (i % passo === 0 || i === punti.length - 1)
      ? h("span", { style: `left:${x(i)}%` }, p.etichetta) : null));

  box.append(area, asse);
  return box;
}

// Saldo che cresce/scende giorno per giorno in un mese
function puntiSaldoMese(anno, mese) {
  const oggiK = oggiChiave();
  const punti = [];
  let saldo = 0;
  for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
    const d = new Date(anno, mese, g);
    const k = chiaveGiorno(d);
    if (k > oggiK) break;
    for (const m of stato.movimenti) if (m.data === k) saldo += m.tipo === "entrata" ? m.importo : -m.importo;
    punti.push({ etichetta: String(g), etichettaLunga: dataBreve(d), valore: Math.round(saldo * 100) / 100 });
  }
  return punti;
}

// Anello di avanzamento (es. 75%)
function anello(quota, testo, misura = 96) {
  const r = 42, c = 2 * Math.PI * r;
  const box = h("div", { class: "anello", style: `width:${misura}px;height:${misura}px` });
  box.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" class="anello-fondo"/>
    <circle cx="50" cy="50" r="${r}" class="anello-valore" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, quota))}"/></svg>`;
  box.append(h("span", { class: "anello-testo" }, testo));
  return box;
}

// ---------- Le 4 aree della giornata: lezioni, produttività, extra, routine ----------
const AREE_GIORNATA = {
  lezioni: { nome: "Lezioni", colore: "#d1fe17" },
  produttivita: { nome: "Produttività", colore: "#8ab4f8" },
  extra: { nome: "Extra", colore: "#7dd3c0" },
  routine: { nome: "Routine", colore: "#c3a6ff" },
};
function areaEvento(e) {
  if (eScuola(e)) return "lezioni";
  if (e.tipo === "produttivita") return "produttivita";
  return "extra";
}
// Minuti di ogni area in un giorno. La routine viene dalla pagina Giornata (se l'hai organizzata),
// altrimenti dalle attività quotidiane.
function minutiPerArea(d) {
  const k = chiaveGiorno(d);
  const r = { lezioni: 0, produttivita: 0, extra: 0, routine: 0 };
  for (const l of lezioniDelGiorno(d)) r.lezioni += minutiDa(l.fine) - minutiDa(l.inizio);
  for (const e of eventiDelGiorno(d)) if (!e.tutto_il_giorno) r[areaEvento(e)] += minutiEvento(e);
  const micro = stato.giornate && stato.giornate[k];
  r.routine = micro && micro.length ? micro.reduce((s, m) => s + m.minuti, 0) : minutiQuotidiane();
  return r;
}

// Il primo spazio libero di un giorno per un'attività lunga "minuti" (prima dal pomeriggio, poi la mattina)
function primoSpazioLibero(d, minuti) {
  const k = chiaveGiorno(d);
  const occupati = [
    ...lezioniDelGiorno(d).map((l) => [minutiDa(l.inizio), minutiDa(l.fine)]),
    ...eventiDelGiorno(d).filter((e) => !e.tutto_il_giorno).map((e) => {
      const a = new Date(e.inizio), b = new Date(e.fine);
      return [a.getHours() * 60 + a.getMinutes(), chiaveGiorno(b) === k ? b.getHours() * 60 + b.getMinutes() : 24 * 60];
    }),
  ];
  const libero = (t) => !occupati.some(([i, f]) => t < f && t + minuti > i);
  for (let t = 15 * 60; t + minuti <= 22 * 60; t += 15) if (libero(t)) return t;
  for (let t = 8 * 60; t + minuti <= 15 * 60; t += 15) if (libero(t)) return t;
  return 17 * 60;
}

// ---------- Sonno: a che ora ti svegli e vai a dormire ----------
// Ogni giorno usa gli orari predefiniti, a meno che tu non li abbia cambiati per quel giorno.
function orariSonno(d) {
  const eccezione = stato.sonno.giorni[chiaveGiorno(d)] || {};
  return { sveglia: eccezione.sveglia || stato.sonno.sveglia, dormire: eccezione.dormire || stato.sonno.dormire };
}
// Minuti in cui sei sveglio (se vai a dormire dopo mezzanotte, es. 00:30, conta lo stesso)
function minutiSveglio(d) {
  const { sveglia, dormire } = orariSonno(d);
  let m = minutiDa(dormire) - minutiDa(sveglia);
  if (m <= 0) m += 24 * 60;
  return m;
}
// Ore di sonno della notte dopo il giorno d (da quando vai a dormire a quando ti svegli il giorno dopo)
function minutiSonnoNotte(d) {
  const dormire = minutiDa(orariSonno(d).dormire);
  const sveglia = minutiDa(orariSonno(aggiungiGiorni(d, 1)).sveglia);
  let m = sveglia + 24 * 60 - dormire;
  if (m > 24 * 60) m -= 24 * 60;
  return m;
}
