// ===== Calendario: viste giorno / settimana / mese, come Google Calendar =====

let vistaCal = "settimana";   // "giorno" | "settimana" | "mese"
let dataCal = new Date();     // il giorno attorno a cui mostriamo il calendario
let lezioniNelCal = true;     // mostrare anche le lezioni?

const CAL_INIZIO = 7, CAL_FINE = 24, CAL_ALTEZZA = 48; // ore mostrate e pixel per ora

const inizioGiorno = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Tutto quello che va disegnato tra due date: eventi + lezioni dell'orario
function elementiCalendario(dal, al) {
  const out = [];
  for (const e of stato.eventi) {
    const i = new Date(e.inizio), f = new Date(e.fine);
    if (f <= dal || i >= al) continue;
    // gli eventi di Google hanno il colore del loro calendario (come sul telefono)
    out.push({
      sorgente: "evento", rif: e, titolo: e.titolo || "(senza titolo)", inizio: i, fine: f, tuttoIlGiorno: e.tutto_il_giorno,
      classe: classeEvento(e), google: !!e.google_id, colore: coloreEvento(e), passato: f < new Date(),
      sotto: e.luogo || primaRiga(e.descrizione),   // riga in più sotto il titolo: luogo o inizio delle note
    });
  }
  if (lezioniNelCal) {
    for (let d = inizioGiorno(dal); d < al; d = aggiungiGiorni(d, 1)) {
      for (const l of lezioniDelGiorno(d)) {
        const [h1, m1] = l.inizio.split(":").map(Number), [h2, m2] = l.fine.split(":").map(Number);
        out.push({
          sorgente: "lezione", rif: l, titolo: l.materia, classe: "ev-scuola", tuttoIlGiorno: false,
          inizio: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h1, m1),
          fine: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h2, m2),
        });
        out[out.length - 1].passato = out[out.length - 1].fine < new Date();
      }
    }
  }
  return out.sort((a, b) => a.inizio - b.inizio);
}

function apriElemento(el) {
  if (el.sorgente === "lezione") apriModificaLezione(el.rif);
  else apriModificaEvento(el.rif);
}

// Il "bottoncino" di un evento (usato nella vista mese e nella riga "tutto il giorno")
function chipEvento(el, conOra = true) {
  return h("button", {
    class: `cal-chip ${el.classe}${el.passato ? " passato" : ""}`, type: "button", style: el.colore ? `--c:${el.colore}` : null,
    title: descrizioneBreve(el),
    onclick: (ev) => { ev.stopPropagation(); apriElemento(el); },
  },
    h("i"),
    conOra && !el.tuttoIlGiorno && h("span", { class: "cal-chip-ora" }, oraDi(el.inizio)),
    h("span", { class: "cal-chip-titolo" }, el.titolo));
}

// Testo che compare passando sopra con il mouse: nome intero, orario, luogo/note
function descrizioneBreve(el) {
  return [el.titolo, el.tuttoIlGiorno ? "Tutto il giorno" : `${oraDi(el.inizio)}–${oraDi(el.fine)}`, el.sotto].filter(Boolean).join("\n");
}

