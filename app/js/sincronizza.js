// ===== sincronizza.js: i dati dell'app salvati su Supabase =====
//
// Come funziona (in breve):
// - Il browser tiene sempre una copia (localStorage): l'app resta veloce e va anche senza internet.
// - Dopo il login scarichiamo i tuoi dati da Supabase: comandano quelli del database.
// - Ogni volta che l'app salva (salva() in base.js), dopo un attimo mandiamo a Supabase
//   SOLO quello che è cambiato:
//     · gli eventi vanno nella tabella `eventi` (una riga per evento);
//     · tutto il resto va in `dati_personali` (una riga per "chiave": movimenti, sonno, …).
// - La prima volta che entri con un account nuovo (database vuoto) carichiamo su Supabase
//   quello che c'è in questo browser.
// - Quando torni sulla pagina (es. dopo aver usato il telefono) riscarichiamo i dati.

// stato dell'app → chiave nella tabella dati_personali (i nomi sono quelli di app/tabelle-nuove.md)
const CHIAVI_CLOUD = {
  materie: "materie", orario: "orario", quotidiane: "quotidiane", registro: "registro",
  modelliExtra: "modelli_extra", promemoria: "promemoria", movimenti: "movimenti", budget: "budget",
  scontrini: "scontrini", listaSpesa: "lista_spesa", acqua: "acqua", pasti: "pasti",
  regoleMail: "regole_mail", microModelli: "micro_modelli", routineBase: "routine_base",
  giornate: "giornate", obiettivi: "obiettivi_settimana", sonno: "sonno",
  categorieObiettivi: "categorie_obiettivi", obiettiviLungo: "obiettivi_lungo",
};
// di Google salviamo solo le scelte (Client ID e calendari da mostrare), non il permesso
const CHIAVE_GOOGLE = "google_impostazioni";
const TIPI_EVENTO = ["scuola", "produttivita", "allenamento", "impegno", "altro"];
const CHIAVE_PROPRIETARIO = "organizza-utente"; // di chi sono i dati salvati in questo browser

const Cloud = {
  attivo: false,        // true quando i dati sono stati scaricati e possiamo mandare modifiche
  timer: null,
  invioInCorso: null,   // la "promessa" dell'invio in corso (per aspettarlo)
  ancora: false,        // altre modifiche arrivate durante un invio
  eventiInviati: new Map(), // uuid → riga così come è sul database (in testo)
  datiInviati: new Map(),   // chiave → valore così come è sul database (in testo)
  ultimoCaricamento: 0,
};

