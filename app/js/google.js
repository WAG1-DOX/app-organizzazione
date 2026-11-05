// ===== google.js: sincronizzazione con Google Calendar =====
//
// Come funziona:
// - Ognuno (Luca, Edoardo) collega il PROPRIO account Google dal proprio browser.
// - L'app legge TUTTI i calendari dell'account (personale, Canvas importato, ecc.),
//   ognuno con il suo colore, come sul telefono. Puoi scegliere quali mostrare.
// - Ogni 30 secondi (e quando torni sulla pagina) controlla se è cambiato qualcosa.
// - I calendari in abbonamento (es. Canvas) sono di sola lettura: li aggiorna Google
//   da solo, ogni qualche ora. Qui li vedi appena li vede anche il telefono.
// - Gli eventi che crei nell'app vanno nel tuo calendario principale.
// - Serve un "Client ID" di Google (gratis, pubblico: non è una chiave segreta).
//
// Limite di questa prima versione: il permesso di Google dura circa 1 ora e ogni volta che
// riapri l'app devi toccare "Collega". Quando c'è Supabase lo spostiamo lì e diventa automatico.

const SCOPE_CALENDARIO = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly", // vedere l'elenco dei calendari
  "https://www.googleapis.com/auth/calendar.events",                // leggere e scrivere gli eventi
].join(" ");
const API_CALENDARIO = "https://www.googleapis.com/calendar/v3";
const OGNI_QUANTO_SYNC = 30 * 1000;

const Google = { token: null, scadenza: 0, stato: "spento", errore: "", timer: null, inCorso: false, daRidisegnare: false };

const urlEventi = (calId) => `${API_CALENDARIO}/calendars/${encodeURIComponent(calId)}/events`;
const calendariGoogle = () => stato.google.calendari || [];
const calendarioDi = (id) => calendariGoogle().find((c) => c.id === id);
const idPrincipale = () => (calendariGoogle().find((c) => c.principale) || {}).id || "primary";

function quandoFa(iso) {
  if (!iso) return "mai";
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  return oraDi(new Date(iso));
}

function statoGoogle() {
  if (Google.stato === "attivo") return { testo: `Google · aggiornato ${quandoFa(stato.google.ultimoSync)}`, classe: "attiva" };
  if (Google.stato === "collegamento") return { testo: "Collegamento a Google…", classe: "" };
  if (Google.stato === "errore") return { testo: "Google: da ricollegare", classe: "pericolo" };
  return { testo: stato.google.clientId ? "Collega Google Calendar" : "Google Calendar", classe: "" };
}

// ---------- Permesso (token) da Google ----------
function caricaScriptGoogle() {
  return new Promise((ok, ko) => {
    if (window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = ok;
    s.onerror = () => ko(new Error("Non riesco a caricare Google (sei connesso a internet?)"));
    document.head.append(s);
  });
}

async function chiediToken(conFinestra) {
  await caricaScriptGoogle();
  return new Promise((ok, ko) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: stato.google.clientId,
      scope: SCOPE_CALENDARIO,
      callback: (r) => {
        if (r.error) return ko(new Error(r.error_description || r.error));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...SCOPE_CALENDARIO.split(" "))) {
          return ko(new Error("Nella finestra di Google devi spuntare tutti i permessi del calendario"));
        }
        Google.token = r.access_token;
        Google.scadenza = Date.now() + (Number(r.expires_in) - 60) * 1000;
        ok();
      },
      error_callback: (e) => ko(new Error(e.type === "popup_closed" ? "Finestra di Google chiusa" : e.message || e.type || "Google ha rifiutato")),
    });
    // la prima volta (o dopo "Scollega") Google ti fa scegliere l'account e confermare i permessi
    client.requestAccessToken({ prompt: conFinestra ? "select_account consent" : "" });
  });
}