Viste.calendario = function (box) {
  const sposta = (n) => {
    if (vistaCal === "mese") dataCal = new Date(dataCal.getFullYear(), dataCal.getMonth() + n, 1);
    else dataCal = aggiungiGiorni(dataCal, vistaCal === "settimana" ? 7 * n : n);
    disegna();
  };

  // titolo in base alla vista
  let titolo;
  if (vistaCal === "mese") titolo = maiuscola(nomeMese(dataCal));
  else if (vistaCal === "giorno") titolo = maiuscola(dataLunga(dataCal));
  else {
    const l = inizioSettimana(dataCal), d = aggiungiGiorni(l, 6);
    titolo = l.getMonth() === d.getMonth()
      ? `${l.getDate()} – ${d.getDate()} ${d.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}`
      : `${l.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  const g = statoGoogle();
  const barra = h("div", { class: "cal-barra" },
    h("div", { class: "gruppo-pill" },
      h("button", { class: "pill", type: "button", onclick: () => { dataCal = new Date(); disegna(); } }, "Oggi"),
      h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Indietro", onclick: () => sposta(-1) }, icona("sinistra", 16)),
      h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Avanti", onclick: () => sposta(1) }, icona("destra", 16)),
      h("h2", { class: "cal-titolo" }, titolo)),
    h("div", { class: "gruppo-pill" },
      h("button", { class: `pill stato-google ${g.classe}`, type: "button", onclick: apriPannelloGoogle }, icona(g.classe === "attiva" ? "sync" : "google", 14), g.testo),
      h("button", { class: `pill${lezioniNelCal ? " attiva" : ""}`, type: "button", onclick: () => { lezioniNelCal = !lezioniNelCal; disegna(); } }, "Lezioni"),
      h("div", { class: "segmenti", role: "group", "aria-label": "Vista" },
        ["giorno", "settimana", "mese"].map((v) => h("button", {
          class: vistaCal === v ? "attivo" : "", type: "button", onclick: () => { vistaCal = v; disegna(); },
        }, maiuscola(v)))),
      h("button", { class: "bottone-accento piccolo", type: "button", onclick: () => apriModificaEvento(null, { data: chiaveGiorno(dataCal) }) }, icona("piu", 16), "Crea")));

  const corpo = vistaCal === "mese" ? vistaMese() : vistaOre(vistaCal === "giorno" ? [inizioGiorno(dataCal)] : [0, 1, 2, 3, 4, 5, 6].map((i) => aggiungiGiorni(inizioSettimana(dataCal), i)));
  box.append(pannello("card-calendario", null, null, barra, corpo));

  // nella vista a ore, partiamo dalle 8 (o da un'ora prima di adesso, se è oggi)
  const scorri = box.querySelector(".cal-scorri");
  if (scorri) {
    const ora = new Date().getHours();
    scorri.scrollTop = (Math.max(8, Math.min(ora - 1, 18)) - CAL_INIZIO) * CAL_ALTEZZA;
  }
};

// ---------- Vista mese ----------
function vistaMese() {
  const primo = new Date(dataCal.getFullYear(), dataCal.getMonth(), 1);
  const inizio = inizioSettimana(primo);
  const elementi = elementiCalendario(inizio, aggiungiGiorni(inizio, 42));
  const oggiK = oggiChiave();
  const perGiorno = {};
  for (const el of elementi) (perGiorno[chiaveGiorno(el.inizio)] ||= []).push(el);

  const griglia = h("div", { class: "cal-mese" },
    ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((n) => h("div", { class: "cal-mese-nome" }, n)));

  for (let i = 0; i < 42; i++) {
    const d = aggiungiGiorni(inizio, i);
    const k = chiaveGiorno(d);
    const lista = (perGiorno[k] || []).sort((a, b) => (b.tuttoIlGiorno - a.tuttoIlGiorno) || (a.inizio - b.inizio));
    const MAX = 3;
    griglia.append(h("div", {
      class: `cal-cella${d.getMonth() !== primo.getMonth() ? " fuori" : ""}${k === oggiK ? " oggi" : ""}${k < oggiK ? " passata" : ""}`,
      onclick: () => apriModificaEvento(null, { data: k }),
    },
      h("button", { class: "cal-numero", type: "button", "aria-label": `Apri ${dataLunga(d)}`,
        onclick: (ev) => { ev.stopPropagation(); dataCal = d; vistaCal = "giorno"; disegna(); } }, d.getDate()),
      lista.slice(0, MAX).map((el) => chipEvento(el)),
      lista.length > MAX && h("button", { class: "cal-altri", type: "button",
        onclick: (ev) => { ev.stopPropagation(); dataCal = d; vistaCal = "giorno"; disegna(); } }, `+${lista.length - MAX} altri`)));
  }
  return griglia;
}

// ---------- Vista giorno / settimana ----------
// Mette gli eventi che si sovrappongono uno accanto all'altro
function disponiInCorsie(elementi) {
  const ordinati = [...elementi].sort((a, b) => a.inizio - b.inizio || b.fine - a.fine);
  const risultato = [];
  let gruppo = [], fineGruppo = 0;
  const chiudi = () => {
    const corsie = [];
    for (const el of gruppo) {
      let c = corsie.findIndex((fine) => fine <= el.inizio);
      if (c < 0) { c = corsie.length; corsie.push(0); }
      corsie[c] = el.fine;
      el.corsia = c;
    }
    for (const el of gruppo) el.corsie = corsie.length;
    risultato.push(...gruppo);
    gruppo = [];
  };
  for (const el of ordinati) {
    if (gruppo.length && el.inizio >= fineGruppo) chiudi();
    gruppo.push(el);
    fineGruppo = Math.max(fineGruppo, +el.fine);
  }
  if (gruppo.length) chiudi();
  return risultato;
}

function vistaOre(giorni) {
  const oggiK = oggiChiave();
  const dal = giorni[0], al = aggiungiGiorni(giorni[giorni.length - 1], 1);
  const elementi = elementiCalendario(dal, al);
  const colonne = `56px repeat(${giorni.length}, minmax(0, 1fr))`;

  // intestazione + riga "tutto il giorno"
  const testa = h("div", { class: "cal-testa", style: `grid-template-columns:${colonne}` }, h("div"),
    giorni.map((d) => h("button", {
      class: `cal-giorno${chiaveGiorno(d) === oggiK ? " oggi" : ""}`, type: "button",
      onclick: () => { dataCal = d; vistaCal = "giorno"; disegna(); },
    }, h("span", {}, GIORNI_BREVI[d.getDay()]), h("strong", {}, d.getDate()))));

  const tuttiIlGiorno = elementi.filter((el) => el.tuttoIlGiorno);
  const rigaGiornata = h("div", { class: "cal-giornata", style: `grid-template-columns:${colonne}` },
    h("span", { class: "cal-giornata-etichetta" }, "tutto il g."),
    giorni.map((d) => h("div", {}, tuttiIlGiorno.filter((el) => chiaveGiorno(el.inizio) === chiaveGiorno(d)).map((el) => chipEvento(el, false)))));

  // griglia delle ore
  const altezza = (CAL_FINE - CAL_INIZIO) * CAL_ALTEZZA;
  const corpo = h("div", { class: "cal-corpo", style: `grid-template-columns:${colonne};height:${altezza}px` });
  const ore = h("div", { class: "cal-ore" });
  for (let o = CAL_INIZIO; o < CAL_FINE; o++) {
    const top = (o - CAL_INIZIO) * CAL_ALTEZZA;
    if (o > CAL_INIZIO) ore.append(h("span", { style: `top:${top}px` }, `${pad(o)}:00`));
    corpo.append(h("div", { class: "cal-linea", style: `top:${top}px` }));
  }
  corpo.append(ore);

  for (const d of giorni) {
    const k = chiaveGiorno(d);
    const colonna = h("div", {
      class: `cal-colonna${k === oggiK ? " oggi" : ""}${k < oggiK ? " passata" : ""}`,
      // clic su uno spazio vuoto: nuovo evento a quell'ora (arrotondata alla mezz'ora)
      onclick: (ev) => {
        if (ev.target !== ev.currentTarget) return;
        const mezzore = Math.floor((ev.offsetY / CAL_ALTEZZA) * 2);
        const minuti = CAL_INIZIO * 60 + mezzore * 30;
        apriModificaEvento(null, { data: k, ora: `${pad(Math.floor(minuti / 60))}:${pad(minuti % 60)}` });
      },
    });

    const delGiorno = elementi.filter((el) => !el.tuttoIlGiorno && chiaveGiorno(el.inizio) === k);
    for (const el of disponiInCorsie(delGiorno)) {
      const minI = Math.max(CAL_INIZIO * 60, el.inizio.getHours() * 60 + el.inizio.getMinutes());
      const fineStessoGiorno = chiaveGiorno(el.fine) === k;
      const minF = Math.min(CAL_FINE * 60, fineStessoGiorno ? el.fine.getHours() * 60 + el.fine.getMinutes() : CAL_FINE * 60);
      if (minF <= minI) continue;
      const larghezza = 100 / el.corsie;
      const altezza = Math.max(((minF - minI) / 60) * CAL_ALTEZZA - 3, 20);
      const corto = altezza < 40;  // eventi brevi: titolo e ora sulla stessa riga
      colonna.append(h("button", {
        class: `cal-evento ${el.classe}${corto ? " corto" : ""}${el.passato ? " passato" : ""}`, type: "button", title: descrizioneBreve(el),
        style: `top:${((minI - CAL_INIZIO * 60) / 60) * CAL_ALTEZZA + 1}px;height:${altezza}px;left:calc(${el.corsia * larghezza}% + 2px);width:calc(${larghezza}% - 4px);${el.colore ? `--c:${el.colore}` : ""}`,
        onclick: () => apriElemento(el),
      },
        h("strong", {}, el.titolo),
        h("span", { class: "cal-evento-ora" }, corto ? oraDi(el.inizio) : `${oraDi(el.inizio)}–${oraDi(el.fine)}`),
        !corto && altezza >= 70 && el.sotto && h("span", { class: "cal-evento-sotto" }, el.sotto)));
    }

    if (k === oggiK) {
      const adesso = new Date();
      const min = adesso.getHours() * 60 + adesso.getMinutes();
      if (min >= CAL_INIZIO * 60) colonna.append(h("div", { class: "linea-adesso", style: `top:${((min - CAL_INIZIO * 60) / 60) * CAL_ALTEZZA}px` }));
    }
    corpo.append(colonna);
  }

  return h("div", { class: `cal-ore-vista${giorni.length === 1 ? " un-giorno" : ""}` },
    h("div", { class: "cal-scorri" }, h("div", { class: "cal-interno" }, testa, rigaGiornata, corpo)));
}

// ---------- Creare o modificare (e rinominare) un evento ----------
// Eventi di calendari in sola lettura (es. Canvas): si guardano ma non si cambiano
function apriEventoSolaLettura(e) {
  const i = new Date(e.inizio), f = new Date(e.fine);
  const cal = typeof calendarioDi === "function" ? calendarioDi(e.google_cal) : null;
  apriModale(e.titolo,
    h("dl", { class: "dettagli" },
      h("dt", {}, "Quando"), h("dd", {}, e.tutto_il_giorno ? `${maiuscola(dataLunga(i))}, tutto il giorno` : `${maiuscola(dataLunga(i))}, ${oraDi(i)}–${oraDi(f)}`),
      h("dt", {}, "Calendario"), h("dd", { class: "con-icona" }, h("i", { class: "pallino-materia", style: `background:${e.colore || "#888"}` }), cal ? cal.nome : "Google"),
      e.luogo && h("dt", {}, "Dove"), e.luogo && h("dd", {}, testoConLink(e.luogo))),
    e.descrizione && h("div", { class: "box-descrizione" }, testoConLink(e.descrizione)),
    linkEvento(e),
    sceltaColore(e.colore_scelto, (hex) => {
      const ev = stato.eventi.find((x) => x.id === e.id);
      if (ev) { ev.colore_scelto = hex; salva(); }
      aggiorna();
    }),
    h("p", { class: "testo-leggero piccolo con-icona" }, icona("lucchetto", 14), "Questo calendario è di sola lettura: si aggiorna da solo da dove arriva (es. Canvas)."),
    h("div", { class: "azioni-modale" }, h("button", { class: "bottone-accento", type: "button", onclick: chiudiModale }, "Ok")));
  document.querySelector(".modale-box").classList.add("larga");
}

// Fila di pallini colorati per scegliere il colore di un evento
function sceltaColore(attuale, alCambio) {
  let scelto = attuale || null;
  const bottoni = [];
  const disegnaSelezione = () => bottoni.forEach((b) => b.classList.toggle("scelto", (b.dataset.hex || null) === scelto));
  const bottone = (hex, nome) => {
    const b = h("button", {
      class: `pallino-colore${hex ? "" : " automatico"}`, type: "button", title: nome, "aria-label": `Colore: ${nome}`,
      "data-hex": hex || null, style: hex ? `background:${hex}` : null,
      onclick: () => { scelto = hex; disegnaSelezione(); alCambio(hex); },
    });
    bottoni.push(b);
    return b;
  };
  const riga = h("div", { class: "scelta-colore" },
    h("span", { class: "testo-leggero piccolo" }, "Colore"),
    bottone(null, "Automatico (scuola gialla, altrimenti il colore del calendario)"),
    COLORI_EVENTO.map((c) => bottone(c.hex, c.nome)));
  disegnaSelezione();
  return riga;
}

// Link utili di un evento di Google: aprirlo su Google Calendar, entrare nella videochiamata
function linkEvento(e) {
  if (!e.link_google && !e.link_videochiamata) return null;
  return h("div", { class: "gruppo-pill" },
    e.link_videochiamata && h("a", { class: "pill attiva", href: e.link_videochiamata, target: "_blank", rel: "noopener noreferrer" }, "Entra nella videochiamata"),
    e.link_google && h("a", { class: "pill", href: e.link_google, target: "_blank", rel: "noopener noreferrer" }, icona("google", 14), "Apri in Google Calendar"));
}

function apriModificaEvento(e, preset = {}) {
  if (e && e.sola_lettura) return apriEventoSolaLettura(e);
  const nuovo = !e;
  let inizio, fine;
  if (e) { inizio = new Date(e.inizio); fine = new Date(e.fine); }
  else {
    inizio = daChiave(preset.data || oggiChiave());
    const [hh, mm] = (preset.ora || "09:00").split(":").map(Number);
    inizio.setHours(hh, mm, 0, 0);
    fine = new Date(inizio.getTime() + 3600000);
  }

  const titolo = h("input", { type: "text", value: e ? e.titolo : "", placeholder: "Aggiungi un titolo", required: true, maxlength: 80, class: "input-titolo" });
  const tuttoIlGiorno = h("input", { type: "checkbox", checked: e ? e.tutto_il_giorno : false });
  const giorno = h("input", { type: "date", value: chiaveGiorno(inizio), required: true });
  const oraInizio = h("input", { type: "time", value: `${pad(inizio.getHours())}:${pad(inizio.getMinutes())}` });
  const oraFine = h("input", { type: "time", value: `${pad(fine.getHours())}:${pad(fine.getMinutes())}` });
  const tipo = h("select", {}, Object.entries(ETICHETTE_TIPO).map(([v, n]) => h("option", { value: v, selected: (e ? e.tipo : preset.tipo || "impegno") === v }, n)));
  const visibile = h("select", {},
    h("option", { value: "" }, "Solo a me"),
    gruppiFinti.map((g) => h("option", { value: g.id, selected: e && e.gruppo_id === g.id }, `Gruppo ${g.nome}`)));
  const luogo = h("input", { type: "text", value: e ? e.luogo || "" : "", placeholder: "Aggiungi un luogo", maxlength: 200 });
  let coloreScelto = e ? e.colore_scelto || null : null;
  const colori = sceltaColore(coloreScelto, (hex) => { coloreScelto = hex; });
  const descrizione = h("textarea", { placeholder: "Aggiungi una descrizione", rows: 4 });
  descrizione.value = e ? e.descrizione || "" : "";

  const orari = h("div", { class: "due-campi" }, campo("Inizio", oraInizio), campo("Fine", oraFine));
  const aggiornaOrari = () => { orari.style.display = tuttoIlGiorno.checked ? "none" : ""; };
  tuttoIlGiorno.addEventListener("change", aggiornaOrari);
  aggiornaOrari();

  apriModale(nuovo ? "Nuovo evento" : "Modifica evento",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      const base = daChiave(giorno.value);
      let i = new Date(base), f = new Date(base);
      if (tuttoIlGiorno.checked) { i.setHours(0, 0, 0, 0); f.setHours(23, 59, 0, 0); }
      else {
        const [h1, m1] = oraInizio.value.split(":").map(Number), [h2, m2] = oraFine.value.split(":").map(Number);
        i.setHours(h1, m1, 0, 0); f.setHours(h2, m2, 0, 0);
        if (f <= i) { alert("L'ora di fine deve essere dopo l'inizio."); return; }
      }
      const dati = {
        titolo: titolo.value.trim(), descrizione: descrizione.value.trim(), luogo: luogo.value.trim(), tipo: tipo.value,
        inizio: isoLocale(i), fine: isoLocale(f), tutto_il_giorno: tuttoIlGiorno.checked, gruppo_id: visibile.value || null,
      };
      if (e && dati.descrizione !== (e.descrizione || "")) dati.descrizione_cambiata = true;
      dati.colore_scelto = coloreScelto;
      if (e && coloreScelto !== (e.colore_scelto || null)) dati.colore_cambiato = true;
      salvaEvento(nuovo ? nuovoEvento(dati) : { ...e, ...dati });
      chiudiModale();
      aggiorna();
    } },
      titolo,
      h("div", { class: "due-campi" }, campo("Giorno", giorno), h("label", { class: "spunta-riga" }, tuttoIlGiorno, "Tutto il giorno")),
      orari,
      h("div", { class: "due-campi" }, campo("Tipo", tipo), campo("Visibile a", visibile)),
      luogo,
      descrizione,
      colori,
      e && linkEvento(e),
      e && e.google_id && h("p", { class: "testo-leggero piccolo con-icona" }, icona("google", 14), "Sincronizzato con il tuo Google Calendar"),
      h("div", { class: "azioni-modale" },
        !nuovo && h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
          eliminaEvento(e);
          chiudiModale();
          aggiorna();
        } }, icona("cestino", 16), "Elimina"),
        h("button", { class: "bottone-accento", type: "submit" }, "Salva"))));
  document.querySelector(".modale-box").classList.add("larga");
  // i titoli lunghi si leggono dall'inizio, non dalla fine
  titolo.setSelectionRange(0, 0);
  titolo.scrollLeft = 0;
}
