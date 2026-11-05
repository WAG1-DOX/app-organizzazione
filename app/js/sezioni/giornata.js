// ===== Giornata: la routine minuto per minuto =====
// Micro-eventi (denti, integratori, cucinare, riposo…) che NON vanno nel calendario principale:
// restano solo qui, giorno per giorno. Si trascinano dalla colonna di sinistra alla giornata.

let giornoGiornata = null;          // il giorno mostrato
const GI_INIZIO = 5, GI_FINE = 24;  // ore mostrate
const PX_MIN = 2.2;                 // pixel per ogni minuto (1 ora = 132 px)
let presaDrag = 0;                  // dove hai "preso" un micro-evento quando lo trascini

const CATEGORIE_MICRO = {
  routine: { nome: "Routine", colore: "#c3a6ff" },
  integratori: { nome: "Integratori", colore: "#7dd3c0" },
  pasti: { nome: "Pasti e cucina", colore: "#f4a261" },
  riposo: { nome: "Riposo", colore: "#8ab4f8" },
  movimento: { nome: "Movimento", colore: "#9be89b" },
};

const daMinuti = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const fineMicro = (m) => minutiDa(m.inizio) + m.minuti;
const microDelGiorno = (k) => (stato.giornate[k] ||= []);
const ordinaMicro = (lista) => lista.sort((a, b) => a.inizio.localeCompare(b.inizio));
const limitaMinuti = (min) => Math.max(GI_INIZIO * 60, Math.min(GI_FINE * 60 - 1, min));

// Se un micro-evento è legato a un'attività quotidiana (es. denti), le spunte contano anche lì
function aggiornaRegistroDaMicro(k) {
  const lista = stato.giornate[k] || [];
  const reg = (stato.registro[k] ||= {});
  for (const q of stato.quotidiane) {
    const collegati = lista.filter((m) => m.quotidiana_id === q.id);
    if (collegati.length) reg[q.id] = Math.min(q.volte_al_giorno, collegati.filter((m) => m.fatto).length);
  }
}

function microDaModello(modello, inizioMin) {
  return {
    id: nuovoId("mi"), modello_id: modello.id || null, nome: modello.nome, minuti: modello.minuti,
    categoria: modello.categoria, note: modello.note || "", quotidiana_id: modello.quotidiana_id || null,
    inizio: daMinuti(limitaMinuti(inizioMin)), fatto: false,
  };
}

function applicaRoutineBase(k) {
  const lista = microDelGiorno(k);
  for (const r of stato.routineBase) {
    const modello = stato.microModelli.find((m) => m.id === r.modello_id) || r;
    if (!modello.nome) continue;
    if (lista.some((m) => m.inizio === r.inizio && m.nome === modello.nome)) continue; // già c'è
    lista.push(microDaModello(modello, minutiDa(r.inizio)));
  }
  ordinaMicro(lista);
}