// ---------- Id: l'app usa id come "e-abc123", il database vuole un uuid ----------
// Trasformiamo ogni id dell'app in un uuid, sempre lo stesso per lo stesso id (con SHA-256).
// Nel calcolo mettiamo anche l'id dell'account: così l'evento "e1" di Luca e l'"e1" di Edoardo
// (es. gli eventi di esempio, uguali in ogni browser) diventano due righe diverse.
// Senza, il secondo che salva verrebbe bloccato dalla sicurezza (sembrerebbe modificare l'evento dell'altro).
const FORMA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cacheUuid = new Map();
async function uuidDi(id) {
  id = String(id);
  if (FORMA_UUID.test(id)) return id.toLowerCase();
  const chiave = `${mioId() || ""}|${id}`;
  if (cacheUuid.has(chiave)) return cacheUuid.get(chiave);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chiave)));
  hash[6] = (hash[6] & 0x0f) | 0x50; // "versione 5": è un uuid valido
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const x = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const u = `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
  cacheUuid.set(chiave, u);
  return u;
}

// ---------- Evento dell'app ↔ riga della tabella eventi ----------
const mioId = () => utenteSupabase && utenteSupabase.id;
// Gli eventi degli amici (arrivati da un gruppo) li leggiamo ma non li riscriviamo
const eMio = (e) => !FORMA_UUID.test(String(e.proprietario_id || "")) || e.proprietario_id === mioId();

const dataValida = (x) => x && !isNaN(new Date(x));

async function versoCloud(e) {
  const inizio = new Date(e.inizio), fine = new Date(e.fine);
  const creato = dataValida(e.creato_il) ? new Date(e.creato_il) : new Date();
  return {
    id: await uuidDi(e.id),
    titolo: String(e.titolo || "").trim() || "(senza titolo)",
    descrizione: e.descrizione || "",
    tipo: TIPI_EVENTO.includes(e.tipo) ? e.tipo : "altro",
    inizio: inizio.toISOString(),
    fine: (fine >= inizio ? fine : inizio).toISOString(), // il database non accetta fine prima dell'inizio
    tutto_il_giorno: !!e.tutto_il_giorno,
    proprietario_id: mioId(),
    // i gruppi finti (es. "g-classe") non esistono nel database: per ora l'evento resta privato
    gruppo_id: FORMA_UUID.test(String(e.gruppo_id || "")) ? e.gruppo_id : null,
    completato: !!e.completato,
    creato_il: creato.toISOString(),
    luogo: e.luogo || "",
    colore: e.colore_scelto || null,
    google_id: e.google_id || null,
    google_calendario: e.google_cal || null,
  };
}

// Riga del database → evento dell'app. Se questo browser ha già l'evento, teniamo
// il suo id e i dettagli che il database non salva (es. link di Google, colore del calendario).
function daCloud(r, locale) {
  const e = {
    ...(locale || {}),
    id: locale ? locale.id : r.id,
    titolo: r.titolo, descrizione: r.descrizione || "", tipo: r.tipo,
    inizio: isoLocale(new Date(r.inizio)), fine: isoLocale(new Date(r.fine)),
    tutto_il_giorno: r.tutto_il_giorno, proprietario_id: r.proprietario_id, gruppo_id: r.gruppo_id,
    completato: r.completato, creato_il: r.creato_il, luogo: r.luogo || "",
    colore_scelto: r.colore || null,
  };
  if (r.google_id) e.google_id = r.google_id; else delete e.google_id;
  if (r.google_calendario) e.google_cal = r.google_calendario; else delete e.google_cal;
  return e;
}

// ---------- Indicatore in alto ("Salvato" / "Salvataggio…" / errore) ----------
function statoCloud(testo, classe = "") {
  const el = document.getElementById("stato-cloud");
  if (!el) return;
  el.textContent = testo;
  el.className = `stato-cloud ${classe}`;
}

// ---------- Scaricare ----------
async function leggiTuttiGliEventi() {
  const tutti = [];
  for (let da = 0; ; da += 1000) { // Supabase dà al massimo 1000 righe per volta
    const { data, error } = await sb.from("eventi").select("*").order("id").range(da, da + 999);
    if (error) throw error;
    tutti.push(...data);
    if (data.length < 1000) return tutti;
  }
}

async function scaricaDalCloud() {
  const [eventi, dati] = await Promise.all([
    leggiTuttiGliEventi(),
    sb.from("dati_personali").select("chiave, valore").then(({ data, error }) => { if (error) throw error; return data; }),
  ]);
  return { eventi, dati };
}

// Mette i dati scaricati dentro "stato" e si ricorda cosa c'è sul database.
// iniziale = true all'apertura: comanda solo il database (nel browser potrebbero esserci dati vecchi o finti).
async function applicaDalCloud({ eventi, dati }, iniziale = false) {
  // eventi: ritroviamo quelli che questo browser conosce già (stesso uuid)
  const locali = new Map();
  for (const e of stato.eventi) locali.set(await uuidDi(e.id), e);
  const sulDatabase = new Set(eventi.map((r) => r.id));
  const nuovi = eventi.map((r) => daCloud(r, locali.get(r.id)));
  // durante l'uso: eventi creati qui e non ancora arrivati al database li teniamo
  if (!iniziale) {
    for (const [u, e] of locali) {
      if (!sulDatabase.has(u) && !Cloud.eventiInviati.has(u) && eMio(e)) nuovi.push(e);
    }
  }
  stato.eventi = nuovi;

  // tutto il resto
  const perChiave = new Map(dati.map((d) => [d.chiave, d.valore]));
  for (const [campo, chiave] of Object.entries(CHIAVI_CLOUD)) {
    if (perChiave.has(chiave)) stato[campo] = perChiave.get(chiave);
  }
  if (perChiave.has(CHIAVE_GOOGLE)) Object.assign(stato.google, perChiave.get(CHIAVE_GOOGLE));

  // memoria di "cosa c'è sul database", per mandare dopo solo le differenze
  Cloud.eventiInviati.clear();
  for (const r of eventi) {
    const e = stato.eventi.find((x) => x.id === (locali.get(r.id) || r).id);
    if (e && eMio(e)) Cloud.eventiInviati.set(r.id, JSON.stringify(await versoCloud(e)));
  }
  Cloud.datiInviati = new Map(dati.map((d) => [d.chiave, JSON.stringify(d.valore)]));
  Cloud.ultimoCaricamento = Date.now();
  try { localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(stato)); } catch (e) {}
}

// Da chiamare dopo il login, prima di disegnare l'app
async function avviaCloud() {
  if (!sb || !utenteSupabase) return; // "continua senza account": solo browser
  statoCloud("Scarico i tuoi dati…");
  try {
    // i dati di questo browser sono di un altro account? Allora non li usiamo
    let proprietario = null;
    try { proprietario = localStorage.getItem(CHIAVE_PROPRIETARIO); } catch (e) {}
    if (proprietario && proprietario !== mioId()) Object.assign(stato, statoIniziale());
    try { localStorage.setItem(CHIAVE_PROPRIETARIO, mioId()); } catch (e) {}

    const cloud = await scaricaDalCloud();
    const vuoto = !cloud.eventi.length && !cloud.dati.length;
    if (vuoto) {
      // primo accesso: il database è vuoto, ci carichiamo quello che c'è in questo browser
      Cloud.eventiInviati.clear();
      Cloud.datiInviati.clear();
      Cloud.ultimoCaricamento = Date.now();
    } else {
      await applicaDalCloud(cloud, true);
    }
    Cloud.attivo = true;
    // "Ricomincia da capo" riporterebbe i dati finti anche sul database: con l'account lo nascondiamo
    const reset = document.getElementById("bottone-reset");
    if (reset) reset.hidden = true;
    if (vuoto) await inviaAlCloud();
    else statoCloud("Salvato", "ok");
  } catch (e) {
    // se non riusciamo a scaricare NON mandiamo niente: rischieremmo di sovrascrivere il database
    console.warn("Supabase: dati non scaricati", e && e.message);
    statoCloud("Non collegato al database: le modifiche restano su questo computer", "errore");
  }
}

// ---------- Mandare le modifiche ----------
function programmaInvio() {
  if (!Cloud.attivo) return;
  statoCloud("Salvataggio…");
  clearTimeout(Cloud.timer);
  Cloud.timer = setTimeout(inviaAlCloud, 800); // aspettiamo un attimo: se cambi tante cose di fila, un invio solo
}

async function inviaAlCloud() {
  if (!Cloud.attivo) return;
  clearTimeout(Cloud.timer);
  Cloud.timer = null;
  if (Cloud.invioInCorso) { Cloud.ancora = true; return Cloud.invioInCorso; }
  Cloud.invioInCorso = (async () => {
    try {
      // 1. eventi nuovi o cambiati
      const daMandare = [], visti = new Set();
      for (const e of stato.eventi) {
        if (!eMio(e) || !dataValida(e.inizio) || !dataValida(e.fine)) continue;
        const riga = await versoCloud(e);
        if (visti.has(riga.id)) continue; // due eventi con lo stesso id: ne mandiamo uno
        visti.add(riga.id);
        const testo = JSON.stringify(riga);
        if (Cloud.eventiInviati.get(riga.id) !== testo) daMandare.push([riga, testo]);
      }
      for (let i = 0; i < daMandare.length; i += 500) {
        const pezzo = daMandare.slice(i, i + 500);
        const { error } = await sb.from("eventi").upsert(pezzo.map(([r]) => r));
        if (error) throw error;
        for (const [r, t] of pezzo) Cloud.eventiInviati.set(r.id, t);
      }
      // 2. eventi eliminati nell'app
      const daTogliere = [...Cloud.eventiInviati.keys()].filter((u) => !visti.has(u));
      for (let i = 0; i < daTogliere.length; i += 200) {
        const pezzo = daTogliere.slice(i, i + 200);
        const { error } = await sb.from("eventi").delete().in("id", pezzo);
        if (error) throw error;
        for (const u of pezzo) Cloud.eventiInviati.delete(u);
      }
      // 3. tutto il resto (solo le chiavi cambiate)
      const valori = Object.entries(CHIAVI_CLOUD).map(([campo, chiave]) => [chiave, stato[campo]]);
      valori.push([CHIAVE_GOOGLE, { clientId: stato.google.clientId || "", calendari: stato.google.calendari || [] }]);
      const righe = valori
        .filter(([, v]) => v !== undefined)
        .map(([chiave, valore]) => ({ chiave, valore, testo: JSON.stringify(valore) }))
        .filter((r) => Cloud.datiInviati.get(r.chiave) !== r.testo);
      if (righe.length) {
        const adesso = new Date().toISOString();
        const { error } = await sb.from("dati_personali").upsert(
          righe.map((r) => ({ utente_id: mioId(), chiave: r.chiave, valore: r.valore, aggiornato_il: adesso })));
        if (error) throw error;
        for (const r of righe) Cloud.datiInviati.set(r.chiave, r.testo);
      }
      statoCloud("Salvato", "ok");
    } catch (e) {
      console.warn("Supabase: modifiche non salvate", e && e.message);
      statoCloud("Non salvato sul database: riprovo alla prossima modifica", "errore");
    }
  })();
  try { await Cloud.invioInCorso; }
  finally {
    Cloud.invioInCorso = null;
    if (Cloud.ancora) { Cloud.ancora = false; await inviaAlCloud(); }
  }
}

// ---------- Tornando sulla pagina: riscarichiamo (magari hai cambiato qualcosa dal telefono) ----------
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !Cloud.attivo) return;
  if (Date.now() - Cloud.ultimoCaricamento < 30 * 1000) return;
  const scrivendo = document.activeElement && document.activeElement.matches("input, select, textarea");
  const finestraAperta = document.getElementById("modale").classList.contains("aperta");
  if (scrivendo || finestraAperta) return;
  try {
    await inviaAlCloud(); // prima mandiamo quello che manca, poi scarichiamo
    if (Cloud.timer || Cloud.invioInCorso) return;
    await applicaDalCloud(await scaricaDalCloud());
    const scroll = window.scrollY;
    disegna();
    window.scrollTo(0, scroll);
  } catch (e) { /* niente internet: teniamo quello che abbiamo */ }
});

// Chiudendo la pagina con modifiche non ancora mandate, il browser chiede conferma
window.addEventListener("beforeunload", (ev) => {
  if (Cloud.attivo && (Cloud.timer || Cloud.invioInCorso)) { inviaAlCloud(); ev.preventDefault(); ev.returnValue = ""; }
});
