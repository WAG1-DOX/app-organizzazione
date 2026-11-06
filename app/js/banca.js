// ===== banca.js: banche collegate (Enable Banking), import CSV e analisi delle spese =====
//
// Banche (serve la funzione Supabase "banca", vedi supabase/functions/banca):
// - ognuno configura UNA volta la sua applicazione Enable Banking (Application ID + file .pem);
// - "Collega una banca" → sito della banca → si torna qui con ?code=…&state=… → collegata;
// - movimenti e saldi arrivano da soli (al massimo ogni 6 ore, o con "Aggiorna ora");
// - i pagamenti "in attesa" si vedono subito e diventano definitivi da soli;
// - i nomi illeggibili delle banche ("PAGAMENTO POS … PRESSO ESSELUNGA") vengono ripuliti;
// - la categoria si indovina dal codice del negozio (MCC) e dal nome, e l'app IMPARA
//   dalle tue correzioni (stato.banca.regole);
// - i giroconti tra tuoi conti (anche le ricariche Revolut) si vedono ma non contano.
// CSV (piano B): carichi il file della banca, controlli le colonne, e i movimenti entrano senza doppioni.

const Banca = { stato: null, caricamento: false, errore: "", avvisi: [], messaggio: "", esiti: [] };
const OGNI_QUANTO_BANCA = 6 * 60 * 60 * 1000;
const CHIAVE_ULTIMO_BANCA = "organizza-banca-ultimo";

// stato.banca con tutti i campi (i salvataggi vecchi non li avevano)
function datiBanca() {
  if (!stato.banca) stato.banca = {};
  const b = stato.banca;
  b.ignorati = b.ignorati || [];
  b.saldi = b.saldi || {};
  b.conti = b.conti || {};
  b.regole = b.regole || {};
  return b;
}

// ---------- Chiamare la funzione "banca" su Supabase ----------
async function chiamaBanca(azione, dati = {}) {
  if (typeof sb === "undefined" || !sb || !utenteSupabase) throw new Error("Devi fare il login con il tuo account.");
  const { data, error } = await sb.functions.invoke("banca", { body: { azione, ...dati } });
  if (error) {
    let msg = "La funzione «banca» non risponde (Edoardo l'ha pubblicata su Supabase?).";
    try { const c = await error.context.json(); if (c && c.errore) msg = c.errore; } catch (e) { /* teniamo il messaggio generico */ }
    throw new Error(msg);
  }
  return data;
}

