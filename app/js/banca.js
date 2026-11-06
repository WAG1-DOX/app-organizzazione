// ===== banca.js: banche collegate (Enable Banking) + import dell'estratto conto (CSV) =====
//
// Banche (serve la funzione Supabase "banca", vedi supabase/functions/banca):
// - ognuno configura UNA volta la sua applicazione Enable Banking (Application ID + file .pem);
// - "Collega una banca" → sito della banca → si torna qui con ?code=…&state=… → collegata;
// - i movimenti nuovi arrivano da soli (al massimo ogni 6 ore, o con "Aggiorna ora");
// - i giroconti tra due tuoi conti si vedono ma non contano nei totali.
// CSV (piano B, senza internet né Supabase): carichi il file della banca, controlli
// le colonne, e i movimenti entrano in Spese senza doppioni.

const Banca = { stato: null, caricamento: false, errore: "", avvisi: [], messaggio: "" };
const OGNI_QUANTO_BANCA = 6 * 60 * 60 * 1000;
const CHIAVE_ULTIMO_BANCA = "organizza-banca-ultimo";

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

// ---------- Indovinare la categoria dal nome del negozio ----------
const REGOLE_CATEGORIA = [
  [/esselunga|coop|conad|lidl|carrefour|eurospin|pam\b|despar|aldi|penny|iper|famila|tigre|crai|naturasi|supermerc|market|alimentari|panific|macelleria|frutta|bar\b|caff|coffee|pizz|ristor|trattoria|osteria|sushi|kebab|burger|mcdonald|kfc|starbucks|deliveroo|glovo|just ?eat|uber ?eats|gelat|pasticc|bakery|food/i, "Cibo"],
  [/trenitalia|italo|\batm\b|\batac\b|actv|\bgtt\b|tper|busitalia|flixbus|uber|bolt|free ?now|taxi|itabus|ryanair|easyjet|wizz|ita airways|benzin|carburant|\beni\b|q8|tamoil|esso|\bip\b|autostrad|telepass|parchegg|parking|mobike|lime|dott|bird|car ?sharing|enjoy|share ?now/i, "Trasporti"],
  [/netflix|spotify|disney|prime video|amazon prime|youtube|apple\.com|icloud|google (one|storage|play)|chatgpt|openai|anthropic|claude|dazn|now ?tv|sky|tim\b|vodafone|iliad|windtre|fastweb|abbonament|subscription/i, "Abbonamenti"],
  [/decathlon|palestra|gym|fitness|mcfit|virgin active|piscina|sport|padel|tennis|calcio/i, "Sport"],
  [/libreria|feltrinelli|mondadori|giunti|cartoleria|copister|universit|h-?farm|tasse|scuola|amazon.*(libr|book)/i, "Scuola"],
  [/cinema|uci|the space|steam|playstation|xbox|nintendo|zara|h&m|bershka|pull ?&? ?bear|nike|adidas|zalando|shein|vinted|amazon|concerto|ticketone|teatro|discoteca|club/i, "Svago"],
];
const REGOLE_ENTRATE = [
  [/stipend|salary|busta paga|compenso|lavoro|freelance/i, "Lavoretti"],
  [/regalo|gift|auguri|compleanno/i, "Regali"],
  [/paghetta|mamma|papa|papà|genitor/i, "Paghetta"],
];
function categoriaDaTesto(testo = "", tipo = "uscita") {
  if (tipo === "entrata") {
    const r = REGOLE_ENTRATE.find(([re]) => re.test(testo));
    return r ? r[1] : "Altro";
  }
  const disponibili = categorieUscite();
  const r = REGOLE_CATEGORIA.find(([re]) => re.test(testo));
  if (r && disponibili.includes(r[1])) return r[1];
  return disponibili.includes("Altro") ? "Altro" : disponibili[disponibili.length - 1];
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

// ---------- Mettere in Spese i movimenti arrivati (banca o CSV), senza doppioni ----------
// Doppione = stesso id (già importato o eliminato apposta), oppure stesso giorno + importo + tipo
// di un movimento scritto a mano o arrivato da un'altra fonte (es. prima dal CSV, poi dalla banca)
function eDoppione(m, fonte, esistenti, ignorati) {
  if (esistenti.has(m.id) || ignorati.has(m.id)) return true;
  return stato.movimenti.some((x) => x.fonte !== fonte && x.data === m.data && x.tipo === m.tipo && Math.abs(x.importo - m.importo) < 0.005);
}
function nuoviDa(lista, fonte) {
  const ignorati = new Set((stato.banca && stato.banca.ignorati) || []);
  const esistenti = new Set(stato.movimenti.map((m) => m.id));
  return lista.filter((m) => m && m.data && m.importo > 0 && !eDoppione(m, fonte, esistenti, ignorati));
}
function aggiungiMovimentiImportati(lista, fonte) {
  const ignorati = new Set((stato.banca && stato.banca.ignorati) || []);
  const esistenti = new Set(stato.movimenti.map((m) => m.id));
  let aggiunti = 0, doppioni = 0;
  for (const m of lista) {
    if (!m || !m.data || !(m.importo > 0)) continue;
    if (eDoppione(m, fonte, esistenti, ignorati)) { doppioni++; continue; }
    const testo = `${m.descrizione || ""} ${m.dettagli || ""}`;
    stato.movimenti.push({
      id: m.id, tipo: m.tipo, importo: m.importo, data: m.data,
      categoria: m.giroconto ? "Giroconto" : categoriaDaTesto(testo, m.tipo),
      descrizione: (m.descrizione || "Movimento").slice(0, 60),
      fonte, conto: m.conto || "", giroconto: !!m.giroconto,
    });
    esistenti.add(m.id);
    aggiunti++;
  }
  if (aggiunti) aggiorna();
  return { aggiunti, doppioni };
}

// ---------- Banche: stato e aggiornamento ----------
async function caricaStatoBanca() {
  try {
    Banca.stato = await chiamaBanca("stato");
    Banca.errore = "";
    if (Banca.stato.chiave && !stato.banca.attiva) { stato.banca.attiva = true; salva(); }
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
    if (Banca.stato && Banca.stato.collegamenti.length) {
      const r = await chiamaBanca("movimenti");
      const { aggiunti } = aggiungiMovimentiImportati(r.movimenti || [], "banca");
      Banca.avvisi = r.avvisi || [];
      Banca.messaggio = aggiunti ? `${aggiunti} movimenti nuovi dalla banca` : "Nessun movimento nuovo";
      try { localStorage.setItem(CHIAVE_ULTIMO_BANCA, String(Date.now())); } catch (e) {}
      await caricaStatoBanca(); // per l'ora dell'ultimo aggiornamento
    }
  } catch (e) {
    Banca.errore = e.message;
  } finally {
    Banca.caricamento = false;
    ridisegnaSpeseSeAperte();
  }
}

function ridisegnaSpeseSeAperte() {
  if ((location.hash || "").replace("#", "") === "spese" && !document.getElementById("modale").classList.contains("aperta")) ridisegnaFermo();
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
      Banca.messaggio = `${r.banca} collegata ✓ (${r.conti} cont${r.conti === 1 ? "o" : "i"})`;
      Banca.errore = "";
      await aggiornaBanca(true);
    } catch (e) {
      Banca.errore = e.message;
    }
  }
  disegna();
}