async function chiamaGoogle(metodo, url, corpo) {
  if (!Google.token || Date.now() > Google.scadenza) throw new Error("Permesso di Google scaduto: tocca Collega");
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${Google.token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 401) { Google.token = null; throw new Error("Permesso di Google scaduto: tocca Collega"); }
  if (metodo === "DELETE" && (r.status === 404 || r.status === 410)) return null; // già eliminato
  if (!r.ok) throw new Error(`Google ha risposto con un errore (${r.status})`);
  return r.status === 204 ? null : r.json();
}

// Legge tutte le pagine di una lista di Google
async function leggiTutto(url, parametri = {}) {
  const tutti = [];
  let pagina = null;
  do {
    const q = new URLSearchParams(parametri);
    if (pagina) q.set("pageToken", pagina);
    const r = await chiamaGoogle("GET", `${url}?${q}`);
    tutti.push(...(r.items || []));
    pagina = r.nextPageToken;
  } while (pagina);
  return tutti;
}

// ---------- Da Google all'app ----------
const hexDaColorId = (id) => (COLORI_EVENTO.find((c) => c.id === String(id)) || {}).hex || null;
const colorIdDaHex = (hex) => (COLORI_EVENTO.find((c) => c.hex === hex) || {}).id || null;

function indovinaTipo(titolo = "", calendario) {
  const t = titolo.toLowerCase();
  if (/studi|ripass|study|lavoro|progett|compiti|homework|focus|deep work/.test(t)) return "produttivita";
  if (/allenament|palestra|gym|calcio|corsa|nuoto|partita|workout/.test(t)) return "allenamento";
  if (/esame|exam|midterm|final|quiz|verifica|test|assignment|consegna|deadline/.test(t)) return "scuola";
  if (calendario && /canvas|universit|lezion|course|corso/i.test(calendario.nome)) return "scuola";
  return "impegno";
}

// Aggiorna l'elenco dei calendari, mantenendo le spunte "mostra" già scelte
async function aggiornaElencoCalendari() {
  const lista = await leggiTutto(`${API_CALENDARIO}/users/me/calendarList`, { minAccessRole: "reader" });
  const prima = calendariGoogle();
  stato.google.calendari = lista.map((c) => {
    const vecchio = prima.find((p) => p.id === c.id);
    return {
      id: c.id,
      nome: c.summaryOverride || c.summary || c.id,
      colore: c.backgroundColor || "#8ab4f8",
      principale: !!c.primary,
      solaLettura: !["owner", "writer"].includes(c.accessRole),
      // all'inizio mostriamo quelli che sono spuntati anche su Google
      attivo: vecchio ? vecchio.attivo : c.selected !== false,
      // calendari della scuola (H-Farm, Canvas…): i loro eventi diventano "scuola", gialli e nella sezione Lezioni
      scuola: vecchio && vecchio.scuola !== undefined ? vecchio.scuola : /h-?farm|canvas|universit|college|lezion|school|course|corso/i.test(c.summaryOverride || c.summary || ""),
    };
  });
}

function daGoogle(g, cal, esistente) {
  const tuttoIlGiorno = !!g.start.date;
  const inizio = tuttoIlGiorno ? isoLocale(daChiave(g.start.date)) : g.start.dateTime;
  const fine = tuttoIlGiorno ? isoLocale(new Date(daChiave(g.end.date).getTime() - 60000)) : g.end.dateTime;
  return {
    ...(esistente || {}),
    id: esistente ? esistente.id : `g-${cal.id}-${g.id}`,
    titolo: (g.summary || "(senza titolo)").trim(),
    descrizione: testoDaHtml(g.description),
    luogo: g.location || "",
    link_google: g.htmlLink || "",
    link_videochiamata: g.hangoutLink || ((g.conferenceData && g.conferenceData.entryPoints || []).find((p) => p.entryPointType === "video") || {}).uri || "",
    tipo: cal.scuola ? "scuola" : (esistente && esistente.tipo !== "scuola" ? esistente.tipo : indovinaTipo(g.summary, cal)),
    // colore scelto per l'evento: per i tuoi calendari comanda Google, per quelli in sola lettura resta il tuo
    colore_scelto: cal.solaLettura ? (esistente ? esistente.colore_scelto : null) : (g.colorId ? hexDaColorId(g.colorId) : null),
    inizio, fine, tutto_il_giorno: tuttoIlGiorno,
    proprietario_id: utenteAttuale.id,
    gruppo_id: esistente ? esistente.gruppo_id : null,
    completato: false,
    creato_il: g.created || isoLocale(new Date()),
    google_id: g.id,
    google_cal: cal.id,
    colore: cal.colore,
    sola_lettura: cal.solaLettura,
  };
}