// =====================================================================
// 1. NOMI LEGGIBILI
// =====================================================================
const maiuscoleIniziali = (t) => t.toLowerCase().replace(/(^|[\s\-'/.&(])([a-zà-ù])/g, (x, a, b) => a + b.toUpperCase());

// Marchi noti scritti in modo strano dalle banche/dai circuiti
const MARCHI = [
  [/revolut\W*(\*\s*)?top-?up|top-?up by|ricarica revolut|revolut\W+ricarica/i, "Ricarica Revolut"],
  [/amzn|amazon/i, "Amazon"], [/apple\.com|itunes|apple services/i, "Apple"], [/google \*?youtube|youtube/i, "YouTube"],
  [/google \*?(storage|one)/i, "Google One"], [/google play|google \*/i, "Google"], [/netflix/i, "Netflix"], [/spotify/i, "Spotify"],
  [/disney ?plus|disney\+/i, "Disney+"], [/openai|chatgpt/i, "ChatGPT"], [/anthropic|claude\.ai/i, "Claude"], [/uber \*?eats/i, "Uber Eats"],
  [/uber/i, "Uber"], [/bolt\.eu|bolt/i, "Bolt"], [/deliveroo/i, "Deliveroo"], [/glovo/i, "Glovo"], [/just ?eat/i, "Just Eat"],
  [/mcdonald/i, "McDonald's"], [/starbucks/i, "Starbucks"], [/trenitalia/i, "Trenitalia"], [/italo|ntv/i, "Italo"], [/ryanair/i, "Ryanair"],
  [/easyjet/i, "easyJet"], [/esselunga/i, "Esselunga"], [/lidl/i, "Lidl"], [/carrefour/i, "Carrefour"], [/eurospin/i, "Eurospin"],
  [/conad/i, "Conad"], [/\bcoop\b/i, "Coop"], [/decathlon/i, "Decathlon"], [/zara\b/i, "Zara"], [/h ?& ?m\b/i, "H&M"], [/ikea/i, "IKEA"],
  [/paypal/i, "PayPal"], [/satispay/i, "Satispay"], [/vinted/i, "Vinted"], [/zalando/i, "Zalando"], [/shein/i, "Shein"], [/steam/i, "Steam"],
  [/playstation|sony interactive/i, "PlayStation"], [/telepass/i, "Telepass"], [/iliad/i, "Iliad"], [/vodafone/i, "Vodafone"],
  [/\btim\b/i, "TIM"], [/windtre|wind tre/i, "WindTre"], [/fastweb/i, "Fastweb"], [/enel/i, "Enel"],
];

// Toglie dal testo delle banche italiane le parti inutili e tiene il "chi"
function pulisciTesto(grezzo = "") {
  let t = ` ${String(grezzo).replace(/\s+/g, " ").trim()} `;
  t = t.replace(/\bcarta\s*(n\.?\s*)?[*x•]*\d{2,}/gi, " ")
    .replace(/\b(del|data|il)\s*\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?/gi, " ")
    .replace(/\b(alle\s*)?ore\s*\d{1,2}[:.]\d{2}/gi, " ")
    .replace(/\b\d+[.,]\d{2}\s*(eur|euro|€)\b/gi, " ")
    .replace(/\b(eur|euro)\s*\d+[.,]\d{2}\b/gi, " ")
    .replace(/\b(cro|trn|rif|id|cod)\.?\s*[:\w-]{6,}/gi, " ")
    .replace(/\b\d{6,}\b/g, " ");
  // "… PRESSO ESSELUNGA" / "C/O ESSELUNGA" / "ESERCENTE ESSELUNGA" → "ESSELUNGA"
  const presso = t.match(/\b(presso|c\/o|esercente|merchant|pos)\s+(.+)$/i);
  if (presso && presso[2].trim().length > 2) t = presso[2];
  t = t.replace(/^\s*(pagamento|pag\.?|acquisto|operazione|op\.?)\s+(pos|carta|con carta|tramite pos|mastercard|visa|maestro|bancomat|pagobancomat|contactless)\b/i, " ")
    .replace(/^\s*(pos|contactless|mastercard|visa|maestro)\b/i, " ")
    .replace(/\b(sumup|zettle|sq|izettle|nexi|satispay)\s*\*\s*/gi, " ")
    .replace(/\s*\*\s*/g, " ")
    .replace(/\s+/g, " ").trim();
  return t;
}

// Nome da mostrare + "chiave del negozio" (per imparare le categorie e trovare gli abbonamenti)
function nomeMovimento(m) {
  const testo = `${m.controparte || ""} ${m.descrizione || ""} ${m.dettagli || ""}`;
  // il nome dopo "DA …" / "A FAVORE DI …", fermandosi a CAUSALE, RIF, numeri…
  const FINE_NOME = /\s+(causale|caus\.?|rif\.?|riferimento|per|note|data|del|cro|trn|id)\b.*$/i;
  const prendiNome = (m) => (m ? m[1].replace(FINE_NOME, "").replace(/\s+/g, " ").trim() : "");
  const bonificoDa = prendiNome(testo.match(/bonifico.*?\b(?:da|ordinante|ord\.?)\s+([a-zà-ù' .]{3,60})/i));
  const bonificoA = prendiNome(testo.match(/bonifico.*?\b(?:a favore (?:di)?|beneficiario|ben\.?|disposto a)\s+([a-zà-ù' .]{3,60})/i));
  let nome = "";
  const marchio = MARCHI.find(([re]) => re.test(testo));
  if (marchio) nome = marchio[1];
  else if (/prelievo|prelevamento|atm\b.*contanti|cash withdrawal/i.test(testo)) nome = "Prelievo contanti";
  else if (/commissione|canone|imposta di bollo|bollo|spese (tenuta|conto)|interessi/i.test(testo) && !m.controparte) nome = maiuscoleIniziali(pulisciTesto(m.descrizione || testo)).slice(0, 40) || "Spese bancarie";
  else if (bonificoDa.length > 2 && m.tipo === "entrata") nome = `Bonifico da ${maiuscoleIniziali(bonificoDa)}`;
  else if (bonificoA.length > 2 && m.tipo === "uscita") nome = `Bonifico a ${maiuscoleIniziali(bonificoA)}`;
  else if (m.controparte) nome = maiuscoleIniziali(pulisciTesto(m.controparte));
  else nome = maiuscoleIniziali(pulisciTesto(m.descrizione || m.dettagli || ""));
  nome = nome.replace(/\s+/g, " ").trim().slice(0, 48) || "Movimento";
  const negozio = nome.toLowerCase().replace(/[^a-z0-9à-ù ]/g, "").replace(/\b(srl|spa|s r l|s p a|snc|sas|ltd|inc|gmbh|it|milano|roma|torino|napoli|firenze|bologna|venezia|padova|treviso)\b/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
  return { nome, negozio: negozio || nome.toLowerCase() };
}

// =====================================================================
// 2. CATEGORIE
// =====================================================================
// Codici dei negozi (MCC, standard dei circuiti delle carte) → categoria
function categoriaDaMcc(mcc) {
  const c = Number(mcc);
  if (!c) return null;
  if ([5411, 5412, 5422, 5441, 5451, 5462, 5499, 5811, 5812, 5813, 5814, 5921].includes(c)) return "Cibo";
  if ([4011, 4111, 4112, 4121, 4131, 4411, 4457, 4468, 4511, 4582, 4784, 4789, 5172, 5541, 5542, 5552, 7512, 7523].includes(c) || (c >= 3000 && c <= 3350)) return "Trasporti";
  if ([4814, 4816, 4899, 5815, 5816, 5817, 5818, 7372].includes(c)) return "Abbonamenti";
  if ([5655, 5940, 5941, 7941, 7991, 7992, 7997, 7999].includes(c)) return "Sport";
  if ([5111, 5192, 5942, 5943, 8211, 8220, 8241, 8244, 8249, 8299].includes(c)) return "Scuola";
  if ([5310, 5311, 5611, 5621, 5631, 5641, 5651, 5661, 5691, 5699, 5732, 5733, 5734, 5735, 5945, 5947, 5977, 7832, 7841, 7922, 7929, 7932, 7933, 7996].includes(c)) return "Svago";
  if ([6010, 6011].includes(c)) return "Contanti";
  return null;
}

const REGOLE_CATEGORIA = [
  [/esselunga|coop\b|conad|lidl|carrefour|eurospin|\bpam\b|despar|aldi|penny|iper|famila|tigre|crai|naturasi|supermerc|market|alimentari|panific|macelleria|frutta|\bbar\b|caff|coffee|pizz|ristor|trattoria|osteria|sushi|kebab|burger|mcdonald|kfc|starbucks|deliveroo|glovo|just ?eat|uber eats|gelat|pasticc|bakery|food|poke/i, "Cibo"],
  [/trenitalia|italo|\batm\b|\batac\b|actv|\bgtt\b|tper|busitalia|flixbus|\buber\b|\bbolt\b|free ?now|taxi|itabus|ryanair|easyjet|wizz|ita airways|benzin|carburant|\beni\b|\bq8\b|tamoil|\besso\b|\bip\b|autostrad|telepass|parchegg|parking|\blime\b|\bdott\b|car ?sharing|enjoy/i, "Trasporti"],
  [/netflix|spotify|disney|prime video|amazon prime|youtube|\bapple\b|icloud|google one|chatgpt|openai|claude|dazn|now ?tv|\bsky\b|\btim\b|vodafone|iliad|windtre|fastweb|abbonament|subscription|canone/i, "Abbonamenti"],
  [/decathlon|palestra|\bgym\b|fitness|mcfit|virgin active|piscina|padel|tennis|sport/i, "Sport"],
  [/libreria|feltrinelli|mondadori|giunti|cartoleria|copister|universit|h-?farm|tasse universit|scuola/i, "Scuola"],
  [/cinema|\buci\b|the space|steam|playstation|xbox|nintendo|zara|h&m|bershka|pull ?&? ?bear|nike|adidas|zalando|shein|vinted|amazon|concerto|ticketone|teatro|discoteca|\bclub\b|ikea/i, "Svago"],
  [/prelievo|contanti|cash withdrawal/i, "Contanti"],
];
const REGOLE_ENTRATE = [
  [/stipend|salary|busta paga|compenso|fattura|freelance|lavoro/i, "Lavoretti"],
  [/regalo|gift|auguri|compleanno/i, "Regali"],
  [/paghetta|mamma|papa\b|papà|genitor/i, "Paghetta"],
];
// Riconoscere i giroconti dal testo: ricariche Revolut, salvadanai, cambio valuta, "giroconto"
const TESTO_GIROCONTO = /giroconto|trasferimento tra (i )?(miei|propri|suoi) conti|\bto pocket|from pocket|to savings|from savings|vault|salvadanaio|exchanged? to|cambio valuta|\btop-?up\b|ricarica (carta )?revolut|revolut\*{0,1}\s*(top|ricarica)|apple pay top/i;

function categoriaPer(m) {
  const disponibili = categorieUscite();
  const scegli = (c) => (disponibili.includes(c) ? c : null);
  const regola = datiBanca().regole[m.negozio];
  if (regola && (m.tipo === "uscita" ? disponibili.includes(regola) || regola === "Giroconto" : categorieEntrate.includes(regola))) return regola;
  if (m.giroconto) return "Giroconto";
  const testo = `${m.nome || ""} ${m.controparte || ""} ${m.descrizione || ""} ${m.dettagli || ""} ${m.originale || ""}`;
  if (m.tipo === "entrata") {
    const r = REGOLE_ENTRATE.find(([re]) => re.test(testo));
    return r ? r[1] : "Altro";
  }
  // i prelievi prima di tutto (nel testo c'è spesso "ATM", che altrimenti sembrerebbe l'azienda dei trasporti)
  if (/prelievo|prelevamento|contanti|cash withdrawal/i.test(testo) || [6010, 6011].includes(Number(m.mcc))) return scegli("Contanti") || (disponibili.includes("Altro") ? "Altro" : disponibili[disponibili.length - 1]);
  const daMcc = scegli(categoriaDaMcc(m.mcc));
  if (daMcc) return daMcc;
  const r = REGOLE_CATEGORIA.find(([re]) => re.test(testo));
  if (r && scegli(r[1])) return r[1];
  return disponibili.includes("Altro") ? "Altro" : disponibili[disponibili.length - 1];
}

// Compatibilità: usata dall'import CSV e da altre sezioni
function categoriaDaTesto(testo = "", tipo = "uscita") {
  const { nome, negozio } = nomeMovimento({ descrizione: testo, tipo });
  return categoriaPer({ nome, negozio, descrizione: testo, tipo });
}

// Cambiare la categoria; con perTutti l'app se la ricorda per quel negozio (anche per il futuro)
function impostaCategoria(m, categoria, perTutti) {
  const giro = categoria === "Giroconto";
  m.categoria = categoria;
  m.categoria_manuale = true;
  m.giroconto = giro;
  if (perTutti && m.negozio) {
    datiBanca().regole[m.negozio] = categoria;
    for (const x of stato.movimenti) {
      if (x !== m && x.negozio === m.negozio && x.tipo === m.tipo && !x.categoria_manuale) {
        x.categoria = categoria;
        x.giroconto = giro;
      }
    }
  }
}

// Un numero "impronta" sempre uguale per lo stesso testo (per riconoscere i doppioni)
function impronta(testo) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < testo.length; i++) {
    const c = testo.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

// =====================================================================
// 3. METTERE I MOVIMENTI IN SPESE (banca o CSV), SENZA DOPPIONI
// =====================================================================
const giorniTra = (a, b) => Math.abs((daChiave(a) - daChiave(b)) / 86400000);

// Doppione = stesso id (già importato o eliminato apposta), oppure stesso giorno + importo + tipo
// di un movimento scritto a mano o arrivato da un'altra fonte (es. prima dal CSV, poi dalla banca)
function eDoppione(m, fonte, esistenti, ignorati) {
  if (esistenti.has(m.id) || ignorati.has(m.id)) return true;
  return stato.movimenti.some((x) => x.fonte !== fonte && !x.in_attesa && x.data === m.data && x.tipo === m.tipo && Math.abs(x.importo - m.importo) < 0.005);
}
function nuoviDa(lista, fonte) {
  const ignorati = new Set(datiBanca().ignorati);
  const esistenti = new Set(stato.movimenti.map((m) => m.id));
  return lista.filter((m) => m && m.data && m.importo > 0 && !eDoppione(m, fonte, esistenti, ignorati));
}

function preparaMovimento(m, fonte, banca) {
  const { nome, negozio } = nomeMovimento(m);
  const giroTesto = TESTO_GIROCONTO.test(`${m.controparte || ""} ${m.descrizione || ""} ${m.dettagli || ""}`);
  const x = {
    id: m.id, tipo: m.tipo, importo: m.importo, data: m.data,
    valuta: m.valuta && m.valuta !== "EUR" ? m.valuta : undefined,
    descrizione: nome, negozio,
    originale: [m.controparte, m.descrizione, m.dettagli].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ").slice(0, 300),
    fonte, banca: banca || m.banca || undefined, conto: m.conto || "", conto_chiave: m.conto_chiave || undefined,
    mcc: m.mcc || undefined, in_attesa: !!m.in_attesa || undefined,
    giroconto: !!m.giroconto || giroTesto,
  };
  x.categoria = categoriaPer(x);
  if (x.categoria === "Giroconto") x.giroconto = true;
  return x;
}

function aggiungiMovimentiImportati(lista, fonte, opzioni = {}) {
  const ignorati = new Set(datiBanca().ignorati);
  const esistenti = new Set(stato.movimenti.map((m) => m.id));
  let aggiunti = 0, doppioni = 0;
  for (const m of lista) {
    if (!m || !m.data || !(m.importo > 0)) continue;
    if (eDoppione(m, fonte, esistenti, ignorati)) { doppioni++; continue; }
    // un movimento definitivo prende il posto del suo "in attesa" (stesso conto, tipo e importo, pochi giorni di distanza)
    if (!m.in_attesa) {
      const i = stato.movimenti.findIndex((x) => x.in_attesa && x.conto_chiave === m.conto_chiave && x.tipo === m.tipo && Math.abs(x.importo - m.importo) < 0.005 && giorniTra(x.data, m.data) <= 7);
      if (i > -1) {
        const vecchio = stato.movimenti[i];
        stato.movimenti.splice(i, 1);
        const nuovo = preparaMovimento(m, fonte, opzioni.banca);
        if (vecchio.categoria_manuale) { nuovo.categoria = vecchio.categoria; nuovo.categoria_manuale = true; nuovo.giroconto = vecchio.giroconto; }
        if (vecchio.nota) nuovo.nota = vecchio.nota;
        stato.movimenti.push(nuovo);
        esistenti.add(m.id);
        aggiunti++;
        continue;
      }
    }
    stato.movimenti.push(preparaMovimento(m, fonte, opzioni.banca));
    esistenti.add(m.id);
    aggiunti++;
  }
  rilevaGiroconti();
  if (aggiunti) aggiorna();
  return { aggiunti, doppioni };
}

// Giroconti "a coppie": stessa cifra che esce da un tuo conto ed entra in un altro tuo conto entro 3 giorni
// (es. Fideuram → ricarica Revolut), anche quando la banca non dice l'IBAN
function rilevaGiroconti() {
  const banca = stato.movimenti.filter((m) => m.fonte === "banca" && m.conto_chiave && !m.giroconto && !m.categoria_manuale);
  const usati = new Set();
  for (const u of banca) {
    if (u.tipo !== "uscita" || usati.has(u.id)) continue;
    const e = banca.find((x) => x.tipo === "entrata" && !usati.has(x.id) && x.conto_chiave !== u.conto_chiave &&
      Math.abs(x.importo - u.importo) < 0.005 && giorniTra(x.data, u.data) <= 3 &&
      (TESTO_GIROCONTO.test(`${u.originale} ${x.originale}`) || /revolut|bonifico|trasferimento|giroconto|ricarica/i.test(`${u.originale} ${x.originale}`) ||
        (utenteAttuale.nome && new RegExp(utenteAttuale.nome, "i").test(`${u.originale} ${x.originale}`))));
    if (e) {
      for (const m of [u, e]) { m.giroconto = true; m.categoria = "Giroconto"; usati.add(m.id); }
    }
  }
}

// La risposta di "movimenti" (funzione banca) entra nell'app
function applicaDallaBanca(r) {
  const b = datiBanca();
  for (const s of r.saldi || []) b.saldi[s.chiave] = s;
  // gli "in attesa" dei conti letti si rimettono da capo (alcuni sono diventati definitivi, altri spariti)
  const letti = new Set(r.letti || []);
  const nuoviInAttesa = new Set((r.movimenti || []).filter((m) => m.in_attesa).map((m) => m.id));
  stato.movimenti = stato.movimenti.filter((m) => !(m.in_attesa && letti.has(m.conto_chiave) && !nuoviInAttesa.has(m.id)));
  const ordinati = [...(r.movimenti || [])].sort((a, b) => (a.in_attesa === b.in_attesa ? 0 : a.in_attesa ? 1 : -1));
  const banche = {};
  for (const e of r.esiti || []) banche[e.id] = e.banca;
  const res = aggiungiMovimentiImportati(ordinati, "banca");
  for (const m of stato.movimenti) {
    if (m.fonte === "banca" && !m.banca && m.conto_chiave && b.saldi[m.conto_chiave]) m.banca = b.saldi[m.conto_chiave].banca;
  }
  salva();
  return res;
}

// =====================================================================
// 4. SALDI, CONTI, AGGIORNAMENTO
// =====================================================================
const contoNascosto = (chiave) => !!(datiBanca().conti[chiave] && datiBanca().conti[chiave].nascosto);
const nomeConto = (chiave, predefinito) => (datiBanca().conti[chiave] && datiBanca().conti[chiave].nome) || predefinito || "Conto";

// Totale dei saldi in euro dei conti non nascosti (null se non ci sono saldi)
function saldoTotale() {
  const saldi = Object.values(datiBanca().saldi).filter((s) => (s.valuta || "EUR") === "EUR" && !contoNascosto(s.chiave));
  if (!saldi.length) return null;
  return { totale: saldi.reduce((t, s) => t + Number(s.saldo || 0), 0), conti: saldi.length };
}

// Saldo vero giorno per giorno: si parte da quello di oggi e si torna indietro coi movimenti della banca
function puntiSaldoReale(anno, mese) {
  const st = saldoTotale();
  if (!st) return null;
  const chiavi = new Set(Object.values(datiBanca().saldi).filter((s) => (s.valuta || "EUR") === "EUR" && !contoNascosto(s.chiave)).map((s) => s.chiave));
  const banca = stato.movimenti.filter((m) => m.fonte === "banca" && chiavi.has(m.conto_chiave) && (!m.valuta || m.valuta === "EUR"));
  const oggiK = oggiChiave();
  const punti = [];
  for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
    const d = new Date(anno, mese, g);
    const k = chiaveGiorno(d);
    if (k > oggiK) break;
    let saldo = st.totale;
    for (const m of banca) if (m.data > k) saldo -= m.tipo === "entrata" ? m.importo : -m.importo;
    punti.push({ etichetta: String(g), etichettaLunga: dataBreve(d), valore: Math.round(saldo * 100) / 100 });
  }
  return punti;
}

async function caricaStatoBanca() {
  try {
    Banca.stato = await chiamaBanca("stato");
    Banca.errore = "";
    if (Banca.stato.chiave && !datiBanca().attiva) { datiBanca().attiva = true; salva(); }
  } catch (e) {
    Banca.errore = e.message;
  }
}

// manuale = premuto "Aggiorna ora"; senza, controlla al massimo ogni 6 ore
async function aggiornaBanca(manuale = false) {
  if (Banca.caricamento || typeof utenteSupabase === "undefined" || !utenteSupabase) return;
  if (!manuale) {
    if (!stato.banca || !stato.banca.attiva) return;
    let ultimo = 0;
    try { ultimo = Number(localStorage.getItem(CHIAVE_ULTIMO_BANCA)) || 0; } catch (e) {}
    if (Date.now() - ultimo < OGNI_QUANTO_BANCA) return;
  }
  Banca.caricamento = true;
  ridisegnaSpeseSeAperte();
  try {
    if (!Banca.stato) await caricaStatoBanca();
    if (Banca.stato && Banca.stato.collegamenti && Banca.stato.collegamenti.length) {
      const r = await chiamaBanca("movimenti");
      const { aggiunti } = applicaDallaBanca(r);
      Banca.avvisi = r.avvisi || [];
      Banca.esiti = r.esiti || [];
      Banca.messaggio = aggiunti ? `${aggiunti} movimenti nuovi dalla banca` : "Tutto aggiornato";
      Banca.errore = "";
      try { localStorage.setItem(CHIAVE_ULTIMO_BANCA, String(Date.now())); } catch (e) {}
      await caricaStatoBanca();
    }
  } catch (e) {
    Banca.errore = e.message;
  } finally {
    Banca.caricamento = false;
    ridisegnaSpeseSeAperte();
  }
}

function ridisegnaSpeseSeAperte() {
  const pagina = (location.hash || "").replace("#", "");
  if ((pagina === "spese" || pagina === "home" || pagina === "") && !document.getElementById("modale").classList.contains("aperta")) ridisegnaFermo();
}

// Al ritorno dal sito della banca l'indirizzo contiene ?code=…&state=… (o ?error=…)
async function gestisciRitornoBanca() {
  const q = new URLSearchParams(location.search);
  if (!q.has("state") || (!q.has("code") && !q.has("error"))) return;
  const code = q.get("code"), state = q.get("state"), errore = q.get("error_description") || q.get("error");
  history.replaceState(null, "", location.pathname + "#spese");   // togliamo code e state dall'indirizzo
  if (errore) {
    Banca.errore = /denied|cancel/i.test(errore) ? "Collegamento annullato sul sito della banca." : `La banca ha risposto: ${errore}`;
  } else {
    try {
      const r = await chiamaBanca("completa", { code, state });
      Banca.messaggio = `${r.banca} collegata ✓ (${r.conti} cont${r.conti === 1 ? "o" : "i"})${r.sostituiti ? " · permesso rinnovato" : ""}`;
      Banca.errore = "";
      await aggiornaBanca(true);   // subito: alcune banche italiane danno lo storico lungo solo appena collegate
    } catch (e) {
      Banca.errore = e.message;
    }
  }
  disegna();
}

// =====================================================================
// 5. ANALISI DA "CONSULENTE"
// =====================================================================
// Abbonamenti e spese ricorrenti: stesso negozio, importo simile, a intervalli regolari
function trovaAbbonamenti() {
  const limite = chiaveGiorno(aggiungiGiorni(new Date(), -200));
  const perNegozio = {};
  for (const m of stato.movimenti) {
    if (m.tipo !== "uscita" || !contaNeiTotali(m) || m.data < limite || !m.negozio) continue;
    (perNegozio[m.negozio] = perNegozio[m.negozio] || []).push(m);
  }
  const trovati = [];
  for (const lista of Object.values(perNegozio)) {
    if (lista.length < 2) continue;
    lista.sort((a, b) => a.data.localeCompare(b.data));
    const media = lista.reduce((s, m) => s + m.importo, 0) / lista.length;
    if (!lista.every((m) => Math.abs(m.importo - media) <= Math.max(1, media * 0.15))) continue;   // importo stabile
    const intervalli = lista.slice(1).map((m, i) => giorniTra(m.data, lista[i].data));
    const medio = intervalli.reduce((s, x) => s + x, 0) / intervalli.length;
    let frequenza = null, perMese = 0;
    if (medio >= 25 && medio <= 35 && intervalli.every((x) => x >= 20 && x <= 40)) { frequenza = "ogni mese"; perMese = media; }
    else if (medio >= 6 && medio <= 8 && intervalli.every((x) => x >= 5 && x <= 9) && lista.length >= 3) { frequenza = "ogni settimana"; perMese = media * 52 / 12; }
    else if (medio >= 85 && medio <= 95) { frequenza = "ogni 3 mesi"; perMese = media / 3; }
    if (!frequenza) continue;
    const ultimo = lista[lista.length - 1];
    const prossimo = chiaveGiorno(aggiungiGiorni(daChiave(ultimo.data), Math.round(medio)));
    trovati.push({ nome: ultimo.descrizione, negozio: ultimo.negozio, importo: Math.round(media * 100) / 100, frequenza, perMese, prossimo, volte: lista.length, categoria: ultimo.categoria });
  }
  return trovati.sort((a, b) => b.perMese - a.perMese);
}

function analisiMese(anno, mese) {
  const oggi = new Date();
  const meseCorrente = anno === oggi.getFullYear() && mese === oggi.getMonth();
  const giorniMese = giorniNelMese(anno, mese);
  const giorniPassati = meseCorrente ? oggi.getDate() : giorniMese;
  const t = totaliMese(anno, mese);
  const uscite = t.lista.filter((m) => m.tipo === "uscita" && contaNeiTotali(m));
  const consigli = [];
  const budget = stato.budget.mensile;

  // da quando ci sono dati? (prima di quel giorno i confronti non hanno senso)
  const primoGiorno = stato.movimenti.reduce((min, m) => (m.data < min ? m.data : min), "9999");
  const da30 = chiaveGiorno(aggiungiGiorni(new Date(), -30));
  const ultimi30 = stato.movimenti.filter((m) => m.tipo === "uscita" && contaNeiTotali(m) && m.data >= da30).reduce((s, m) => s + m.importo, 0);

  // a) proiezione di fine mese: a inizio mese usiamo il ritmo degli ultimi 30 giorni (più stabile),
  //    poi quello del mese; in tutti e due i casi: speso finora + ritmo × giorni che mancano
  if (meseCorrente && t.uscite > 0) {
    const storiaLunga = primoGiorno <= da30;
    const alGiorno = giorniPassati < 10 && storiaLunga ? ultimi30 / 30 : t.uscite / giorniPassati;
    const restanti = giorniMese - giorniPassati;
    const previste = t.uscite + alGiorno * restanti;
    if (budget > 0) {
      if (previste > budget) {
        const ancora = Math.max(0, budget - t.uscite);
        consigli.push({ tono: "pericolo", icona: "frecciaSu", testo: `Al ritmo attuale finisci il mese a ${euro(previste)}, ${euro(previste - budget)} oltre il budget. Per rientrare puoi spendere ${euro(restanti ? ancora / restanti : 0)} al giorno fino a fine mese.` });
      } else {
        consigli.push({ tono: "ok", icona: "check", testo: `Sei in linea: al ritmo attuale chiudi il mese a ${euro(previste)} su ${euro(budget)}. Ti restano ${euro(restanti ? (budget - t.uscite) / restanti : 0)} al giorno.` });
      }
    } else {
      consigli.push({ tono: "", icona: "griglia", testo: `Al ritmo attuale (${euro(alGiorno)} al giorno) chiudi il mese a circa ${euro(previste)}. Imposta un budget per sapere se va bene.` });
    }
  }

  // b) confronto con il mese prima, allo stesso giorno
  const prima = new Date(anno, mese - 1, 1);
  const finoAl = Math.min(giorniPassati, giorniNelMese(prima.getFullYear(), prima.getMonth()));
  const limitePrima = `${prima.getFullYear()}-${pad(prima.getMonth() + 1)}-${pad(finoAl)}`;
  const uscitePrima = movimentiDelMese(prima.getFullYear(), prima.getMonth()).filter((m) => m.tipo === "uscita" && contaNeiTotali(m) && m.data <= limitePrima).reduce((s, m) => s + m.importo, 0);
  const datiMesePrima = primoGiorno <= `${prima.getFullYear()}-${pad(prima.getMonth() + 1)}-03`;
  if (datiMesePrima && uscitePrima >= 20 && t.uscite > 0) {
    const diff = (t.uscite - uscitePrima) / uscitePrima;
    if (Math.abs(diff) >= 0.1 && Math.abs(diff) <= 5) consigli.push({ tono: diff > 0 ? "attenzione" : "ok", icona: diff > 0 ? "frecciaSu" : "frecciaGiu",
      testo: `Rispetto allo stesso punto del mese scorso stai spendendo il ${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? "in più" : "in meno"} (${euro(t.uscite)} contro ${euro(uscitePrima)}).` });
  }

  // c) categoria cresciuta rispetto alla media dei 3 mesi prima
  const perCat = {};
  for (const m of uscite) perCat[m.categoria] = (perCat[m.categoria] || 0) + m.importo;
  // media dei 3 mesi prima, contando solo i mesi in cui l'app aveva già i dati
  const mediaCat = {};
  const mesiValidi = [1, 2, 3].map((i) => new Date(anno, mese - i, 1)).filter((d) => primoGiorno <= `${d.getFullYear()}-${pad(d.getMonth() + 1)}-03`);
  for (const d of mesiValidi) {
    for (const m of movimentiDelMese(d.getFullYear(), d.getMonth())) if (m.tipo === "uscita" && contaNeiTotali(m)) mediaCat[m.categoria] = (mediaCat[m.categoria] || 0) + m.importo / mesiValidi.length;
  }
  const crescite = Object.entries(perCat).map(([c, v]) => [c, v, mediaCat[c] || 0]).filter(([, v, media]) => media > 15 && v > media * 1.3 && v - media > 10).sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
  if (crescite.length) {
    const [c, v, media] = crescite[0];
    consigli.push({ tono: "attenzione", icona: "frecciaSu", testo: `${c}: ${euro(v)} questo mese, contro una media di ${euro(media)} ${mesiValidi.length === 1 ? "il mese prima" : `nei ${mesiValidi.length} mesi prima`}.` });
  }

  // d) piccole spese che si accumulano
  const piccole = uscite.filter((m) => m.importo < 10);
  if (piccole.length >= 6 && t.uscite > 0) {
    const tot = piccole.reduce((s, m) => s + m.importo, 0);
    consigli.push({ tono: "", icona: "mela", testo: `${piccole.length} spese sotto i 10 € per ${euro(tot)}: sono il ${Math.round((tot / t.uscite) * 100)}% delle uscite. Caffè e snack sembrano poco, ma si sommano.` });
  }

  // e) abbonamenti
  const abbonamenti = trovaAbbonamenti();
  const totAbb = abbonamenti.reduce((s, a) => s + a.perMese, 0);
  if (abbonamenti.length) consigli.push({ tono: "", icona: "sync", testo: `Spese che si ripetono: ${euro(totAbb)} al mese (${euro(totAbb * 12)} all'anno). Controlla di usarle tutte.` });

  // f) risparmio
  if (t.entrate > 0) {
    const quota = (t.entrate - t.uscite) / t.entrate;
    consigli.push({ tono: quota >= 0.2 ? "ok" : quota >= 0 ? "" : "pericolo", icona: "portafoglio",
      testo: quota >= 0 ? `Hai messo da parte il ${Math.round(quota * 100)}% di quello che è entrato${quota >= 0.2 ? ": ottimo, l'obiettivo classico è il 20%." : ". Un buon obiettivo è il 20%."}` : `Questo mese sei uscito di ${euro(t.uscite - t.entrate)} più di quanto è entrato.` });
  }

  // g) autonomia: quanti giorni durano i soldi sul conto al ritmo degli ultimi 30 giorni
  const st = saldoTotale();
  if (st && st.totale > 0 && ultimi30 > 0 && primoGiorno <= da30) {
    const giorni = Math.floor(st.totale / (ultimi30 / 30));
    consigli.push({ tono: giorni < 30 ? "attenzione" : "", icona: "orologio", testo: `Con ${euro(st.totale)} sui conti e ${euro(ultimi30 / 30)} di spesa media al giorno, hai circa ${giorni} giorni di autonomia.` });
  }

  // h) dove vanno i soldi
  const perNegozio = {};
  for (const m of uscite) perNegozio[m.descrizione] = (perNegozio[m.descrizione] || 0) + m.importo;
  const topNegozi = Object.entries(perNegozio).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCategorie = Object.entries(perCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return { consigli, abbonamenti, totAbb, topNegozi, topCategorie, uscite: t.uscite };
}

// =====================================================================
// 6. FINESTRE: configurare, collegare, conti
// =====================================================================
function apriConfiguraBanca() {
  const appId = h("input", { type: "text", placeholder: "es. 16834810-0401-4bcb-…", required: true, maxlength: 36, autocomplete: "off" });
  const file = h("input", { type: "file", accept: ".pem,.key,.txt", required: true });
  const messaggio = h("p", { class: "accesso-messaggio" });
  const bottone = h("button", { class: "bottone-accento largo", type: "submit" }, "Salva e prova");
  apriModale("Configura Enable Banking",
    h("p", { class: "testo-leggero" }, "Serve una volta sola. È gratis e vale solo per i tuoi conti."),
    h("ol", { class: "passi" },
      h("li", {}, "Vai su enablebanking.com → Sign in (con la tua email)."),
      h("li", {}, "API applications → Production → genera la chiave nel browser."),
      h("li", {}, h("span", {}, "Redirect URL: "), h("code", {}, "https://xecute-app.vercel.app/")),
      h("li", {}, "Register: si scarica un file .pem. Poi «Activate by linking accounts» con le tue banche."),
      h("li", {}, "Qui sotto: incolla l'Application ID e scegli il file .pem.")),
    h("form", { class: "modulo", onsubmit: async (ev) => {
      ev.preventDefault();
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 10000) { messaggio.textContent = "Il file è troppo grande per essere una chiave."; messaggio.className = "accesso-messaggio errore"; return; }
      bottone.disabled = true;
      messaggio.textContent = "Controllo la chiave con Enable Banking…";
      messaggio.className = "accesso-messaggio";
      try {
        const pem = await f.text();
        await chiamaBanca("salva_chiave", { application_id: appId.value.trim(), chiave_pem: pem });
        datiBanca().attiva = true;
        salva();
        await caricaStatoBanca();
        chiudiModale();
        Banca.messaggio = "Enable Banking configurato ✓ Ora collega una banca.";
        disegna();
      } catch (e) {
        messaggio.textContent = e.message;
        messaggio.className = "accesso-messaggio errore";
        bottone.disabled = false;
      }
    } },
      campo("Application ID", appId),
      campo("File chiave (.pem)", file),
      h("p", { class: "testo-leggero piccolo" }, "La chiave viene cifrata su Supabase e non torna più indietro: nell'app non resta salvata, e nessuno la può leggere."),
      bottone, messaggio));
}

const PAESI_BANCA = [["IT", "Italia"], ["LT", "Lituania (Revolut)"], ["DE", "Germania (N26…)"], ["FR", "Francia"], ["ES", "Spagna"], ["NL", "Paesi Bassi"], ["IE", "Irlanda"], ["BE", "Belgio"], ["AT", "Austria"]];

// Va direttamente al sito della banca (per «Rinnova»)
async function vaiAllaBanca(banca, paese) {
  Banca.messaggio = `Ti porto su ${banca}…`;
  ridisegnaFermo();
  try {
    const r = await chiamaBanca("collega", { banca, paese });
    location.href = r.url;
  } catch (e) {
    Banca.errore = e.message;
    Banca.messaggio = "";
    ridisegnaFermo();
  }
}

function apriCollegaBanca() {
  const paese = h("select", {}, PAESI_BANCA.map(([v, n]) => h("option", { value: v }, n)));
  const cerca = h("input", { type: "search", placeholder: "Cerca la banca, es. Fineco", autocomplete: "off" });
  const elenco = h("ul", { class: "elenco-banche" });
  const messaggio = h("p", { class: "accesso-messaggio" }, "Carico le banche…");
  let banche = [], scelta = null;
  const vai = h("button", { class: "bottone-accento largo", type: "button", disabled: true, onclick: async () => {
    vai.disabled = true;
    messaggio.textContent = "Ti porto sul sito della banca…";
    try {
      const r = await chiamaBanca("collega", { banca: scelta, paese: paese.value });
      location.href = r.url;
    } catch (e) {
      messaggio.textContent = e.message;
      messaggio.className = "accesso-messaggio errore";
      vai.disabled = false;
    }
  } }, "Vai alla banca");

  const mostra = () => {
    const t = cerca.value.trim().toLowerCase();
    elenco.replaceChildren(...banche.filter((b) => !t || b.nome.toLowerCase().includes(t)).slice(0, 60).map((b) =>
      h("li", {}, h("button", { type: "button", class: `scelta${scelta === b.nome ? " scelta-attiva" : ""}`, onclick: () => {
        scelta = b.nome; vai.disabled = false; vai.textContent = `Vai su ${b.nome}`; mostra();
      } }, h("span", { class: "scelta-segno" }, icona("check", 12)), h("span", { class: "scelta-testo" }, h("strong", {}, b.nome), b.beta && h("small", {}, "in prova"))))));
  };
  const carica = async () => {
    banche = []; scelta = null; vai.disabled = true; vai.textContent = "Vai alla banca";
    elenco.replaceChildren();
    messaggio.textContent = "Carico le banche…"; messaggio.className = "accesso-messaggio";
    try {
      banche = (await chiamaBanca("banche", { paese: paese.value })).banche || [];
      messaggio.textContent = banche.length ? "" : "Nessuna banca trovata per questo paese.";
      mostra();
    } catch (e) {
      messaggio.textContent = e.message; messaggio.className = "accesso-messaggio errore";
    }
  };
  paese.addEventListener("change", carica);
  cerca.addEventListener("input", mostra);

  apriModale("Collega una banca",
    h("p", { class: "testo-leggero" }, "Scegli la banca: ti porto sul suo sito, fai il login e confermi. Poi torni qui da solo. L'app può solo LEGGERE movimenti e saldi, non spostare soldi."),
    h("div", { class: "due-campi" }, campo("Paese", paese), campo("Banca", cerca)),
    h("p", { class: "testo-leggero piccolo" }, "Revolut è sotto Lituania. Fideuram: «Fideuram, Intesa Sanpaolo Private Banking» (chiede due conferme di fila: è normale)."),
    elenco, messaggio, vai);
  carica();
}

function apriConto(c, conto) {
  const b = datiBanca();
  const info = b.conti[conto.chiave] || {};
  const nome = h("input", { type: "text", value: info.nome || conto.nome, maxlength: 40 });
  const nascosto = h("input", { type: "checkbox", checked: !!info.nascosto });
  const saldo = b.saldi[conto.chiave];
  apriModale(`${c.banca} · ${conto.nome}`,
    h("dl", { class: "dettagli" },
      conto.iban_finale && [h("dt", {}, "IBAN"), h("dd", {}, `•••• ${conto.iban_finale}`)],
      saldo && [h("dt", {}, "Saldo"), h("dd", {}, euroValuta(saldo.saldo, saldo.valuta))],
      saldo && [h("dt", {}, "Aggiornato"), h("dd", {}, new Date(saldo.data).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" }))]),
    h("div", { class: "modulo" },
      campo("Nome da mostrare", nome),
      h("label", { class: "spunta-riga" }, nascosto, h("span", {}, "Nascondi questo conto (es. un salvadanaio): i suoi movimenti e il saldo non contano")),
      h("button", { class: "bottone-accento largo", type: "button", onclick: () => {
        b.conti[conto.chiave] = { ...info, nome: nome.value.trim() || conto.nome, nascosto: nascosto.checked };
        for (const m of stato.movimenti) if (m.conto_chiave === conto.chiave) m.conto = b.conti[conto.chiave].nome;
        chiudiModale();
        aggiorna();
      } }, "Salva")));
}

async function scollegaBanca(c) {
  const quanti = stato.movimenti.filter((m) => m.fonte === "banca" && (c.conti || []).some((x) => x.chiave === m.conto_chiave)).length;
  const cancella = h("input", { type: "checkbox" });
  apriModale(`Scollegare ${c.banca}?`,
    h("p", { class: "testo-leggero" }, "L'app smette di leggere questa banca. Puoi ricollegarla quando vuoi."),
    quanti > 0 && h("label", { class: "spunta-riga" }, cancella, h("span", {}, `Cancella anche i ${quanti} movimenti arrivati da ${c.banca}`)),
    h("div", { class: "azioni-modale" },
      h("button", { class: "bottone-secondario", type: "button", onclick: chiudiModale }, "Annulla"),
      h("button", { class: "bottone-accento pericolo", type: "button", onclick: async () => {
        try {
          await chiamaBanca("scollega", { id: c.id });
          const chiavi = new Set((c.conti || []).map((x) => x.chiave));
          if (cancella.checked) stato.movimenti = stato.movimenti.filter((m) => !(m.fonte === "banca" && chiavi.has(m.conto_chiave)));
          for (const k of chiavi) delete datiBanca().saldi[k];
          await caricaStatoBanca();
          chiudiModale();
          aggiorna();
        } catch (e) { Banca.errore = e.message; chiudiModale(); ridisegnaFermo(); }
      } }, "Scollega")));
}

const euroValuta = (n, valuta = "EUR") => valuta === "EUR" ? euro(n) : new Intl.NumberFormat("it-IT", { style: "currency", currency: valuta }).format(n);

// ---------- Pannello "Conti e banche" (in Spese) ----------
function pannelloBanche() {
  const st = Banca.stato;
  if (st === null && !Banca.caricamento && !Banca.errore && typeof utenteSupabase !== "undefined" && utenteSupabase) {
    Banca.caricamento = true;
    caricaStatoBanca().finally(() => { Banca.caricamento = false; ridisegnaSpeseSeAperte(); });
  }
  const b = datiBanca();
  const quando = (iso) => {
    if (!iso) return "mai";
    const min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return "adesso";
    if (min < 60) return `${min} min fa`;
    if (min < 1440) return `${Math.round(min / 60)} h fa`;
    return dataBreve(new Date(iso));
  };
  const totale = saldoTotale();

  const blocchi = st && st.collegamenti ? st.collegamenti.map((c) => {
    const giorni = c.valido_fino ? Math.floor((new Date(c.valido_fino) - Date.now()) / 86400000) : null;
    const esito = Banca.esiti.find((e) => e.id === c.id);
    const scaduto = (giorni !== null && giorni < 0) || (esito && esito.scaduto);
    const stato_ = scaduto ? ["pericolo", "Permesso scaduto"] : giorni !== null && giorni < 14 ? ["urgente", `Scade fra ${giorni} giorni`] : esito && !esito.ok ? ["urgente", "Lettura non riuscita"] : ["", `Aggiornata ${quando(c.ultimo_aggiornamento)}`];
    return h("div", { class: "blocco-banca" },
      h("div", { class: "blocco-banca-testa" },
        h("strong", {}, c.banca),
        h("span", { class: `pill piccola ${stato_[0]}` }, stato_[1]),
        h("span", { class: "spazio" }),
        h("button", { class: `pill piccola${scaduto || (giorni !== null && giorni < 14) ? " attiva" : ""}`, type: "button", title: "Rifai il login della banca per rinnovare il permesso", onclick: () => vaiAllaBanca(c.banca, c.paese) }, "Rinnova"),
        h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": `Scollega ${c.banca}`, title: "Scollega", onclick: () => scollegaBanca(c) }, icona("x", 14))),
      h("ul", { class: "conti-banca" }, (c.conti || []).map((conto) => {
        const s = b.saldi[conto.chiave];
        const nascosto = contoNascosto(conto.chiave);
        return h("li", {}, h("button", { type: "button", class: `riga-conto${nascosto ? " conto-nascosto" : ""}`, onclick: () => apriConto(c, conto) },
          h("span", { class: "riga-testo" },
            h("strong", {}, nomeConto(conto.chiave, conto.nome)),
            h("small", {}, [conto.iban_finale && `•••• ${conto.iban_finale}`, nascosto && "nascosto", conto.valuta && conto.valuta !== "EUR" && conto.valuta].filter(Boolean).join(" · ") || "conto")),
          h("strong", { class: "saldo-conto" }, s ? euroValuta(s.saldo, s.valuta) : "—")));
      })),
      giorni !== null && !scaduto && h("small", { class: "testo-leggero piccolo" }, `Permesso valido fino al ${dataBreve(new Date(c.valido_fino))}`));
  }) : [];

  const destra = Banca.caricamento ? h("span", { class: "pill" }, icona("sync", 12), " aggiorno…")
    : st && st.chiave && st.collegamenti && st.collegamenti.length ? h("button", { class: "pill", type: "button", onclick: () => aggiornaBanca(true) }, icona("sync", 12), " Aggiorna") : null;

  return pannello("pannello-banche", "Conti e banche", destra,
    totale && h("div", { class: "totale-conti" }, h("small", {}, `Disponibile su ${totale.conti} cont${totale.conti === 1 ? "o" : "i"}`), h("strong", {}, euro(totale.totale))),
    Banca.messaggio && h("p", { class: "avviso-ok" }, Banca.messaggio),
    Banca.errore && h("p", { class: "avviso-errore" }, Banca.errore),
    ...Banca.avvisi.map((a) => h("p", { class: "avviso-errore piccolo" }, a)),
    st && !st.chiave && h("p", { class: "testo-leggero" }, "Collega Revolut, Fineco, Fideuram… e movimenti e saldi arrivano da soli, entrate comprese. Gratis, con Enable Banking."),
    ...blocchi,
    st && st.chiave && !blocchi.length && h("p", { class: "vuoto" }, "Nessuna banca collegata"),
    h("div", { class: "azioni-banca" },
      st && !st.chiave && h("button", { class: "bottone-accento", type: "button", onclick: apriConfiguraBanca }, "Configura Enable Banking"),
      st && st.chiave && h("button", { class: "bottone-accento", type: "button", onclick: apriCollegaBanca }, icona("piu", 14), "Collega una banca"),
      h("button", { class: "bottone-secondario", type: "button", onclick: apriImportCsv }, icona("scontrino", 14), "Importa CSV"),
      b.ignorati.length > 0 && h("button", { class: "link-sottile", type: "button", title: "I movimenti che hai eliminato torneranno al prossimo aggiornamento",
        onclick: () => { if (confirm(`Far tornare i ${b.ignorati.length} movimenti eliminati al prossimo aggiornamento?`)) { b.ignorati = []; try { localStorage.removeItem(CHIAVE_ULTIMO_BANCA); } catch (e) {} aggiorna(); aggiornaBanca(true); } } },
        `Ripristina eliminati (${b.ignorati.length})`)));
}

// Eliminando un movimento arrivato dalla banca o dal CSV ce lo segniamo, così non torna più
function ricordaEliminato(m) {
  if (!m.fonte) return;
  datiBanca().ignorati = [...datiBanca().ignorati, m.id].slice(-5000);
}
function eliminaMovimenti(lista) {
  const ids = new Set(lista.map((m) => m.id));
  for (const m of lista) ricordaEliminato(m);
  stato.movimenti = stato.movimenti.filter((m) => !ids.has(m.id));
  aggiorna();
}

// =====================================================================
// 7. IMPORT DELL'ESTRATTO CONTO (CSV)
// =====================================================================
function leggiCsv(testo) {
  const campione = testo.split(/\r?\n/).filter((r) => r.trim()).slice(0, 20).join("\n");
  const sep = [";", ",", "\t", "|"].map((s) => [s, campione.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const righe = [];
  let riga = [], cella = "", virgolette = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (virgolette) {
      if (c === '"' && testo[i + 1] === '"') { cella += '"'; i++; }
      else if (c === '"') virgolette = false;
      else cella += c;
    } else if (c === '"') virgolette = true;
    else if (c === sep) { riga.push(cella.trim()); cella = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && testo[i + 1] === "\n") i++;
      riga.push(cella.trim()); cella = "";
      if (riga.some((x) => x !== "")) righe.push(riga);
      riga = [];
    } else cella += c;
  }
  riga.push(cella.trim());
  if (riga.some((x) => x !== "")) righe.push(riga);
  return righe;
}

function numeroDaTesto(s) {
  if (s == null) return NaN;
  let t = String(s).replace(/[€$£\s]|EUR/gi, "");
  if (!t) return NaN;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1); }
  if (t.endsWith("-")) { negativo = true; t = t.slice(0, -1); }
  const ultimaVirgola = t.lastIndexOf(","), ultimoPunto = t.lastIndexOf(".");
  if (ultimaVirgola > -1 && ultimoPunto > -1) {
    t = ultimaVirgola > ultimoPunto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (ultimaVirgola > -1) {
    t = t.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return negativo ? -Math.abs(n) : n;
}

function dataDaTesto(s) {
  const t = String(s || "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    const anno = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anno}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  }
  return "";
}

// Indoviniamo quali colonne sono data, importo, descrizione…
function indovinaColonne(intestazioni) {
  const trova = (...regole) => {
    for (const re of regole) {
      const i = intestazioni.findIndex((x) => re.test(x));
      if (i > -1) return i;
    }
    return -1;
  };
  return {
    data: trova(/completed date/i, /data contab/i, /data operaz/i, /^data$/i, /booking/i, /^date$/i, /data/i, /date/i),
    importo: trova(/^importo$/i, /^amount$/i, /importo(?!.*(commiss|saldo))/i, /amount(?!.*fee)/i, /ammontare|valore/i),
    uscite: trova(/uscit/i, /^dare$/i, /addebit/i, /debit/i),
    entrate: trova(/entrat/i, /^avere$/i, /accredit/i, /credit(?!.*card)/i),
    descrizione: trova(/^description$/i, /descrizione/i, /causale/i, /dettagli|details/i, /beneficiario|controparte|merchant|esercente/i, /operazione(?!.*data)/i),
  };
}

function movimentiDaCsv(righe, inizio, col) {
  const out = [], visti = {};
  for (const r of righe.slice(inizio + 1)) {
    const data = dataDaTesto(r[col.data]);
    if (!data) continue;
    let valore = NaN;
    if (col.importo > -1) valore = numeroDaTesto(r[col.importo]);
    if (isNaN(valore) && (col.uscite > -1 || col.entrate > -1)) {
      const u = col.uscite > -1 ? Math.abs(numeroDaTesto(r[col.uscite])) : NaN;
      const e = col.entrate > -1 ? Math.abs(numeroDaTesto(r[col.entrate])) : NaN;
      valore = !isNaN(e) && e > 0 ? e : !isNaN(u) && u > 0 ? -u : NaN;
    }
    if (isNaN(valore) || valore === 0) continue;
    const descrizione = (col.descrizione > -1 ? r[col.descrizione] : "") || "Movimento";
    const chiave = `${data}|${valore}|${descrizione.toLowerCase()}`;
    visti[chiave] = (visti[chiave] || 0) + 1;   // due movimenti identici nello stesso file restano due
    out.push({
      id: `csv-${impronta(`${chiave}#${visti[chiave]}`)}`,
      tipo: valore > 0 ? "entrata" : "uscita",
      importo: Math.round(Math.abs(valore) * 100) / 100,
      data, descrizione: descrizione.replace(/\s+/g, " ").trim(), dettagli: "",
    });
  }
  return out;
}

function apriImportCsv() {
  const file = h("input", { type: "file", accept: ".csv,.txt,text/csv", required: true });
  const zona = h("div", { class: "colonna" });
  apriModale("Importa estratto conto",
    h("p", { class: "testo-leggero" }, "Scarica dalla tua banca la lista dei movimenti in formato CSV (Revolut: Estratto conto → Excel/CSV; Fineco e Fideuram: Movimenti → Esporta). Poi sceglila qui: controlli le colonne e importi. I movimenti già presenti vengono saltati."),
    campo("File CSV", file), zona);
  document.querySelector(".modale-box").classList.add("larga");

  file.addEventListener("change", async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const buffer = await f.arrayBuffer();
    let testo = new TextDecoder("utf-8").decode(buffer);
    if (testo.includes("�")) testo = new TextDecoder("windows-1252").decode(buffer);   // file "vecchi" delle banche italiane
    testo = testo.replace(/^﻿/, "");
    const righe = leggiCsv(testo);
    if (!righe.length) { zona.replaceChildren(h("p", { class: "avviso-errore" }, "Il file è vuoto o non è un CSV.")); return; }

    // la riga con i titoli delle colonne: la prima che ha "data" e "importo" (o simili)
    let inizio = righe.slice(0, 40).findIndex((r) => r.some((x) => /data|date/i.test(x)) && r.some((x) => /importo|amount|entrat|uscit|dare|avere|addebit|accredit|ammontare/i.test(x)));
    if (inizio < 0) inizio = 0;
    const intestazioni = righe[inizio].map((x, i) => x || `Colonna ${i + 1}`);
    const col = indovinaColonne(intestazioni);

    const scegli = (chiave, etichetta, facoltativa) => {
      const s = h("select", { onchange: () => { col[chiave] = Number(s.value); anteprima(); } },
        facoltativa && h("option", { value: -1 }, "—"),
        intestazioni.map((x, i) => h("option", { value: i, selected: col[chiave] === i }, x)));
      if (!facoltativa && col[chiave] < 0) col[chiave] = 0;
      return campo(etichetta, s);
    };
    const risultato = h("div", { class: "colonna" });
    const anteprima = () => {
      const lista = movimentiDaCsv(righe, inizio, col);
      const nuovi = nuoviDa(lista, "csv");
      const entrate = nuovi.filter((m) => m.tipo === "entrata").length;
      risultato.replaceChildren(...[
        lista.length
          ? h("p", { class: "testo-leggero" }, `${lista.length} movimenti letti · ${nuovi.length} nuovi (${entrate} entrate, ${nuovi.length - entrate} uscite)`)
          : h("p", { class: "avviso-errore" }, "Con queste colonne non leggo nessun movimento: controlla Data e Importo."),
        lista.length > 0 && h("ul", { class: "lista-movimenti anteprima-csv" }, lista.slice(0, 5).map((m) => {
          const x = preparaMovimento(m, "csv");
          return h("li", {}, h("span", { class: "riga-testo" }, h("strong", {}, x.descrizione), h("small", {}, `${dataBreve(daChiave(m.data))} · ${x.categoria}`)),
            h("strong", { class: m.tipo === "entrata" ? "testo-verde" : "" }, `${m.tipo === "entrata" ? "+" : "−"}${euro(m.importo)}`));
        })),
        h("button", { class: "bottone-accento largo", type: "button", disabled: !nuovi.length, onclick: () => {
          const { aggiunti, doppioni } = aggiungiMovimentiImportati(lista, "csv");
          chiudiModale();
          Banca.messaggio = `Estratto conto importato: ${aggiunti} movimenti nuovi${doppioni ? `, ${doppioni} già presenti` : ""}.`;
          ridisegnaFermo();
        } }, `Importa ${nuovi.length} movimenti`),
      ].filter(Boolean));
    };
    zona.replaceChildren(
      h("div", { class: "due-campi" }, scegli("data", "Colonna della data"), scegli("descrizione", "Descrizione", true)),
      h("div", { class: "due-campi" }, scegli("importo", "Importo (con il segno)", true), scegli("uscite", "Oppure: uscite", true), scegli("entrate", "e entrate", true)),
      risultato);
    anteprima();
  });
}

// ---------- Avvio: tornando sulla pagina, controlliamo la banca (al massimo ogni 6 ore) ----------
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") aggiornaBanca(false);
});