Viste.giornata = function (box) {
  if (!giornoGiornata) giornoGiornata = new Date();
  const giorno = new Date(giornoGiornata.getFullYear(), giornoGiornata.getMonth(), giornoGiornata.getDate());
  const k = chiaveGiorno(giorno);
  const oggiK = oggiChiave();
  const eOggi = k === oggiK;
  const adesso = new Date();
  const adessoMin = adesso.getHours() * 60 + adesso.getMinutes();
  const lista = ordinaMicro(microDelGiorno(k));
  const passatoMicro = (m) => k < oggiK || (eOggi && fineMicro(m) <= adessoMin);

  const sposta = (n) => { giornoGiornata = aggiungiGiorni(giorno, n); disegna(); };
  const titoloGiorno = eOggi ? "Oggi" : k === chiaveGiorno(aggiungiGiorni(adesso, 1)) ? "Domani" : maiuscola(dataLunga(giorno));

  // ---------- In alto: adesso / dopo / riepilogo ----------
  const attuale = eOggi ? lista.find((m) => minutiDa(m.inizio) <= adessoMin && fineMicro(m) > adessoMin) : null;
  const dopo = eOggi ? lista.find((m) => minutiDa(m.inizio) > adessoMin) : lista[0];
  const fatti = lista.filter((m) => m.fatto).length;
  const perCategoria = {};
  for (const m of lista) perCategoria[m.categoria] = (perCategoria[m.categoria] || 0) + m.minuti;

  const testa = h("div", { class: "giornata-testa" },
    h("section", { class: "pannello card-luce adesso-card" },
      h("small", { class: "etichetta-luce" }, attuale ? "Adesso" : eOggi ? "Adesso sei libero" : titoloGiorno),
      h("p", { class: "eroe-titolo" }, attuale ? attuale.nome : dopo ? `Poi: ${dopo.nome}` : "Niente in programma"),
      attuale && h("p", { class: "testo-leggero" }, `${attuale.inizio}–${daMinuti(fineMicro(attuale))} · finisce tra ${durata(fineMicro(attuale) - adessoMin)}`),
      !attuale && dopo && h("p", { class: "testo-leggero" }, eOggi ? `alle ${dopo.inizio} · tra ${durata(minutiDa(dopo.inizio) - adessoMin)}` : `si comincia alle ${dopo.inizio}`),
      attuale && dopo && h("p", { class: "dopo-riga" }, `Dopo: ${dopo.inizio} ${dopo.nome}`)),
    h("section", { class: "pannello riepilogo-giornata" },
      h("div", { class: "riepilogo-numeri" },
        h("div", {}, h("strong", {}, durata(lista.reduce((s, m) => s + m.minuti, 0))), h("small", {}, "pianificati")),
        h("div", {}, h("strong", {}, `${fatti}/${lista.length}`), h("small", {}, "fatti")),
        h("div", {}, h("strong", {}, String(lista.length)), h("small", {}, "micro-eventi"))),
      h("div", { class: "barra-divisa" }, Object.entries(perCategoria).map(([c, min]) =>
        h("span", { style: `flex:${min};background:${(CATEGORIE_MICRO[c] || {}).colore || "#888"}`, title: `${(CATEGORIE_MICRO[c] || {}).nome}: ${durata(min)}` }))),
      h("div", { class: "legenda" }, Object.entries(perCategoria).map(([c, min]) =>
        h("span", {}, h("i", { style: `background:${(CATEGORIE_MICRO[c] || {}).colore}` }), `${(CATEGORIE_MICRO[c] || { nome: c }).nome} `, h("b", {}, durata(min)))))));

  // ---------- Colonna sinistra: micro-eventi da trascinare ----------
  const tavolozza = pannello("tavolozza", "Micro-eventi", h("button", { class: "pill piccola", type: "button", onclick: () => apriModelloMicro(null) }, icona("piu", 12), "Nuovo"),
    h("p", { class: "testo-leggero piccolo" }, "Trascinali nella giornata, oppure toccali per scegliere l'ora."),
    Object.entries(CATEGORIE_MICRO).map(([c, info]) => {
      const modelli = stato.microModelli.filter((m) => m.categoria === c);
      if (!modelli.length) return null;
      return h("div", { class: "gruppo-micro" },
        h("small", { class: "gruppo-micro-nome" }, h("i", { style: `background:${info.colore}` }), info.nome),
        modelli.map((m) => h("button", {
          class: "chip-micro", type: "button", draggable: "true", title: m.note || m.nome, style: `--c:${info.colore}`,
          ondragstart: (ev) => { presaDrag = 0; ev.dataTransfer.setData("text/plain", `modello:${m.id}`); ev.dataTransfer.effectAllowed = "copy"; },
          onclick: () => apriAggiungiMicro(m, k),
        }, h("span", {}, m.nome), h("small", {}, durata(m.minuti)))));
    }));

  // ---------- La giornata ----------
  const altezza = (GI_FINE - GI_INIZIO) * 60 * PX_MIN;
  const corpo = h("div", { class: "gi-corpo", style: `height:${altezza}px` });
  const ore = h("div", { class: "gi-ore" });
  for (let o = GI_INIZIO; o < GI_FINE; o++) {
    const top = (o - GI_INIZIO) * 60 * PX_MIN;
    if (o > GI_INIZIO) ore.append(h("span", { style: `top:${top}px` }, `${pad(o)}:00`));
    corpo.append(h("div", { class: "gi-linea", style: `top:${top}px` }));
    corpo.append(h("div", { class: "gi-linea mezza", style: `top:${top + 30 * PX_MIN}px` }));
  }
  corpo.append(ore);

  // le ore di sonno (dalla pagina Settimana) sono oscurate
  const sonno = orariSonno(giorno);
  const minSveglia = minutiDa(sonno.sveglia);
  const minDormire = minutiDa(sonno.dormire) <= minSveglia ? 24 * 60 : minutiDa(sonno.dormire);
  if (minSveglia > GI_INIZIO * 60) {
    corpo.append(h("div", { class: "gi-sonno", style: `top:0;height:${(minSveglia - GI_INIZIO * 60) * PX_MIN}px` },
      h("span", {}, icona("luna", 12), `Sonno · sveglia alle ${sonno.sveglia}`)));
  }
  if (minDormire < GI_FINE * 60) {
    corpo.append(h("div", { class: "gi-sonno", style: `top:${(minDormire - GI_INIZIO * 60) * PX_MIN}px;height:${(GI_FINE * 60 - minDormire) * PX_MIN}px` },
      h("span", {}, icona("luna", 12), `A letto alle ${sonno.dormire}`)));
  }

  // colonna "dal calendario": lezioni ed eventi, in trasparenza, per organizzarsi attorno
  const colCal = h("div", { class: "gi-calendario" });
  const elementiCal = [
    ...lezioniDelGiorno(giorno).map((l) => ({ titolo: l.materia, i: minutiDa(l.inizio), f: minutiDa(l.fine), scuola: true, apri: () => apriModificaLezione(l) })),
    ...eventiDelGiorno(giorno).filter((e) => !e.tutto_il_giorno).map((e) => {
      const a = new Date(e.inizio), b = new Date(e.fine);
      return { titolo: e.titolo, i: a.getHours() * 60 + a.getMinutes(), f: chiaveGiorno(b) === k ? b.getHours() * 60 + b.getMinutes() : GI_FINE * 60, scuola: eScuola(e), colore: coloreEvento(e), apri: () => apriModificaEvento(e) };
    }),
  ];
  for (const el of elementiCal) {
    const i = Math.max(GI_INIZIO * 60, el.i), f = Math.min(GI_FINE * 60, el.f);
    if (f <= i) continue;
    colCal.append(h("button", {
      class: `gi-cal-blocco${el.scuola ? " scuola" : ""}`, type: "button", title: `${el.titolo} · ${daMinuti(el.i)}–${daMinuti(el.f)}`,
      style: `top:${(i - GI_INIZIO * 60) * PX_MIN}px;height:${Math.max((f - i) * PX_MIN - 2, 18)}px;${el.colore ? `--c:${el.colore}` : ""}`,
      onclick: el.apri,
    }, h("strong", {}, el.titolo), h("small", {}, `${daMinuti(el.i)}–${daMinuti(el.f)}`)));
  }

  // colonna dei micro-eventi (qui si lascia cadere quello che trascini)
  const colMicro = h("div", { class: "gi-micro" });
  const guida = h("div", { class: "gi-guida" }, h("span"));
  colMicro.append(guida);

  const minutoDaY = (clientY) => {
    const y = clientY - colMicro.getBoundingClientRect().top - presaDrag;
    return limitaMinuti(GI_INIZIO * 60 + Math.round(y / PX_MIN / 5) * 5);   // si aggancia ogni 5 minuti
  };
  colMicro.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    const min = minutoDaY(ev.clientY);
    guida.style.top = `${(min - GI_INIZIO * 60) * PX_MIN}px`;
    guida.firstChild.textContent = daMinuti(min);
    guida.classList.add("visibile");
  });
  colMicro.addEventListener("dragleave", (ev) => { if (!colMicro.contains(ev.relatedTarget)) guida.classList.remove("visibile"); });
  colMicro.addEventListener("drop", (ev) => {
    ev.preventDefault();
    guida.classList.remove("visibile");
    const [cosa, id] = ev.dataTransfer.getData("text/plain").split(":");
    const min = minutoDaY(ev.clientY);
    if (cosa === "modello") {
      const modello = stato.microModelli.find((m) => m.id === id);
      if (modello) microDelGiorno(k).push(microDaModello(modello, min));
    } else if (cosa === "micro") {
      const m = microDelGiorno(k).find((x) => x.id === id);
      if (m) m.inizio = daMinuti(min);
    }
    ordinaMicro(microDelGiorno(k));
    aggiorna();
  });
  // doppio clic su uno spazio vuoto: nuovo micro-evento a quell'ora
  colMicro.addEventListener("dblclick", (ev) => {
    if (ev.target !== colMicro) return;
    presaDrag = 0;
    apriModificaMicro(null, k, minutoDaY(ev.clientY));
  });

  // i micro-eventi brevi (1-2 min) li disegniamo almeno alti come 12 minuti, e se si toccano li affianchiamo
  const MIN_VISIBILE = 12;
  const disposti = disponiInCorsie(lista.map((m) => ({ m, inizio: minutiDa(m.inizio), fine: minutiDa(m.inizio) + Math.max(m.minuti, MIN_VISIBILE) })));
  for (const { m, corsia, corsie } of disposti) {
    const info = CATEGORIE_MICRO[m.categoria] || { colore: "#888" };
    const alto = Math.max(m.minuti, MIN_VISIBILE) * PX_MIN - 2;
    const larghezza = 100 / corsie;
    colMicro.append(h("div", {
      class: `gi-evento${m.fatto ? " fatto" : ""}${passatoMicro(m) ? " passato" : ""}${alto < 40 ? " corto" : ""}`,
      draggable: "true", role: "button", tabindex: "0", title: [m.nome, `${m.inizio}–${daMinuti(fineMicro(m))}`, m.note].filter(Boolean).join("\n"),
      style: `top:${(minutiDa(m.inizio) - GI_INIZIO * 60) * PX_MIN + 1}px;height:${alto}px;left:calc(${corsia * larghezza}% + 2px);width:calc(${larghezza}% - 4px);--c:${info.colore}`,
      ondragstart: (ev) => { presaDrag = ev.clientY - ev.currentTarget.getBoundingClientRect().top; ev.dataTransfer.setData("text/plain", `micro:${m.id}`); ev.dataTransfer.effectAllowed = "move"; },
      onclick: () => apriModificaMicro(m, k),
      onkeydown: (ev) => { if (ev.key === "Enter") apriModificaMicro(m, k); },
    },
      h("button", { class: `spunta-micro${m.fatto ? " fatta" : ""}`, type: "button", "aria-label": m.fatto ? "Segna da fare" : "Segna fatto",
        onclick: (ev) => { ev.stopPropagation(); m.fatto = !m.fatto; aggiornaRegistroDaMicro(k); aggiorna(); } }, icona("check", 12)),
      h("span", { class: "gi-ora" }, m.inizio),
      h("span", { class: "gi-testo" },
        h("strong", {}, m.nome),
        h("small", {}, durata(m.minuti)),
        alto >= 60 && m.note && h("em", {}, m.note))));
  }

  if (eOggi && adessoMin >= GI_INIZIO * 60) {
    corpo.append(h("div", { class: "linea-adesso gi-adesso", style: `top:${(adessoMin - GI_INIZIO * 60) * PX_MIN}px` }));
  }
  corpo.append(h("div", { class: "gi-colonne" }, colCal, colMicro));

  const vuoto = !lista.length && h("div", { class: "gi-vuoto" },
    h("p", {}, "Giornata ancora vuota"),
    h("button", { class: "bottone-accento", type: "button", onclick: () => { applicaRoutineBase(k); aggiorna(); } }, icona("sync", 16), "Applica la routine base"),
    h("small", { class: "testo-leggero" }, "oppure trascina qui i micro-eventi"));

  const comandi = h("div", { class: "gruppo-pill" },
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Giorno prima", onclick: () => sposta(-1) }, icona("sinistra", 16)),
    h("button", { class: "pill", type: "button", onclick: () => { giornoGiornata = new Date(); disegna(); } }, "Oggi"),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Giorno dopo", onclick: () => sposta(1) }, icona("destra", 16)),
    lista.length > 0 && h("button", { class: "pill", type: "button", title: "Aggiunge i micro-eventi della routine base che mancano", onclick: () => { applicaRoutineBase(k); aggiorna(); } }, "Applica routine base"),
    lista.length > 0 && h("button", { class: "pill", type: "button", onclick: () => {
      if (!confirm("Usare questa giornata come routine base? (La applicherai agli altri giorni con un clic)")) return;
      stato.routineBase = lista.map((m) => ({ inizio: m.inizio, modello_id: m.modello_id, nome: m.nome, minuti: m.minuti, categoria: m.categoria, note: m.note, quotidiana_id: m.quotidiana_id }));
      aggiorna();
    } }, "Salva come routine base"),
    lista.length > 0 && h("button", { class: "pill pericolo", type: "button", onclick: () => {
      if (!confirm("Svuotare questa giornata?")) return;
      stato.giornate[k] = [];
      aggiornaRegistroDaMicro(k);
      aggiorna();
    } }, "Svuota"));

  const giornata = pannello("card-giornata-micro", titoloGiorno === "Oggi" ? `Oggi · ${dataLunga(giorno)}` : titoloGiorno, comandi,
    h("div", { class: "gi-intestazione" }, h("span"), h("span", {}, "Dal calendario"), h("span", {}, "La tua routine")),
    vuoto,
    h("div", { class: "gi-scorri" }, corpo));

  box.append(testa, h("div", { class: "griglia-giornata" }, tavolozza, giornata));

  // porta in vista l'ora giusta: adesso (se è oggi) o la prima cosa del giorno
  const scorri = box.querySelector(".gi-scorri");
  const daMostrare = eOggi ? adessoMin - 45 : minSveglia - 30;
  scorri.scrollTop = Math.max(0, (daMostrare - GI_INIZIO * 60) * PX_MIN);
};