async function sincronizzaGoogle() {
  if (Google.inCorso || !Google.token) return;
  Google.inCorso = true;
  try {
    await aggiornaElencoCalendari();
    const dal = aggiungiGiorni(new Date(), -60), al = aggiungiGiorni(new Date(), 180);
    const prima = JSON.stringify(stato.eventi);
    const attivi = calendariGoogle().filter((c) => c.attivo);
    const visti = new Set();

    for (const cal of attivi) {
      const eventi = await leggiTutto(urlEventi(cal.id), {
        singleEvents: "true", orderBy: "startTime", timeMin: dal.toISOString(), timeMax: al.toISOString(), maxResults: "2500",
      });
      for (const g of eventi) {
        if (g.status === "cancelled" || !g.start) continue;
        const chiave = `${cal.id}|${g.id}`;
        visti.add(chiave);
        const esistente = stato.eventi.find((e) => e.google_id === g.id && (e.google_cal === cal.id || !e.google_cal));
        const evento = daGoogle(g, cal, esistente);
        if (esistente) Object.assign(esistente, evento);
        else stato.eventi.push(evento);
      }
    }

    // togliamo dall'app: eventi cancellati su Google e eventi dei calendari nascosti
    const idAttivi = new Set(attivi.map((c) => c.id));
    stato.eventi = stato.eventi.filter((e) => {
      if (!e.google_id || !e.google_cal) return true;
      if (!idAttivi.has(e.google_cal)) return false;
      const fuoriPeriodo = new Date(e.inizio) < dal || new Date(e.inizio) > al;
      return fuoriPeriodo || visti.has(`${e.google_cal}|${e.google_id}`);
    });

    stato.google.ultimoSync = new Date().toISOString();
    Google.stato = "attivo";
    Google.errore = "";
    salva();
    if (JSON.stringify(stato.eventi) !== prima) Google.daRidisegnare = true;
  } catch (e) {
    Google.stato = "errore";
    Google.errore = e.message;
    Google.daRidisegnare = true;
  } finally {
    Google.inCorso = false;
    ridisegnaSeServe();
  }
}

// Ridisegna, ma non mentre stai scrivendo in un campo (perderesti quello che scrivi)
function ridisegnaSeServe() {
  const scrivendo = document.activeElement && document.activeElement.matches("input, select, textarea");
  const finestraAperta = document.getElementById("modale").classList.contains("aperta");
  if (scrivendo || finestraAperta) return;
  if (Google.daRidisegnare || sezioneAttuale().id === "calendario") {
    Google.daRidisegnare = false;
    const scroll = window.scrollY;
    disegna();
    window.scrollTo(0, scroll);
  }
}

// ---------- Dall'app a Google ----------
function versoGoogle(e) {
  const corpo = { summary: e.titolo, location: e.luogo || "" };
  // la descrizione la mandiamo solo se è nuova o l'hai cambiata tu:
  // così non roviniamo la formattazione (grassetti, link…) di quelle scritte su Google
  if (!e.google_id || e.descrizione_cambiata) corpo.description = e.descrizione || "";
  if (!e.google_id || e.colore_cambiato) corpo.colorId = e.colore_scelto ? colorIdDaHex(e.colore_scelto) : null;
  if (e.tutto_il_giorno) {
    corpo.start = { date: chiaveGiorno(new Date(e.inizio)) };
    corpo.end = { date: chiaveGiorno(aggiungiGiorni(new Date(e.inizio), 1)) };
  } else {
    corpo.start = { dateTime: e.inizio };
    corpo.end = { dateTime: e.fine };
  }
  return corpo;
}

