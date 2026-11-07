// ===== app.js: il "guscio" dell'app (menu, mini calendario, finestre, bottone +) =====

const SEZIONI = [
  { id: "home", nome: "Dashboard", icona: "home", descrizione: "" },
  { id: "giornata", nome: "Giornata", icona: "orologio", descrizione: "La tua routine minuto per minuto: trascina i micro-eventi nella giornata" },
  { id: "calendario", nome: "Calendario", icona: "calendario", descrizione: "Tutti i tuoi impegni, sincronizzati con Google Calendar" },
  { id: "settimana", nome: "Settimana prossima", icona: "griglia", descrizione: "Organizza la settimana in anticipo: ore, sonno, tempo libero e obiettivi" },
  { id: "obiettivi", nome: "Obiettivi", icona: "bandiera", descrizione: "I tuoi obiettivi a lungo termine, divisi in categorie" },
  { id: "lezioni", nome: "Lezioni", icona: "scuola", descrizione: "Solo H-Farm: lezioni, esami e scadenze" },
  { id: "quotidiane", nome: "Quotidiane e nutrizione", icona: "sole", descrizione: "Le attività di ogni giorno, acqua e pasti" },
  { id: "extra", nome: "Attività extra", icona: "stella", descrizione: "Allenamenti e attività salvate, da mettere in calendario col +" },
  { id: "chat", nome: "Chat e gruppi", icona: "persone", descrizione: "Scrivi agli amici e crea gruppi (es. la classe) per condividere gli eventi" },
  { id: "promemoria", nome: "Promemoria", icona: "campana", descrizione: "Le cose da non dimenticare" },
  { id: "spese", nome: "Spese", icona: "portafoglio", descrizione: "Entrate, uscite e budget del mese" },
  { id: "spesa", nome: "Lista della spesa", icona: "carrello", descrizione: "Cosa comprare e foto degli scontrini" },
  { id: "routine", nome: "Monitor routine", icona: "griglia", descrizione: "Un quadratino per ogni giorno: giallo = routine rispettata" },
  { id: "mail", nome: "Check-up mail", icona: "mail", descrizione: "Solo le mail importanti, senza spendere niente" },
];

// ---------- Cambiare sezione ----------
function sezioneAttuale() {
  const id = location.hash.slice(1);
  return SEZIONI.find((s) => s.id === id) || SEZIONI[0];
}

function disegna() {
  const sezione = sezioneAttuale();

  // menu: evidenzia la voce giusta
  document.querySelectorAll("#menu .menu-voce").forEach((a) => a.classList.toggle("attiva", a.dataset.id === sezione.id));

  // titolo in alto
  const titolo = document.getElementById("titolo-pagina");
  const sotto = document.getElementById("sottotitolo-pagina");
  titolo.innerHTML = "";
  if (sezione.id === "home") {
    if (utenteAttuale.nome) titolo.append("Ciao, ", h("span", { class: "testo-accento" }, utenteAttuale.nome));
    else titolo.append("Ciao!");
    sotto.textContent = `${maiuscola(dataLunga(new Date()))} · ecco la tua giornata`;
  } else {
    titolo.textContent = sezione.nome;
    sotto.textContent = sezione.descrizione;
  }

  const vista = document.getElementById("vista");
  vista.innerHTML = "";
  Viste[sezione.id](vista);

  disegnaMiniCalendario();
  aggiornaCampanella();
  aggiornaBadgeChat();
  if (typeof aggiornaBadgeMail === "function") aggiornaBadgeMail();
}

// Ridisegna la sezione senza far saltare niente: tiene la posizione della pagina
// e quella delle viste a ore (calendario, giornata, orario) che scorrono da sole
const ZONE_CHE_SCORRONO = [".cal-scorri", ".gi-scorri", ".orario-scorri", ".tavolozza"];
function ridisegnaFermo() {
  const scroll = window.scrollY;
  const sezionePrima = sezioneAttuale().id;
  const posizioni = ZONE_CHE_SCORRONO.map((s) => { const el = document.querySelector(s); return el ? el.scrollTop : null; });
  disegna();
  if (sezioneAttuale().id === sezionePrima) {
    ZONE_CHE_SCORRONO.forEach((s, i) => { const el = document.querySelector(s); if (el && posizioni[i] !== null) el.scrollTop = posizioni[i]; });
  }
  window.scrollTo(0, scroll);
}

