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
    titolo.append("Ciao, ", h("span", { class: "testo-accento" }, utenteAttuale.nome));
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
}

// Da chiamare dopo ogni modifica ai dati: salva e ridisegna, senza far saltare la pagina
function aggiorna() {
  const scroll = window.scrollY;
  salva();
  disegna();
  window.scrollTo(0, scroll);
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
  if (confirm("Vuoi cancellare tutto quello che hai salvato e tornare ai dati di esempio?")) ricominciaDaCapo();
});

document.querySelector(".icona-scintilla").replaceWith(icona("scintilla", 18));
document.getElementById("bottone-assistente").addEventListener("click", () =>
  apriModale("Assistente (in arrivo)",
    h("p", { class: "testo-leggero" }, "Qui potrai scrivere cose come «domani palestra alle 18 per un'ora» e l'assistente le metterà in calendario da solo."),
    h("p", { class: "testo-leggero" }, "Lo colleghiamo dopo il database, con Claude Haiku tramite una funzione di Supabase (come deciso in CLAUDE.md).")));

const bottoneEsci = document.getElementById("bottone-esci");
bottoneEsci.querySelector(".icona").replaceWith(icona("frecciaSu", 18));
bottoneEsci.addEventListener("click", esci);

disegnaMenu();
window.addEventListener("hashchange", disegna);

// Prima il login: l'app si disegna solo quando sei dentro con il tuo account
avviaAccesso(() => disegna());

// Se Google Calendar è già stato configurato, prepariamo subito il suo script
// (così quando tocchi "Collega" la finestra di Google si apre senza attese)
if (stato.google.clientId) caricaScriptGoogle().catch(() => {});
