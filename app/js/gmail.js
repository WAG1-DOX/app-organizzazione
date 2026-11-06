// ===== gmail.js: il "cervello" del Check-up mail (gratis: Gmail API + regole, niente AI) =====
//
// Cosa fa:
// 1. SMISTA la posta in arrivo in 3 gruppi: Importanti / Da leggere / Rumore.
//    Usa: le etichette che Gmail mette già da solo (Importante, Promozioni, Social…), chi conosci
//    (le persone a cui hai scritto tu), le tue regole (mittenti, parole) e i segnali di "posta di massa"
//    (newsletter, no-reply). Ogni mail dice PERCHÉ è finita lì.
// 2. SCADENZE: legge il testo delle mail che contano e trova date tipo "entro il 15 novembre alle 23:59",
//    "deadline 20/11", "esame lunedì". Un tocco → promemoria (che va anche su Google Calendar).
// 3. NEWSLETTER: chi ti scrive di più nelle ultime 4 settimane e quante ne apri davvero.
//    Disiscriviti (link ufficiale della mail), Archivia tutte, Silenzia (le prossime si archiviano da sole).
// 4. RICEVUTE: trova le mail d'ordine/ricevuta con l'importo e le collega al movimento della banca.
// 5. Riepilogo in Home.
//
// Permesso: "gmail.modify" = leggere, segnare come letta, archiviare. NON può cancellare per sempre
// né mandare mail. Il permesso lo tiene la funzione "google" (come per il calendario).
// Le mail NON vanno su Supabase: restano solo in questo browser (cache in localStorage).
// Su Supabase vanno solo le tue regole (chiave "regole_mail").

const SCOPE_GMAIL = "https://www.googleapis.com/auth/gmail.modify";
const API_GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CHIAVE_POSTA = "organizza-posta";
const GIORNI_INBOX = 21;          // quanto indietro guardiamo nella posta in arrivo
const MAX_INBOX = 200;
const OGNI_QUANTO_POSTA = 5 * 60 * 1000;
const VERSIONE_ANALISI = 2;       // se cambia, le mail si rianalizzano

const Posta = {
  stato: "spento",   // spento | manca-permesso | api-spenta | carico | pronto | errore
  errore: "",
  email: null,
  mail: [],          // [{ id, thread, da, email, oggetto, anteprima, data, etichette, massa, ... }]
  analisi: {},       // id → { v, scadenze: [], ricevuta }
  contatti: [],      // indirizzi a cui hai scritto tu
  contattiDel: 0,
  newsletter: null,  // { del, mittenti: [...] }
  ricevute: [],      // id delle mail-ricevuta
  ultimo: 0,
  tentato: 0,
  inCorso: false,
  annulla: null,     // { testo, ids, aggiungi, scade }
  filtro: "importanti",
  cerca: "",
  timer: null,
};

// ---------- Regole (salvate su Supabase in "regole_mail") ----------
function regole() {
  const r = stato.regoleMail || (stato.regoleMail = structuredClone(regoleMailIniziali));
  for (const k of ["mittenti", "parole", "silenziati", "mai", "scadenzeViste"]) if (!Array.isArray(r[k])) r[k] = [];
  return r;
}
const minuscolo = (s) => String(s || "").toLowerCase();

// ---------- Cache nel browser (solo di questo account) ----------
function salvaPosta() {
  try {
    localStorage.setItem(CHIAVE_POSTA, JSON.stringify({
      utente: utenteAttuale.id, email: Posta.email, mail: Posta.mail, analisi: Posta.analisi,
      contatti: Posta.contatti, contattiDel: Posta.contattiDel, newsletter: Posta.newsletter,
      ricevute: Posta.ricevute, ultimo: Posta.ultimo,
    }));
  } catch (e) { /* spazio pieno: pazienza, si riscarica */ }
}
function caricaPosta() {
  try {
    const c = JSON.parse(localStorage.getItem(CHIAVE_POSTA) || "null");
    if (!c || c.utente !== utenteAttuale.id) return;
    Object.assign(Posta, {
      email: c.email, mail: c.mail || [], analisi: c.analisi || {}, contatti: c.contatti || [],
      contattiDel: c.contattiDel || 0, newsletter: c.newsletter || null, ricevute: c.ricevute || [], ultimo: c.ultimo || 0,
    });
  } catch (e) { /* cache rovinata: si riscarica */ }
}
function svuotaPosta() {
  try { localStorage.removeItem(CHIAVE_POSTA); } catch (e) {}
  Object.assign(Posta, { mail: [], analisi: {}, contatti: [], contattiDel: 0, newsletter: null, ricevute: [], ultimo: 0, email: null });
}

// ---------- Parlare con Gmail ----------
class ErroreGmail extends Error {
  constructor(messaggio, tipo) { super(messaggio); this.tipo = tipo; }
}