// ---------- Finestre ----------
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
        stato.banca.attiva = true;
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
      h("p", { class: "testo-leggero piccolo" }, "La chiave va cifrata su Supabase e non torna più indietro: nell'app non resta salvata, e nessuno la può leggere."),
      bottone, messaggio));
}

const PAESI_BANCA = [["IT", "Italia"], ["LT", "Lituania (Revolut)"], ["DE", "Germania (N26…)"], ["FR", "Francia"], ["ES", "Spagna"], ["NL", "Paesi Bassi"], ["IE", "Irlanda"], ["BE", "Belgio"], ["AT", "Austria"]];

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
    h("p", { class: "testo-leggero" }, "Scegli la banca: ti porto sul suo sito, fai il login e confermi. Poi torni qui da solo. L'app può solo LEGGERE i movimenti, non spostare soldi."),
    h("div", { class: "due-campi" }, campo("Paese", paese), campo("Banca", cerca)),
    elenco, messaggio, vai);
  carica();
}

// ---------- Pannello "Banche collegate" (in Spese) ----------
function pannelloBanche() {
  const st = Banca.stato;
  if (st === null && !Banca.caricamento && !Banca.errore && typeof utenteSupabase !== "undefined" && utenteSupabase) {
    Banca.caricamento = true;
    caricaStatoBanca().finally(() => { Banca.caricamento = false; ridisegnaSpeseSeAperte(); });
  }
  const quando = (iso) => {
    if (!iso) return "mai";
    const min = Math.round((Date.now() - new Date(iso)) / 60000);
    if (min < 1) return "adesso";
    if (min < 60) return `${min} min fa`;
    if (min < 1440) return `${Math.round(min / 60)} h fa`;
    return dataBreve(new Date(iso));
  };

  const righe = st && st.collegamenti ? st.collegamenti.map((c) => {
    const giorniAllaScadenza = c.valido_fino ? Math.floor((new Date(c.valido_fino) - Date.now()) / 86400000) : null;
    return h("li", { class: "riga-banca" },
      h("span", { class: "cerchio-icona" }, icona("portafoglio", 16)),
      h("span", { class: "riga-testo" },
        h("strong", {}, c.banca),
        h("small", {}, c.conti.map((x) => `${x.nome}${x.iban_finale ? ` ••${x.iban_finale}` : ""}`).join(" · ")),
        h("small", { class: giorniAllaScadenza !== null && giorniAllaScadenza < 14 ? "testo-rosso" : "" },
          `Aggiornata ${quando(c.ultimo_aggiornamento)}`,
          giorniAllaScadenza !== null && (giorniAllaScadenza < 0 ? " · permesso scaduto: ricollegala" : ` · permesso fino al ${dataBreve(new Date(c.valido_fino))}`))),
      h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": `Scollega ${c.banca}`, title: "Scollega", onclick: async () => {
        if (!confirm(`Scollegare ${c.banca}? I movimenti già importati restano.`)) return;
        try { await chiamaBanca("scollega", { id: c.id }); await caricaStatoBanca(); } catch (e) { Banca.errore = e.message; }
        ridisegnaFermo();
      } }, icona("x", 14)));
  }) : [];

  const sottotitolo = Banca.caricamento ? h("span", { class: "pill" }, "aggiorno…")
    : st && st.chiave ? h("button", { class: "pill", type: "button", onclick: () => aggiornaBanca(true) }, icona("sync", 12), " Aggiorna ora") : null;

  return pannello("", "Banche collegate", sottotitolo,
    Banca.messaggio && h("p", { class: "avviso-ok" }, Banca.messaggio),
    Banca.errore && h("p", { class: "avviso-errore" }, Banca.errore),
    ...Banca.avvisi.map((a) => h("p", { class: "avviso-errore piccolo" }, a)),
    st && !st.chiave && h("p", { class: "testo-leggero" }, "Collega Revolut, Fineco, Fideuram… e i movimenti arrivano da soli, entrate comprese. Gratis, con Enable Banking."),
    righe.length ? h("ul", { class: "lista-movimenti" }, righe) : (st && st.chiave && h("p", { class: "vuoto" }, "Nessuna banca collegata")),
    h("div", { class: "azioni-banca" },
      st && !st.chiave && h("button", { class: "bottone-accento", type: "button", onclick: apriConfiguraBanca }, "Configura Enable Banking"),
      st && st.chiave && h("button", { class: "bottone-accento", type: "button", onclick: apriCollegaBanca }, icona("piu", 14), "Collega una banca"),
      h("button", { class: "bottone-secondario", type: "button", onclick: apriImportCsv }, icona("scontrino", 14), "Importa estratto conto (CSV)")));
}