async function inviaAGoogle(evento) {
  if (Google.stato !== "attivo" || evento.sola_lettura) return;
  try {
    if (evento.google_id) {
      await chiamaGoogle("PATCH", `${urlEventi(evento.google_cal || "primary")}/${encodeURIComponent(evento.google_id)}`, versoGoogle(evento));
      const e = stato.eventi.find((x) => x.id === evento.id);
      if (e && (e.descrizione_cambiata || e.colore_cambiato)) { delete e.descrizione_cambiata; delete e.colore_cambiato; salva(); }
    } else {
      const cal = calendarioDi(idPrincipale());
      const creato = await chiamaGoogle("POST", urlEventi(idPrincipale()), versoGoogle(evento));
      const e = stato.eventi.find((x) => x.id === evento.id);
      if (e) {
        Object.assign(e, { google_id: creato.id, google_cal: idPrincipale(), colore: cal ? cal.colore : undefined });
        salva();
      }
    }
  } catch (err) {
    Google.stato = "errore";
    Google.errore = `Non sono riuscito a salvare «${evento.titolo}» su Google: ${err.message}`;
    Google.daRidisegnare = true;
    ridisegnaSeServe();
  }
}

async function eliminaDaGoogle(evento) {
  if (Google.stato !== "attivo" || !evento.google_id || evento.sola_lettura) return;
  try { await chiamaGoogle("DELETE", `${urlEventi(evento.google_cal || "primary")}/${encodeURIComponent(evento.google_id)}`); }
  catch (err) { Google.stato = "errore"; Google.errore = err.message; Google.daRidisegnare = true; ridisegnaSeServe(); }
}

// ---------- Collegare / scollegare ----------
async function collegaGoogle() {
  Google.stato = "collegamento";
  chiudiModale();
  disegna();
  try {
    await chiediToken(!stato.google.collegato);
    stato.google.collegato = true;
    salva();
    Google.stato = "attivo";
    await sincronizzaGoogle();
    clearInterval(Google.timer);
    Google.timer = setInterval(() => { if (document.visibilityState === "visible") sincronizzaGoogle(); }, OGNI_QUANTO_SYNC);
  } catch (e) {
    Google.stato = "errore";
    Google.errore = e.message;
  }
  Google.daRidisegnare = true;
  ridisegnaSeServe();
}

function scollegaGoogle() {
  if (Google.token && window.google) google.accounts.oauth2.revoke(Google.token, () => {});
  clearInterval(Google.timer);
  Google.token = null;
  Google.stato = "spento";
  stato.google.collegato = false;
  stato.google.calendari = [];   // al prossimo collegamento (magari con un altro account) si ricaricano
  // togliamo dall'app gli eventi che arrivavano da Google (su Google restano)
  stato.eventi = stato.eventi.filter((e) => !e.google_id || !String(e.id).startsWith("g-"));
  // gli eventi creati qui restano, ma non più legati al vecchio account
  for (const e of stato.eventi) { delete e.google_id; delete e.google_cal; delete e.colore; delete e.sola_lettura; }
  chiudiModale();
  aggiorna();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Google.stato === "attivo") sincronizzaGoogle();
});