async function gmail(metodo, percorso, corpo, tentativo = 0) {
  if (typeof googleDalServer !== "function" || !googleDalServer()) throw new ErroreGmail("Google non è configurato sul server.", "spento");
  await assicuraToken();
  const r = await fetch(`${API_GMAIL}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${Google.token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 401 && tentativo < 1) { Google.token = null; return gmail(metodo, percorso, corpo, tentativo + 1); }
  if ((r.status === 429 || r.status >= 500) && tentativo < 3) {
    await new Promise((ok) => setTimeout(ok, 800 * 2 ** tentativo + Math.random() * 300));
    return gmail(metodo, percorso, corpo, tentativo + 1);
  }
  if (r.status === 403 || r.status === 401) {
    let motivo = "";
    try { const e = await r.json(); motivo = JSON.stringify(e.error || e); } catch (e) {}
    if (/SERVICE_DISABLED|accessNotConfigured|has not been used|is disabled/i.test(motivo)) {
      throw new ErroreGmail("Le API di Gmail non sono attive nel progetto Google.", "api-spenta");
    }
    throw new ErroreGmail("Manca il permesso per Gmail.", "manca-permesso");
  }
  if (!r.ok) throw new ErroreGmail(`Gmail ha risposto con un errore (${r.status})`, "errore");
  return r.status === 204 ? null : r.json().catch(() => null);
}

// Esegue fn su tutti gli elementi, n alla volta (Gmail non vuole troppe richieste insieme)
async function aPiccoliGruppi(lista, n, fn) {
  const risultati = new Array(lista.length);
  let i = 0;
  const lavoratore = async () => {
    while (i < lista.length) {
      const mio = i++;
      try { risultati[mio] = await fn(lista[mio]); } catch (e) {
        if (e instanceof ErroreGmail && e.tipo !== "errore") throw e;   // permesso / API: inutile continuare
        risultati[mio] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, lavoratore));
  return risultati;
}

// Elenco degli id per una ricerca Gmail (fino a "max")
async function idDaRicerca(q, max) {
  const ids = [];
  let pagina = null;
  do {
    const p = new URLSearchParams({ q, maxResults: String(Math.min(500, max - ids.length)) });
    if (pagina) p.set("pageToken", pagina);
    const r = await gmail("GET", `/messages?${p}`);
    for (const m of (r && r.messages) || []) ids.push(m.id);
    pagina = r && r.nextPageToken;
  } while (pagina && ids.length < max);
  return ids;
}

const INTESTAZIONI = ["From", "To", "Cc", "Subject", "Date", "List-Unsubscribe", "List-Unsubscribe-Post", "List-Id", "Precedence", "Auto-Submitted", "Reply-To"];
async function leggiIntestazioni(id, quali = INTESTAZIONI) {
  const p = new URLSearchParams({ format: "metadata" });
  for (const q of quali) p.append("metadataHeaders", q);
  return gmail("GET", `/messages/${id}?${p}`);
}
const intestazione = (m, nome) => ((m.payload && m.payload.headers) || []).find((x) => x.name.toLowerCase() === nome.toLowerCase())?.value || "";

// "Mario Rossi <mario@x.it>" → { nome, email }
function leggiIndirizzo(testo) {
  const t = String(testo || "").trim();
  const m = t.match(/^(.*?)<([^>]+)>\s*$/);
  if (m) return { nome: m[1].trim().replace(/^"|"$/g, "").trim() || m[2].trim(), email: minuscolo(m[2].trim()) };
  return { nome: t, email: minuscolo(t) };
}
const indirizziDi = (testo) => String(testo || "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(leggiIndirizzo).map((x) => x.email).filter((e) => e.includes("@"));
const dominioDi = (email) => (email.split("@")[1] || "");

// Da un messaggio di Gmail alla nostra mail "leggera" (niente corpo)
function mailDaGmail(g) {
  const da = leggiIndirizzo(intestazione(g, "From"));
  const disiscrivi = intestazione(g, "List-Unsubscribe");
  return {
    id: g.id, thread: g.threadId,
    da: da.nome, email: da.email,
    a: indirizziDi(`${intestazione(g, "To")},${intestazione(g, "Cc")}`),
    oggetto: (intestazione(g, "Subject") || "(senza oggetto)").trim(),
    anteprima: testoDaHtml(g.snippet || ""),
    data: Number(g.internalDate) || Date.parse(intestazione(g, "Date")) || Date.now(),
    etichette: g.labelIds || [],
    disiscrivi: disiscrivi || null,
    unClick: /one-click/i.test(intestazione(g, "List-Unsubscribe-Post")),
    massa: !!(disiscrivi || intestazione(g, "List-Id") || /bulk|list|junk/i.test(intestazione(g, "Precedence"))),
    automatica: /auto-(generated|replied)/i.test(intestazione(g, "Auto-Submitted"))
      || /(^|[._-])(no-?reply|do-?not-?reply|noreply|notifications?|notify|mailer(-daemon)?|bounce[s]?|alert[s]?|newsletter|news|marketing|promo(tions)?)([._+-]|@)/i.test(da.email),
  };
}

// ---------- Collegare Gmail ----------
async function collegaGmail() {
  Posta.stato = "carico"; Posta.errore = "";
  ridisegnaFermo();
  try {
    if (!googleDalServer()) await caricaConfigGoogle();
    if (!googleDalServer()) throw new ErroreGmail("Il collegamento Google sul server non è pronto.", "errore");
    await collegaDalServer(SCOPE_GMAIL);
    stato.google.collegato = true;
    salva();
    if (Google.stato !== "attivo") collegaGoogle(true);   // riparte anche il calendario
    await aggiornaPosta(true);
  } catch (e) {
    Posta.stato = e.tipo || "errore";
    Posta.errore = e.message;
    ridisegnaFermo();
  }
}

// ---------- Leggere la posta ----------
async function aggiornaPosta(forza = false) {
  if (Posta.inCorso) return;
  // senza "forza": al massimo un tentativo al minuto (e uno ogni 2 minuti se è andato bene)
  if (!forza && (Date.now() - Posta.tentato < 60 * 1000 || (Date.now() - Posta.ultimo < 2 * 60 * 1000 && Posta.mail.length))) return;
  Posta.tentato = Date.now();
  if (typeof googleDalServer !== "function") return;
  if (!Google.server) await caricaConfigGoogle();
  if (!collegatoSulServer()) {
    const prima = Posta.stato;
    Posta.stato = Google.server && Google.server.client_id ? "manca-permesso" : "spento";
    if (prima !== Posta.stato) ridisegnaSeVisibile();
    return;
  }
  Posta.inCorso = true;
  if (!Posta.mail.length) { Posta.stato = "carico"; ridisegnaSeVisibile(); }
  try {
    const profilo = await gmail("GET", "/profile");
    if (Posta.email && Posta.email !== minuscolo(profilo.emailAddress)) svuotaPosta();   // altro account
    Posta.email = minuscolo(profilo.emailAddress);

    await aggiornaContatti();

    // posta in arrivo: id e non lette (2 richieste leggere), intestazioni solo delle mail nuove
    const [idInbox, idNonLette] = await Promise.all([
      idDaRicerca(`in:inbox newer_than:${GIORNI_INBOX}d`, MAX_INBOX),
      idDaRicerca(`in:inbox is:unread newer_than:${GIORNI_INBOX}d`, MAX_INBOX),
    ]);
    const note = new Map(Posta.mail.map((m) => [m.id, m]));
    const nuove = idInbox.filter((id) => !note.has(id));
    const lette = await aPiccoliGruppi(nuove, 8, leggiIntestazioni);
    for (const g of lette) if (g) note.set(g.id, mailDaGmail(g));
    const nonLette = new Set(idNonLette);
    Posta.mail = idInbox.map((id) => note.get(id)).filter(Boolean).map((m) => {
      const e = new Set(m.etichette.filter((x) => x !== "UNREAD"));
      if (nonLette.has(m.id)) e.add("UNREAD");
      e.add("INBOX");
      return { ...m, etichette: [...e] };
    });

    // mittenti silenziati: le mail nuove vanno in archivio da sole
    const daSilenziare = Posta.mail.filter((m) => eSilenziato(m));
    if (daSilenziare.length) {
      await archivia(daSilenziare.map((m) => m.id), { segnaLette: true, silenzioso: true });
    }

    // corpo delle mail che contano → scadenze (una volta sola per mail)
    const daAnalizzare = Posta.mail
      .filter((m) => smista(m).gruppo !== "rumore" && (!Posta.analisi[m.id] || Posta.analisi[m.id].v !== VERSIONE_ANALISI))
      .slice(0, 40);
    await aPiccoliGruppi(daAnalizzare, 5, analizzaCorpo);

    await cercaRicevute();

    Posta.ultimo = Date.now();
    Posta.stato = "pronto"; Posta.errore = "";
    pulisciCache();
    salvaPosta();
  } catch (e) {
    Posta.stato = e.tipo || "errore";
    Posta.errore = e.message;
    if (Posta.mail.length && e.tipo === "errore") Posta.stato = "pronto";   // teniamo quelle già lette
  } finally {
    Posta.inCorso = false;
    ridisegnaSeVisibile();
  }
}

function ridisegnaSeVisibile() {
  const id = typeof sezioneAttuale === "function" ? sezioneAttuale().id : "";
  if ((id === "mail" || id === "home") && !document.querySelector("#modale.aperta")) ridisegnaFermo();
}

// le analisi delle mail che non ci sono più si buttano (la cache resta piccola)
function pulisciCache() {
  const tieni = new Set([...Posta.mail.map((m) => m.id), ...Posta.ricevute]);
  for (const id of Object.keys(Posta.analisi)) if (!tieni.has(id)) delete Posta.analisi[id];
}

// Le persone a cui hai scritto (ultimo anno): segnale fortissimo di "persona vera che conosci"
async function aggiornaContatti() {
  if (Posta.contatti.length && Date.now() - Posta.contattiDel < 24 * 3600 * 1000) return;
  const ids = await idDaRicerca("in:sent newer_than:365d", 250);
  const lette = await aPiccoliGruppi(ids, 8, (id) => leggiIntestazioni(id, ["To", "Cc"]));
  const tutti = new Set();
  for (const g of lette) if (g) for (const e of indirizziDi(`${intestazione(g, "To")},${intestazione(g, "Cc")}`)) tutti.add(e);
  if (Posta.email) tutti.delete(Posta.email);
  Posta.contatti = [...tutti];
  Posta.contattiDel = Date.now();
}

// ---------- Smistare: Importanti / Da leggere / Rumore ----------
const SCUOLA_MAIL = /h-?farm|instructure|canvas|unive?r?s|\.edu\b|college/i;

function corrisponde(m, voce) {
  const v = minuscolo(voce).trim();
  if (!v) return false;
  if (v.includes("@")) return m.email === v;
  if (v.startsWith("@") || v.includes(".")) return m.email.endsWith(v.replace(/^@/, "")) || dominioDi(m.email).includes(v.replace(/^@/, ""));
  return m.email.includes(v) || minuscolo(m.da).includes(v);
}
const eSilenziato = (m) => regole().silenziati.some((v) => corrisponde(m, v));

const cacheSmista = new Map();
function smista(m) {
  const chiave = `${m.id}|${m.etichette.join(",")}|${JSON.stringify(regole().mittenti)}|${JSON.stringify(regole().parole)}|${regole().mai.length}|${regole().silenziati.length}|${Posta.contatti.length}|${Posta.analisi[m.id] ? 1 : 0}`;
  const c = cacheSmista.get(m.id);
  if (c && c.chiave === chiave) return c.r;
  const r = calcolaSmista(m);
  cacheSmista.set(m.id, { chiave, r });
  return r;
}

function calcolaSmista(m) {
  const R = regole();
  const e = new Set(m.etichette);
  const motivi = [];
  let punti = 0;
  const conosciuto = Posta.contatti.includes(m.email);
  const oggetto = minuscolo(m.oggetto), anteprima = minuscolo(m.anteprima);

  if (eSilenziato(m)) return { gruppo: "rumore", punti: -10, motivi: [{ t: "Silenziato da te", tono: "neutro" }] };

  const mittente = R.mittenti.find((v) => corrisponde(m, v));
  if (mittente) { punti += 6; motivi.push({ t: `Mittente importante «${mittente}»`, tono: "forte" }); }
  if (e.has("STARRED")) { punti += 5; motivi.push({ t: "Speciale ★", tono: "forte" }); }
  if (conosciuto && !m.massa) { punti += 4; motivi.push({ t: "Persona a cui hai scritto", tono: "forte" }); }
  const parolaOgg = R.parole.find((p) => oggetto.includes(minuscolo(p)));
  const parolaAnt = !parolaOgg && R.parole.find((p) => anteprima.includes(minuscolo(p)));
  if (parolaOgg) { punti += 3; motivi.push({ t: `«${parolaOgg}» nell'oggetto`, tono: "forte" }); }
  else if (parolaAnt) { punti += 2; motivi.push({ t: `parola «${parolaAnt}»`, tono: "medio" }); }
  const scadenze = scadenzeDi(m).filter((s) => s.data >= oggiChiave());
  if (scadenze.length) {
    const vicina = scadenze[0].data <= chiaveGiorno(aggiungiGiorni(new Date(), 14));
    punti += vicina ? 3 : 1;
    motivi.push({ t: `Scadenza ${dataBreve(daChiave(scadenze[0].data))}`, tono: "forte" });
  }
  if (SCUOLA_MAIL.test(m.email) || SCUOLA_MAIL.test(m.da)) { punti += 3; motivi.push({ t: "Scuola", tono: "medio" }); }
  if (e.has("IMPORTANT")) { punti += 2; motivi.push({ t: "Gmail la ritiene importante", tono: "medio" }); }
  if (e.has("CATEGORY_PERSONAL") && !m.massa && !m.automatica) { punti += 2; motivi.push({ t: "Scritta da una persona", tono: "medio" }); }
  if (Posta.email && m.a.includes(Posta.email) && m.a.length <= 3 && !m.massa) punti += 1;

  if (m.massa) { punti -= 3; motivi.push({ t: "Newsletter / posta di massa", tono: "debole" }); }
  if (m.automatica) { punti -= 2; motivi.push({ t: "Automatica (no-reply)", tono: "debole" }); }
  if (e.has("CATEGORY_PROMOTIONS")) { punti -= 4; motivi.push({ t: "Promozione", tono: "debole" }); }
  if (e.has("CATEGORY_SOCIAL")) { punti -= 3; motivi.push({ t: "Social", tono: "debole" }); }
  if (e.has("CATEGORY_FORUMS")) { punti -= 2; motivi.push({ t: "Gruppi / forum", tono: "debole" }); }
  if (e.has("CATEGORY_UPDATES")) punti -= 1;
  if (e.has("SPAM")) punti -= 20;

  // "Mai importante": la decidi tu, vince su tutto (tranne la stella)
  if (R.mai.some((v) => corrisponde(m, v)) && !e.has("STARRED")) {
    punti = Math.min(punti, 1);
    motivi.unshift({ t: "Segnata da te: non importante", tono: "neutro" });
  }

  const ricevuta = Posta.analisi[m.id] && Posta.analisi[m.id].ricevuta;
  let gruppo;
  if (punti >= 4) gruppo = "importanti";
  else if (punti >= -1 || ricevuta || (conosciuto && !m.massa)) gruppo = "leggere";
  else gruppo = "rumore";
  return { gruppo, punti, motivi };
}

function gruppiPosta() {
  const g = { importanti: [], leggere: [], rumore: [] };
  for (const m of Posta.mail) {
    const s = smista(m);
    // "Da leggere" = solo le non lette; quelle già lette che non contano non disturbano
    if (s.gruppo === "leggere" && !m.etichette.includes("UNREAD")) continue;
    g[s.gruppo].push(m);
  }
  for (const k of Object.keys(g)) g[k].sort((a, b) => b.data - a.data);
  return g;
}

// ---------- Leggere il corpo (solo per scadenze e ricevute; non si salva il testo) ----------
function b64url(dati) {
  try {
    const bin = atob(dati.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch (e) { return ""; }
}
function testoDelCorpo(payload) {
  let piano = "", html = "";
  const giro = (p) => {
    if (!p) return;
    const tipo = minuscolo(p.mimeType);
    if (p.body && p.body.data && !(p.filename)) {
      if (tipo === "text/plain" && !piano) piano = b64url(p.body.data);
      else if (tipo === "text/html" && !html) html = b64url(p.body.data);
    }
    (p.parts || []).forEach(giro);
  };
  giro(payload);
  let t = piano || testoDaHtml(html.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " "));
  // via le righe citate di risposte precedenti ("> ...", "Il giorno ... ha scritto:")
  t = t.split(/\n(?:Il giorno .{5,80} ha scritto:|On .{5,80} wrote:|-{2,} ?Original Message|Da: .{3,80}\nInviato:)/i)[0];
  t = t.split("\n").filter((r) => !/^\s*>/.test(r)).join("\n");
  return t.replace(/[ \t ]+/g, " ").replace(/\n{3,}/g, "\n\n").slice(0, 8000);
}

async function analizzaCorpo(m) {
  const g = await gmail("GET", `/messages/${m.id}?format=full`);
  if (!g) return;
  const corpo = testoDelCorpo(g.payload);
  const testo = `${m.oggetto}\n${corpo}`;
  Posta.analisi[m.id] = {
    v: VERSIONE_ANALISI,
    scadenze: trovaScadenze(testo, new Date(m.data)),
    ricevuta: trovaRicevuta(m, testo),
  };
}

// ---------- 2. Scadenze ----------
const MESI = { gen: 0, gennaio: 0, jan: 0, january: 0, feb: 1, febbraio: 1, february: 1, mar: 2, marzo: 2, march: 2,
  apr: 3, aprile: 3, april: 3, mag: 4, maggio: 4, may: 4, giu: 5, giugno: 5, jun: 5, june: 5, lug: 6, luglio: 6, jul: 6, july: 6,
  ago: 7, agosto: 7, aug: 7, august: 7, set: 8, sett: 8, settembre: 8, sep: 8, sept: 8, september: 8, ott: 9, ottobre: 9, oct: 9, october: 9,
  nov: 10, novembre: 10, november: 10, dic: 11, dicembre: 11, dec: 11, december: 11 };
const NOMI_MESI = Object.keys(MESI).sort((a, b) => b.length - a.length).join("|");
const GIORNI_SETT = { domenica: 0, sunday: 0, lunedì: 1, lunedi: 1, monday: 1, martedì: 2, martedi: 2, tuesday: 2, mercoledì: 3, mercoledi: 3, wednesday: 3,
  giovedì: 4, giovedi: 4, thursday: 4, venerdì: 5, venerdi: 5, friday: 5, sabato: 6, saturday: 6 };
const GIORNI_REGEX = Object.keys(GIORNI_SETT).sort((a, b) => b.length - a.length).join("|");

// Che tipo di scadenza è (dalle parole vicine). Senza una di queste parole la data NON conta:
// così non prendiamo "Inviato il 3 nov" o le date in fondo alle mail.
const TIPI_SCADENZA = [
  { tipo: "Esame", re: /\b(esam[ei]|exam|midterm|final exam|finals\b|appello|verifica|quiz|test\b|prova scritta|orale)/i },
  { tipo: "Consegna", re: /\b(consegn|deadline|due\b|due date|submit|submission|entro e non oltre|assignment|compit|homework|elaborat|upload)/i },
  { tipo: "Pagamento", re: /\b(pagament|pagare|paga\b|rata|bollett|fattur|addebit|payment|pay by|invoice|retta|tassa|saldo da)/i },
  { tipo: "Appuntamento", re: /\b(appuntament|riunion|meeting|incontro|colloqui|call\b|videochiamata|webinar|lezione|seminari|workshop|evento|event\b|visita|prenotazion|booking|reservation|interview|partita|allenament|cena\b|festa|compleanno|ritrovo|ci vediamo)/i },
  { tipo: "Scadenza", re: /\b(scadenz|scade|scadrà|scadono|entro|termine|ultimo giorno|last day|expire|expires|expiring|by\b|iscrizion|registra|rinnov|valid[oa] fino)/i },
];

function anno2(a, rif) {
  if (!a) return null;
  const n = Number(a);
  return n < 100 ? 2000 + n : n;
}
function dataEsistente(a, m, g) {
  const d = new Date(a, m, g);
  return d.getMonth() === m && d.getDate() === g ? d : null;
}
// senza anno: quello della mail; se così cadrebbe molto prima della mail, è l'anno dopo
function conAnno(m, g, a, rif) {
  if (a) return dataEsistente(a, m, g);
  let d = dataEsistente(rif.getFullYear(), m, g);
  if (d && d < aggiungiGiorni(rif, -30)) d = dataEsistente(rif.getFullYear() + 1, m, g);
  return d;
}

function trovaScadenze(testo, rif) {
  const t = testo.replace(/\s+/g, " ");
  const trovate = [];
  const prendi = (indice, lunghezza, d) => {
    if (!d) return;
    const prima = t.slice(Math.max(0, indice - 90), indice);
    const dopo = t.slice(indice + lunghezza, indice + lunghezza + 40);
    // il tipo è quello della parola più vicina alla data (prima entro 70 caratteri, o subito dopo);
    // i tipi precisi (Esame, Consegna, Pagamento, Appuntamento) vincono su "Scadenza" generico
    let tipo = null, distanza = Infinity;
    const vicino = prima.slice(-70);
    for (const x of TIPI_SCADENZA) {
      if (x.tipo === "Scadenza" && tipo) break;
      const re = new RegExp(x.re.source, "gi");
      let y, ultima = -1;
      while ((y = re.exec(vicino))) ultima = y.index + y[0].length;
      if (ultima >= 0 && vicino.length - ultima < distanza) { distanza = vicino.length - ultima; tipo = x; }
      const d = dopo.slice(0, 25).search(x.re);
      if (d >= 0 && d + 5 < distanza) { distanza = d + 5; tipo = x; }
    }
    if (!tipo) return;
    // orario subito dopo: "alle 14:00", "ore 9", "at 5pm", "h 23.59", ", 18:30"
    let ora = null;
    const o = dopo.match(/^[\s,–-]*(?:(?:alle|ore|at|h|entro le|by)\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i);
    if (o && (o[2] || o[3] || /alle|ore|at|h\b|entro le/i.test(o[0]))) {
      let hh = Number(o[1]); const mm = Number(o[2] || 0);
      if (o[3] && /pm/i.test(o[3]) && hh < 12) hh += 12;
      if (o[3] && /am/i.test(o[3]) && hh === 12) hh = 0;
      if (hh < 24 && mm < 60) ora = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    // oppure poco prima: "alle 14.30 per la riunione di domani"
    if (!ora) {
      const ob = prima.slice(-40).match(/(?:alle|ore|at)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?!.*\d)/i);
      if (ob) {
        let hh = Number(ob[1]); const mm = Number(ob[2] || 0);
        if (ob[3] && /pm/i.test(ob[3]) && hh < 12) hh += 12;
        if (hh < 24 && mm < 60) ora = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }
    }
    const inizio = Math.max(0, indice - 60);
    const contesto = `${inizio > 0 ? "…" : ""}${t.slice(inizio, indice + lunghezza + 30).trim()}…`;
    trovate.push({ data: chiaveGiorno(d), ora, tipo: tipo.tipo, contesto });
  };

  let x;
  // 15/11, 15/11/2026, 15-11-26, 15.11.2026 (col punto solo con l'anno: "14.30" è un orario)
  const reNum = /\b(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{2,4}))?|-(\d{1,2})-(\d{2,4})|\.(\d{1,2})\.(\d{4}))\b/g;
  while ((x = reNum.exec(t))) {
    const g = Number(x[1]), m = Number(x[2] || x[4] || x[6]) - 1, a = anno2(x[3] || x[5] || x[7]);
    if (m < 0 || m > 11) continue;
    prendi(x.index, x[0].length, conAnno(m, g, a, rif));
  }
  // 2026-11-15
  const reIso = /\b(20\d\d)-(\d{2})-(\d{2})\b/g;
  while ((x = reIso.exec(t))) prendi(x.index, x[0].length, dataEsistente(Number(x[1]), Number(x[2]) - 1, Number(x[3])));
  // 15 novembre (2026), 15 nov.
  const reIt = new RegExp(`\\b(\\d{1,2})(?:°|st|nd|rd|th)?\\s+(?:di\\s+)?(${NOMI_MESI})\\.?(?:\\s+(\\d{4}))?\\b`, "gi");
  while ((x = reIt.exec(t))) prendi(x.index, x[0].length, conAnno(MESI[minuscolo(x[2])], Number(x[1]), x[3] && Number(x[3]), rif));
  // November 15(th)(, 2026)
  const reEn = new RegExp(`\\b(${NOMI_MESI})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "gi");
  while ((x = reEn.exec(t))) prendi(x.index, x[0].length, conAnno(MESI[minuscolo(x[1])], Number(x[2]), x[3] && Number(x[3]), rif));
  // oggi / stasera / domani / dopodomani / lunedì (prossimo)
  // (niente \\b: con le lettere accentate come "lunedì" non funziona)
  const reRel = new RegExp(`(?<![\\p{L}\\d])(oggi|stasera|today|tonight|domani|tomorrow|dopodomani|(?:(?:il|next|questo|this)\\s+)?(${GIORNI_REGEX})(?:\\s+prossimo)?)(?![\\p{L}\\d])`, "giu");
  while ((x = reRel.exec(t))) {
    const p = minuscolo(x[1]);
    let d = null;
    if (/^(oggi|stasera|today|tonight)$/.test(p)) d = new Date(rif);
    else if (/^(domani|tomorrow)$/.test(p)) d = aggiungiGiorni(rif, 1);
    else if (p === "dopodomani") d = aggiungiGiorni(rif, 2);
    else if (x[2]) {
      const target = GIORNI_SETT[minuscolo(x[2])];
      let diff = (target - rif.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d = aggiungiGiorni(rif, diff);
    }
    if (d) prendi(x.index, x[0].length, new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  // senza doppioni (stessa data: teniamo quella con l'orario), solo da oggi a 1 anno, massimo 3 per mail
  const oggi = oggiChiave(), traUnAnno = chiaveGiorno(aggiungiGiorni(new Date(), 365));
  const perData = new Map();
  for (const s of trovate) {
    if (s.data < chiaveGiorno(rif) || s.data > traUnAnno) continue;
    const prima = perData.get(s.data);
    if (!prima || (!prima.ora && s.ora)) perData.set(s.data, s);
  }
  return [...perData.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3)
    .map((s) => ({ ...s, passata: s.data < oggi }));
}

const scadenzeDi = (m) => ((Posta.analisi[m.id] && Posta.analisi[m.id].scadenze) || []);
const chiaveScadenza = (m, s) => `${m.id}|${s.data}`;

// Le scadenze ancora da decidere (non create, non ignorate, non passate), dalla più vicina
function scadenzeDaDecidere() {
  const viste = new Set(regole().scadenzeViste);
  const giaPromemoria = new Set(stato.promemoria.filter((p) => p.da_mail).map((p) => `${p.da_mail}|${p.scadenza}`));
  const out = [];
  for (const m of Posta.mail) {
    if (smista(m).gruppo === "rumore") continue;
    for (const s of scadenzeDi(m)) {
      const k = chiaveScadenza(m, s);
      if (s.data < oggiChiave() || viste.has(k) || giaPromemoria.has(k)) continue;
      out.push({ m, s, k });
    }
  }
  return out.sort((a, b) => a.s.data.localeCompare(b.s.data) || (a.s.ora || "").localeCompare(b.s.ora || ""));
}

function titoloScadenza(m, s) {
  const ogg = m.oggetto.replace(/^((re|r|fwd?|i|inoltra)\s*:\s*)+/i, "").trim();
  // "Consegna: Consegna progetto finale" → niente doppione
  if (minuscolo(ogg).startsWith(minuscolo(s.tipo).slice(0, 6))) return ogg.slice(0, 100);
  return `${s.tipo}: ${ogg}`.slice(0, 100);
}

function creaPromemoriaDaMail(m, s, testo) {
  const p = { id: nuovoId("p"), testo: (testo || titoloScadenza(m, s)).slice(0, 100), scadenza: s.data, ora: s.ora || null,
    fatto: false, da_inviare: true, da_mail: m.id };
  stato.promemoria.push(p);
  ricordaScadenza(chiaveScadenza(m, s));
  aggiorna();
  if (typeof inviaPromemoriaAGoogle === "function") inviaPromemoriaAGoogle(p);
  return p;
}
function ricordaScadenza(k) {
  const v = regole().scadenzeViste;
  if (!v.includes(k)) v.push(k);
  if (v.length > 400) v.splice(0, v.length - 400);
}

// ---------- 4. Ricevute → Spese ----------
const RE_RICEVUTA = /ricevut|receipt|conferma (dell'|del tuo |di )?ordine|il tuo ordine|ordine n|order confirm|your order|order #|grazie per (il tuo )?(acquisto|ordine)|thanks for your (order|purchase)|fattura|invoice|pagamento (ricevuto|effettuato|confermato|riuscito)|payment (received|confirmation|successful)|il tuo viaggio|your (trip|ride)|abbonamento (rinnovato|attivato)|subscription (renewed|confirmed)|biglietto|ticket|prenotazione confermata|booking confirm/i;
const RE_TOTALE = /(totale( ordine| pagato| complessivo| addebitato)?|total( paid| charged| amount)?|importo( pagato| addebitato| totale)?|addebitat[oi]|amount( paid| charged)?|hai pagato|you paid|prezzo totale|tot\.)/i;

function numeroImporto(s) {
  let t = s.replace(/\s/g, "");
  if (/,\d{2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function trovaRicevuta(m, testo) {
  if (!RE_RICEVUTA.test(`${m.oggetto} ${m.anteprima}`) && !RE_RICEVUTA.test(testo.slice(0, 600))) return null;
  if (m.etichette.includes("CATEGORY_PROMOTIONS")) return null;
  const t = testo.replace(/\s+/g, " ");
  const re = /(?:€|eur\b|euro\b)\s?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))|(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))\s?(?:€|eur\b|euro\b)/gi;
  const importi = [];
  let x;
  while ((x = re.exec(t))) {
    const n = numeroImporto(x[1] || x[2]);
    if (n === null || n <= 0 || n > 20000) continue;
    const prima = t.slice(Math.max(0, x.index - 45), x.index);
    importi.push({ n, totale: RE_TOTALE.test(prima) });
  }
  if (!importi.length) return null;
  const conTotale = importi.filter((i) => i.totale);
  // con la parola "totale": l'ultima (di solito il totale finale dopo sconti e spedizione)
  let importo = conTotale.length ? conTotale[conTotale.length - 1].n : null;
  if (importo === null) {
    const diversi = [...new Set(importi.map((i) => i.n))];
    if (diversi.length === 1) importo = diversi[0];
    else return null;   // tanti importi e nessun "totale": meglio non indovinare
  }
  const negozio = (m.da || dominioDi(m.email))
    .replace(/\b(no-?reply|team|ordini|orders?|ricevute|receipts?|info|support|servizio clienti|notifiche|via)\b/gi, "")
    .replace(/[<>"|·:-]+/g, " ").replace(/\s{2,}/g, " ").trim() || dominioDi(m.email);
  return { importo: Math.round(importo * 100) / 100, negozio };
}

async function cercaRicevute() {
  const q = `newer_than:45d -category:promotions -category:social {ricevuta receipt ordine order fattura invoice "pagamento ricevuto" "payment received" acquisto purchase viaggio trip abbonamento subscription}`;
  const ids = await idDaRicerca(q, 60);
  const nuove = ids.filter((id) => !Posta.analisi[id] || Posta.analisi[id].v !== VERSIONE_ANALISI);
  await aPiccoliGruppi(nuove.slice(0, 25), 4, async (id) => {
    const g = await gmail("GET", `/messages/${id}?format=full`);
    if (!g) return;
    const m = mailDaGmail(g);
    const testo = `${m.oggetto}\n${testoDelCorpo(g.payload)}`;
    Posta.analisi[id] = { v: VERSIONE_ANALISI, scadenze: [], ricevuta: trovaRicevuta(m, testo),
      testa: { oggetto: m.oggetto, da: m.da, email: m.email, data: m.data, thread: m.thread } };
  });
  Posta.ricevute = ids.filter((id) => Posta.analisi[id] && Posta.analisi[id].ricevuta);
  collegaRicevute();
}

// Collega ogni ricevuta al movimento della banca: stesso importo (al centesimo), da 3 giorni prima a 6 dopo
function collegaRicevute() {
  let cambiato = false;
  const usati = new Set(stato.movimenti.filter((x) => x.ricevuta).map((x) => x.ricevuta.id));
  for (const id of Posta.ricevute) {
    if (usati.has(id)) continue;
    const a = Posta.analisi[id];
    const testa = a.testa || Posta.mail.find((m) => m.id === id) || {};
    const giorno = chiaveGiorno(new Date(testa.data || Date.now()));
    const dal = chiaveGiorno(aggiungiGiorni(daChiave(giorno), -3)), al = chiaveGiorno(aggiungiGiorni(daChiave(giorno), 6));
    const candidati = stato.movimenti.filter((x) => x.tipo === "uscita" && !x.ricevuta && x.data >= dal && x.data <= al
      && Math.abs(x.importo - a.ricevuta.importo) < 0.011);
    if (!candidati.length) continue;
    // più candidati: vince quello col nome del negozio simile, poi quello col giorno più vicino
    const parole = minuscolo(a.ricevuta.negozio).split(/\W+/).filter((p) => p.length > 2);
    const voto = (x) => (parole.some((p) => minuscolo(`${x.descrizione} ${x.originale || ""}`).includes(p)) ? 10 : 0)
      - Math.abs(daChiave(x.data) - daChiave(giorno)) / 864e5;
    const scelto = candidati.sort((p, q) => voto(q) - voto(p))[0];
    scelto.ricevuta = { id, oggetto: testa.oggetto || "", da: testa.da || a.ricevuta.negozio, thread: testa.thread || id };
    usati.add(id);
    cambiato = true;
  }
  if (cambiato) salva();
}

function ricevuteTrovate() {
  const collegate = new Map(stato.movimenti.filter((x) => x.ricevuta).map((x) => [x.ricevuta.id, x]));
  return Posta.ricevute.map((id) => {
    const a = Posta.analisi[id];
    if (!a || !a.ricevuta) return null;
    return { id, ...a.ricevuta, testa: a.testa || Posta.mail.find((m) => m.id === id) || {}, movimento: collegate.get(id) || null };
  }).filter(Boolean).sort((a, b) => (b.testa.data || 0) - (a.testa.data || 0));
}

// ---------- Azioni sulle mail ----------
async function cambiaEtichette(ids, { aggiungi = [], togli = [] }) {
  for (let i = 0; i < ids.length; i += 1000) {
    await gmail("POST", "/messages/batchModify", { ids: ids.slice(i, i + 1000), addLabelIds: aggiungi, removeLabelIds: togli });
  }
}

async function archivia(ids, { segnaLette = false, silenzioso = false, testo = "" } = {}) {
  if (!ids.length) return;
  const togli = segnaLette ? ["INBOX", "UNREAD"] : ["INBOX"];
  const eranoNonLette = Posta.mail.filter((m) => ids.includes(m.id) && m.etichette.includes("UNREAD")).map((m) => m.id);
  await cambiaEtichette(ids, { togli });
  const via = new Set(ids);
  Posta.mail = Posta.mail.filter((m) => !via.has(m.id));
  salvaPosta();
  if (!silenzioso) {
    Posta.annulla = { testo: testo || `${ids.length === 1 ? "1 mail archiviata" : `${ids.length} mail archiviate`}`, ids, nonLette: segnaLette ? eranoNonLette : [], scade: Date.now() + 15000 };
    setTimeout(() => { if (Posta.annulla && Date.now() >= Posta.annulla.scade) { Posta.annulla = null; ridisegnaSeVisibile(); } }, 15500);
  }
}

async function annullaArchiviazione() {
  const a = Posta.annulla;
  if (!a) return;
  Posta.annulla = null;
  try {
    await cambiaEtichette(a.ids, { aggiungi: ["INBOX"] });
    if (a.nonLette.length) await cambiaEtichette(a.nonLette, { aggiungi: ["UNREAD"] });
  } catch (e) { alert(`Non sono riuscito ad annullare: ${e.message}`); }
  await aggiornaPosta(true);
}

async function segnaLetta(m, letta = true) {
  await cambiaEtichette([m.id], letta ? { togli: ["UNREAD"] } : { aggiungi: ["UNREAD"] });
  m.etichette = letta ? m.etichette.filter((x) => x !== "UNREAD") : [...m.etichette, "UNREAD"];
  salvaPosta();
}

// Azione con "sto lavorando" e messaggio d'errore chiaro
async function azionePosta(fn) {
  try { await fn(); } catch (e) { alert(e.message || "Qualcosa è andato storto"); }
  ridisegnaFermo();
}

const linkGmail = (thread) => `https://mail.google.com/mail/${Posta.email ? `?authuser=${encodeURIComponent(Posta.email)}` : "u/0/"}#all/${thread}`;

// Aggiunge una voce a una regola (senza doppioni) e la toglie dalle regole opposte
function aggiungiRegola(chiave, voce) {
  const R = regole();
  const v = minuscolo(voce).trim();
  if (!v) return;
  const opposte = { mittenti: ["mai", "silenziati"], mai: ["mittenti"], silenziati: ["mittenti"] }[chiave] || [];
  for (const o of opposte) R[o] = R[o].filter((x) => minuscolo(x) !== v);
  if (!R[chiave].some((x) => minuscolo(x) === v)) R[chiave].push(v);
  cacheSmista.clear();
  salva();
}

// ---------- 3. Newsletter ----------
async function analizzaNewsletter() {
  const ids = await idDaRicerca("newer_than:28d -in:sent -in:chats -in:drafts -in:trash (category:promotions OR category:social OR category:updates OR category:forums OR unsubscribe OR disiscriviti OR \"annulla iscrizione\" OR \"cancella iscrizione\")", 400);
  const lette = await aPiccoliGruppi(ids, 8, (id) => leggiIntestazioni(id, ["From", "Subject", "List-Unsubscribe", "List-Unsubscribe-Post", "List-Id", "Precedence"]));
  const perMittente = new Map();
  for (const g of lette) {
    if (!g) continue;
    const m = mailDaGmail(g);
    const e = new Set(m.etichette);
    if (!m.disiscrivi && !e.has("CATEGORY_PROMOTIONS") && !e.has("CATEGORY_SOCIAL")) continue;
    if (Posta.contatti.includes(m.email) && !m.massa) continue;
    const x = perMittente.get(m.email) || { email: m.email, nome: m.da, totale: 0, aperte: 0, inArrivo: 0, ultimo: "", ultimaData: 0, disiscrivi: null, unClick: false };
    x.totale++;
    if (!e.has("UNREAD")) x.aperte++;
    if (e.has("INBOX")) x.inArrivo++;
    if (m.data > x.ultimaData) { x.ultimaData = m.data; x.ultimo = m.oggetto; x.nome = m.da; }
    if (m.disiscrivi && !x.disiscrivi) { x.disiscrivi = m.disiscrivi; x.unClick = m.unClick; }
    perMittente.set(m.email, x);
  }
  Posta.newsletter = { del: Date.now(), mittenti: [...perMittente.values()].filter((x) => x.totale >= 2).sort((a, b) => b.totale - a.totale).slice(0, 40) };
  salvaPosta();
}

// List-Unsubscribe: "<https://…>, <mailto:…>"
function linkDisiscrizione(intest) {
  const voci = String(intest || "").match(/<([^>]+)>/g) || [];
  const pulite = voci.map((v) => v.slice(1, -1).trim());
  return { web: pulite.find((v) => /^https:\/\//i.test(v)) || null, mail: pulite.find((v) => /^mailto:/i.test(v)) || null };
}

async function disiscrivi(x) {
  const l = linkDisiscrizione(x.disiscrivi);
  if (x.unClick && l.web) {
    // disiscrizione "un clic" ufficiale (RFC 8058): basta questa richiesta, senza aprire pagine
    await fetch(l.web, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" });
  } else if (l.web) {
    window.open(l.web, "_blank", "noopener");
  } else if (l.mail) {
    window.open(l.mail, "_blank", "noopener");
  } else {
    throw new Error("Questo mittente non ha un link di disiscrizione: usa «Silenzia».");
  }
  x.disiscritto = true;
  // da adesso le sue mail (se ne arrivano ancora) vanno in archivio da sole
  aggiungiRegola("silenziati", x.email);
  await archiviaMittente(x, true);
  return l.web && x.unClick ? "fatto" : "pagina";
}

async function archiviaMittente(x, silenzioso = false) {
  const ids = await idDaRicerca(`from:${x.email} in:inbox`, 1000);
  if (ids.length) await archivia(ids, { segnaLette: true, silenzioso, testo: `${ids.length} mail di ${x.nome} archiviate` });
  x.inArrivo = 0;
  salvaPosta();
}

// ---------- Avvio e aggiornamento automatico ----------
function avviaPosta() {
  caricaPosta();
  clearInterval(Posta.timer);
  Posta.timer = setInterval(() => {
    if (document.visibilityState === "visible" && collegatoSulServer()) aggiornaPosta();
  }, OGNI_QUANTO_POSTA);
  // la prima volta aspettiamo che Google sia pronto
  setTimeout(() => { if (typeof collegatoSulServer === "function" && collegatoSulServer()) aggiornaPosta(); }, 4000);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && typeof collegatoSulServer === "function" && collegatoSulServer()) aggiornaPosta();
});