// Da chiamare dopo ogni modifica ai dati: salva e ridisegna, senza far saltare la pagina
function aggiorna() {
  salva();
  ridisegnaFermo();
}

function vaiA(id) {
  if (location.hash === `#${id}`) disegna();
  else location.hash = id;
  window.scrollTo(0, 0);
}

// ---------- Menu ----------
function disegnaMenu() {
  const menu = document.getElementById("menu");
  for (const s of SEZIONI) {
    menu.append(h("a", { class: "menu-voce", href: `#${s.id}`, "data-id": s.id }, icona(s.icona), h("span", {}, s.nome)));
  }
}

// ---------- Mini calendario a sinistra ----------
let meseMini = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function disegnaMiniCalendario() {
  const box = document.getElementById("mini-calendario");
  box.innerHTML = "";
  const anno = meseMini.getFullYear(), mese = meseMini.getMonth();
  const oggiK = oggiChiave();
  const giorniConEventi = new Set(stato.eventi.map((e) => chiaveGiorno(new Date(e.inizio))));

  const cambiaMese = (n) => { meseMini = new Date(anno, mese + n, 1); disegnaMiniCalendario(); };

  const griglia = h("div", { class: "mini-griglia" },
    ["L", "M", "M", "G", "V", "S", "D"].map((l) => h("span", { class: "mini-nome" }, l)));

  const primo = new Date(anno, mese, 1);
  for (let i = 0; i < (primo.getDay() + 6) % 7; i++) griglia.append(h("span"));

  for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
    const d = new Date(anno, mese, g);
    const k = chiaveGiorno(d);
    const classi = ["mini-giorno"];
    if (k === oggiK) classi.push("oggi");
    if (lezioniDelGiorno(d).length) classi.push("scuola");
    if (giorniConEventi.has(k)) classi.push("evento");
    griglia.append(h("button", {
      class: classi.join(" "), type: "button", title: dataLunga(d),
      onclick: () => { dataCal = d; vistaCal = "giorno"; vaiA("calendario"); },
    }, g));
  }

  const prossima = prossimaLezione();
  box.append(
    h("div", { class: "mini-testa" },
      h("strong", {}, maiuscola(nomeMese(meseMini))),
      h("div", {},
        h("button", { class: "mini-freccia", type: "button", "aria-label": "Mese precedente", onclick: () => cambiaMese(-1) }, icona("sinistra", 14)),
        h("button", { class: "mini-freccia", type: "button", "aria-label": "Mese successivo", onclick: () => cambiaMese(1) }, icona("destra", 14)))),
    griglia,
    prossima && h("a", { class: "mini-prossima", href: "#lezioni" },
      h("small", {}, prossima.inCorso ? "Adesso" : (chiaveGiorno(prossima.data) === oggiK ? "Prossima lezione" : `Prossima · ${dataBreve(prossima.data)}`)),
      h("strong", {}, prossima.materia),
      h("span", {}, [`${prossima.inizio}–${prossima.fine}`, prossima.aula].filter(Boolean).join(" · "))),
  );
}

// ---------- Campanella: quanti promemoria scaduti o di oggi ----------
function aggiornaCampanella() {
  const oggiK = oggiChiave();
  const urgenti = stato.promemoria.filter((p) => !p.fatto && p.scadenza && p.scadenza <= oggiK).length;
  const c = document.getElementById("campanella");
  c.innerHTML = "";
  c.append(icona("campana", 18));
  if (urgenti) c.append(h("span", { class: "pallino-avviso" }, urgenti));
}