// ---------- Finestra "Google Calendar" ----------
function apriPannelloGoogle() {
  const g = stato.google;
  const clientId = h("input", { type: "text", value: g.clientId, placeholder: "123456789-abc….apps.googleusercontent.com", required: true });

  if (!g.clientId) {
    apriModale("Collega Google Calendar",
      h("p", { class: "testo-leggero" }, "Serve una volta sola: crei un \"Client ID\" gratuito su Google e lo incolli qui. Non è una chiave segreta."),
      h("ol", { class: "passi" },
        h("li", {}, "Vai su console.cloud.google.com e crea un progetto (es. \"Organizza\")."),
        h("li", {}, "Menu → API e servizi → Libreria: cerca \"Google Calendar API\" e premi Abilita."),
        h("li", {}, "Schermata consenso OAuth: tipo Esterno, poi in \"Utenti di prova\" aggiungi la tua email e quella di Edoardo."),
        h("li", {}, "Credenziali → Crea credenziali → ID client OAuth → Applicazione web."),
        h("li", {}, h("span", {}, "In \"Origini JavaScript autorizzate\" aggiungi: "), h("code", {}, location.origin)),
        h("li", {}, "Copia l'ID client e incollalo qui sotto.")),
      h("form", { class: "modulo", onsubmit: (ev) => {
        ev.preventDefault();
        stato.google.clientId = clientId.value.trim();
        salva();
        collegaGoogle();
      } },
        campo("Client ID", clientId),
        h("button", { class: "bottone-accento largo", type: "submit" }, icona("google", 16), "Salva e collega")));
    document.querySelector(".modale-box").classList.add("larga");
    return;
  }

  const attivo = Google.stato === "attivo";
  const cal = calendariGoogle();

  // spunte: quali calendari mostrare
  const spunte = cal.map((c) => h("label", { class: "riga-calendario" },
    h("input", { type: "checkbox", checked: c.attivo, onchange: (ev) => { c.attivo = ev.target.checked; salva(); } }),
    h("i", { style: `background:${c.colore}` }),
    h("span", { class: "riga-calendario-nome" }, c.nome),
    c.principale && h("span", { class: "pill piccola" }, "principale"),
    h("button", { class: `pill piccola${c.scuola ? " attiva" : ""}`, type: "button", title: "Gli eventi dei calendari di scuola sono gialli e vanno nella sezione Lezioni",
      onclick: (ev) => { ev.preventDefault(); c.scuola = !c.scuola; salva(); ev.currentTarget.classList.toggle("attiva", c.scuola); } }, "Scuola")));

  apriModale("Google Calendar",
    h("dl", { class: "dettagli" },
      h("dt", {}, "Stato"), h("dd", {}, attivo ? "Collegato e sincronizzato" : Google.stato === "errore" ? "Da ricollegare" : "Non collegato in questa sessione"),
      h("dt", {}, "Ultimo aggiornamento"), h("dd", {}, quandoFa(g.ultimoSync))),
    Google.errore && h("p", { class: "avviso-errore" }, Google.errore),
    cal.length > 0 && h("fieldset", { class: "articoli" },
      h("legend", {}, "Calendari da mostrare"),
      spunte),
    h("p", { class: "testo-leggero piccolo" }, "«Scuola» = calendario di H-Farm: i suoi eventi sono gialli e compaiono nella sezione Lezioni. Mentre l'app è aperta controlla Google ogni 30 secondi. I calendari in abbonamento (come Canvas) li aggiorna Google da solo ogni qualche ora: qui li vedi quando li vede anche il telefono. I nuovi eventi creati qui vanno nel calendario principale."),
    h("div", { class: "azioni-modale" },
      h("button", { class: "bottone-secondario", type: "button", onclick: () => { stato.google.clientId = ""; salva(); apriPannelloGoogle(); } }, "Cambia Client ID"),
      (attivo || g.collegato) && h("button", { class: "bottone-secondario pericolo", type: "button", onclick: scollegaGoogle }, "Scollega"),
      attivo
        ? h("button", { class: "bottone-accento", type: "button", onclick: () => { chiudiModale(); sincronizzaGoogle(); } }, icona("sync", 16), "Aggiorna ora")
        : h("button", { class: "bottone-accento", type: "button", onclick: collegaGoogle }, icona("google", 16), "Collega")));
  document.querySelector(".modale-box").classList.add("larga");
}