// ---------- Finestre ----------
function apriAggiungiMicro(modello, k) {
  const adesso = new Date();
  const suggerito = k === oggiChiave() ? Math.ceil((adesso.getHours() * 60 + adesso.getMinutes()) / 5) * 5 : 8 * 60;
  const ora = h("input", { type: "time", value: daMinuti(limitaMinuti(suggerito)), required: true, step: 60 });
  apriModale(`Aggiungi «${modello.nome}»`,
    modello.note && h("p", { class: "testo-leggero piccolo" }, modello.note),
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      microDelGiorno(k).push(microDaModello(modello, minutiDa(ora.value)));
      ordinaMicro(microDelGiorno(k));
      chiudiModale();
      aggiorna();
    } },
      campo("A che ora", ora),
      h("button", { class: "bottone-accento largo", type: "submit" }, icona("piu", 16), `Aggiungi (${durata(modello.minuti)})`)),
    h("div", { class: "azioni-modale" },
      h("button", { class: "bottone-secondario", type: "button", onclick: () => apriModelloMicro(modello) }, icona("matita", 14), "Modifica preimpostato")));
}

// Modificare un micro-evento della giornata (o crearne uno nuovo a un'ora precisa)
function apriModificaMicro(m, k, minutoNuovo) {
  const nuovo = !m;
  const nome = h("input", { type: "text", value: m ? m.nome : "", placeholder: "es. Integratori", required: true, maxlength: 60, class: "input-titolo" });
  const inizio = h("input", { type: "time", step: 60, required: true, value: m ? m.inizio : daMinuti(minutoNuovo || 8 * 60) });
  const minuti = h("input", { type: "number", min: 1, max: 600, required: true, value: m ? m.minuti : 5 });
  const categoria = h("select", {}, Object.entries(CATEGORIE_MICRO).map(([c, info]) => h("option", { value: c, selected: (m ? m.categoria : "routine") === c }, info.nome)));
  const note = h("textarea", { rows: 2, placeholder: "Note (es. quale integratore, quanto, come)" });
  note.value = m ? m.note || "" : "";

  apriModale(nuovo ? "Nuovo micro-evento" : "Micro-evento",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      const dati = { nome: nome.value.trim(), inizio: inizio.value, minuti: Number(minuti.value), categoria: categoria.value, note: note.value.trim() };
      if (nuovo) microDelGiorno(k).push({ ...microDaModello(dati, minutiDa(dati.inizio)), modello_id: null });
      else Object.assign(m, dati);
      ordinaMicro(microDelGiorno(k));
      chiudiModale();
      aggiorna();
    } },
      nome,
      h("div", { class: "tre-campi" }, campo("Inizio (al minuto)", inizio), campo("Durata (min)", minuti), campo("Tipo", categoria)),
      note,
      h("div", { class: "azioni-modale" },
        !nuovo && h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
          stato.giornate[k] = microDelGiorno(k).filter((x) => x.id !== m.id);
          aggiornaRegistroDaMicro(k);
          chiudiModale();
          aggiorna();
        } }, icona("cestino", 16), "Togli"),
        h("button", { class: "bottone-accento", type: "submit" }, "Salva"))));
}