// ---------- Finestra sopra la pagina ----------
function apriModale(titolo, ...contenuto) {
  const m = document.getElementById("modale");
  m.innerHTML = "";
  m.append(h("div", { class: "modale-box", role: "dialog", "aria-modal": "true", "aria-label": titolo },
    h("div", { class: "modale-testa" },
      h("h3", {}, titolo),
      h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Chiudi", onclick: chiudiModale }, icona("x", 16))),
    ...contenuto));
  m.classList.add("aperta");
  const primo = m.querySelector("input, select, button.bottone-accento");
  if (primo) primo.focus();
}

function chiudiModale() {
  document.getElementById("modale").classList.remove("aperta");
}

// ---------- Avvio ----------
document.getElementById("modale").addEventListener("click", (e) => { if (e.target.id === "modale") chiudiModale(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiModale(); });

const bottonePiu = document.getElementById("bottone-piu");
bottonePiu.append(icona("piu", 26));
bottonePiu.addEventListener("click", () => apriAggiungiAlCalendario());

const bottoneReset = document.getElementById("bottone-reset");
bottoneReset.querySelector(".icona").replaceWith(icona("ingranaggio", 18));
bottoneReset.addEventListener("click", () => {
  if (confirm("Vuoi cancellare tutto quello che hai salvato in questo browser e ripartire da zero?")) ricominciaDaCapo();
});

document.querySelector(".icona-scintilla").replaceWith(icona("scintilla", 18));
document.getElementById("bottone-assistente").addEventListener("click", apriAssistente);

// ---------- Assistente ----------
// La finestra della chat (stile "foglio che sale dal basso") è in js/chat-assistente.js:
// apriAssistente() è definita lì.

// Sul telefono la barra con "Esci" è nascosta: toccando l'avatar si può uscire lo stesso
const avatar = document.getElementById("avatar");
avatar.title = "Esci dall'account";
avatar.style.cursor = "pointer";
avatar.addEventListener("click", esci);

const bottoneConfigura = document.getElementById("bottone-configura");
bottoneConfigura.querySelector(".icona").replaceWith(icona("ingranaggio", 18));
bottoneConfigura.addEventListener("click", apriConfigurazione);

const bottoneEsci = document.getElementById("bottone-esci");
bottoneEsci.querySelector(".icona").replaceWith(icona("frecciaSu", 18));
bottoneEsci.addEventListener("click", esci);

disegnaMenu();
window.addEventListener("hashchange", disegna);

// ---------- Menu del telefono: esce da sinistra con il pulsante ☰ ----------
// (sul computer il menu resta sempre visibile a sinistra: queste funzioni non fanno niente di visibile)
const bottoneMenu = document.getElementById("bottone-menu");
const ICONA_MENU = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
bottoneMenu.innerHTML = ICONA_MENU;
document.getElementById("chiudi-menu").append(icona("x", 20));

function apriMenu() {
  document.body.classList.add("menu-aperto");
  bottoneMenu.setAttribute("aria-expanded", "true");
}
function chiudiMenu() {
  if (!document.body.classList.contains("menu-aperto")) return;
  document.body.classList.remove("menu-aperto");
  bottoneMenu.setAttribute("aria-expanded", "false");
}
bottoneMenu.addEventListener("click", apriMenu);
document.getElementById("chiudi-menu").addEventListener("click", chiudiMenu);
document.getElementById("velo-menu").addEventListener("click", chiudiMenu);
// scegli una voce (o Configurazione / Esci) → il menu si richiude
document.getElementById("barra-laterale").addEventListener("click", (e) => {
  if (e.target.closest(".menu-voce, .logo")) chiudiMenu();
});
window.addEventListener("hashchange", chiudiMenu);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiMenu(); });
// se giri il telefono o allarghi la finestra fino alla misura "computer", il menu torna normale
window.matchMedia("(min-width: 861px)").addEventListener("change", (m) => { if (m.matches) chiudiMenu(); });

// Prima il login: l'app si disegna solo quando sei dentro con il tuo account.
// Poi scarica i tuoi dati dal database (sincronizza.js) e disegna.
avviaAccesso(async () => {
  await avviaCloud();
  // di ritorno dal sito della banca? (?code=…&state=…) → completiamo il collegamento
  if (typeof gestisciRitornoBanca === "function") await gestisciRitornoBanca();
  disegna();
  if (typeof aggiornaBanca === "function") aggiornaBanca(false);   // movimenti nuovi (al massimo ogni 6 ore)
  // la prima volta (o dopo la pulizia dei dati di esempio): configurazione guidata
  if (serveConfigurazione()) apriConfigurazione();
  // gruppi e messaggi (chat.js): li scarichiamo subito, così il pallino dei non letti è giusto
  caricaSocial().then(ridisegnaChat);
  // Google Calendar: se eri già collegato (funzione "google" su Supabase), si ricollega da solo
  if (typeof avviaGoogleAutomatico === "function") avviaGoogleAutomatico().catch(() => {});
  if (typeof avviaPosta === "function") avviaPosta();   // Check-up mail (gmail.js)
});

// Se Google Calendar è già stato configurato, prepariamo subito il suo script
// (così quando tocchi "Collega" la finestra di Google si apre senza attese)
if (stato.google.clientId) caricaScriptGoogle().catch(() => {});