// ---------- Cambiare la categoria di un movimento (utile per quelli arrivati dalla banca) ----------
function apriCategoriaMovimento(m) {
  const elenco = m.tipo === "entrata" ? categorieEntrate : [...categorieUscite(), "Giroconto"];
  const scelta = h("select", {}, elenco.map((c) => h("option", { value: c, selected: c === m.categoria }, c)));
  const giro = h("input", { type: "checkbox", checked: !!m.giroconto });
  apriModale("Categoria",
    h("p", { class: "testo-leggero" }, `${m.descrizione} · ${euro(m.importo)} · ${dataBreve(daChiave(m.data))}${m.conto ? ` · ${m.conto}` : ""}`),
    h("div", { class: "modulo" },
      campo("Categoria", scelta),
      h("label", { class: "spunta-riga" }, giro, h("span", {}, "È un giroconto tra miei conti (non conta nei totali)")),
      h("button", { class: "bottone-accento largo", type: "button", onclick: () => {
        m.categoria = scelta.value;
        m.giroconto = giro.checked || scelta.value === "Giroconto";
        if (m.giroconto) m.categoria = "Giroconto";
        chiudiModale();
        aggiorna();
      } }, "Salva")));
}

// Eliminando un movimento arrivato dalla banca o dal CSV ce lo segniamo, così non torna più
function ricordaEliminato(m) {
  if (!m.fonte) return;
  stato.banca.ignorati = [...(stato.banca.ignorati || []), m.id].slice(-3000);
}

// =====================================================================
// IMPORT DELL'ESTRATTO CONTO (CSV)
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
      risultato.replaceChildren(
        lista.length
          ? h("p", { class: "testo-leggero" }, `${lista.length} movimenti letti · ${nuovi.length} nuovi (${entrate} entrate, ${nuovi.length - entrate} uscite)`)
          : h("p", { class: "avviso-errore" }, "Con queste colonne non leggo nessun movimento: controlla Data e Importo."),
        lista.length > 0 && h("ul", { class: "lista-movimenti anteprima-csv" }, lista.slice(0, 5).map((m) =>
          h("li", {}, h("span", { class: "riga-testo" }, h("strong", {}, m.descrizione), h("small", {}, `${dataBreve(daChiave(m.data))} · ${categoriaDaTesto(m.descrizione, m.tipo)}`)),
            h("strong", { class: m.tipo === "entrata" ? "testo-verde" : "" }, `${m.tipo === "entrata" ? "+" : "−"}${euro(m.importo)}`)))),
        h("button", { class: "bottone-accento largo", type: "button", disabled: !nuovi.length, onclick: () => {
          const { aggiunti, doppioni } = aggiungiMovimentiImportati(lista, "csv");
          chiudiModale();
          Banca.messaggio = `Estratto conto importato: ${aggiunti} movimenti nuovi${doppioni ? `, ${doppioni} già presenti` : ""}.`;
          ridisegnaFermo();
        } }, `Importa ${nuovi.length} movimenti`));
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