// Creare o modificare un micro-evento preimpostato (quelli della colonna di sinistra)
function apriModelloMicro(modello) {
  const nuovo = !modello;
  const nome = h("input", { type: "text", value: modello ? modello.nome : "", placeholder: "es. Proteine in polvere", required: true, maxlength: 60 });
  const minuti = h("input", { type: "number", min: 1, max: 600, required: true, value: modello ? modello.minuti : 5 });
  const categoria = h("select", {}, Object.entries(CATEGORIE_MICRO).map(([c, info]) => h("option", { value: c, selected: (modello ? modello.categoria : "routine") === c }, info.nome)));
  const note = h("textarea", { rows: 2, placeholder: "Note: per gli integratori scrivi quando e come prenderli" });
  note.value = modello ? modello.note || "" : "";

  apriModale(nuovo ? "Nuovo micro-evento preimpostato" : "Modifica preimpostato",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      const dati = { nome: nome.value.trim(), minuti: Number(minuti.value), categoria: categoria.value, note: note.value.trim() };
      if (nuovo) stato.microModelli.push({ id: nuovoId("mm"), ...dati });
      else Object.assign(modello, dati);
      chiudiModale();
      aggiorna();
    } },
      campo("Nome", nome),
      h("div", { class: "due-campi" }, campo("Durata (min)", minuti), campo("Tipo", categoria)),
      note,
      h("div", { class: "azioni-modale" },
        !nuovo && h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
          if (!confirm(`Eliminare «${modello.nome}» dai preimpostati? (Le giornate già fatte non cambiano)`)) return;
          stato.microModelli = stato.microModelli.filter((x) => x.id !== modello.id);
          chiudiModale();
          aggiorna();
        } }, icona("cestino", 16), "Elimina"),
        h("button", { class: "bottone-accento", type: "submit" }, "Salva"))));
}
