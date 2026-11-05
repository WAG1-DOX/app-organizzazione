// ===== Lezioni: solo le cose di H-Farm =====
// Se hai collegato Google e segnato il calendario di H-Farm come «Scuola», le lezioni arrivano da lì.
// Altrimenti si usa l'orario che scrivi tu con «Modifica orario».

let settimanaLezioni = null;   // il lunedì della settimana mostrata
const NOMI_GIORNI = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

// Tutte le cose di scuola di un giorno, nello stesso formato
function scuolaDelGiorno(d) {
  const ids = new Set(calendariScuola().map((c) => c.id));
  const daHFarm = usaCalendarioScuola();
  const eventi = eventiDelGiorno(d).filter((e) => (daHFarm ? ids.has(e.google_cal) : e.tipo === "scuola"));
  const voci = eventi.map((e) => {
    const m = materiaDi(e.titolo);
    return {
      sorgente: "evento", rif: e, titolo: e.titolo, materia: m, tuttoIlGiorno: e.tutto_il_giorno,
      inizio: new Date(e.inizio), fine: new Date(e.fine), luogo: e.luogo || "", scadenza: eScadenza(e) || e.tutto_il_giorno,
    };
  });
  for (const l of lezioniDelGiorno(d)) {
    const [h1, m1] = l.inizio.split(":").map(Number), [h2, m2] = l.fine.split(":").map(Number);
    voci.push({
      sorgente: "lezione", rif: l, titolo: l.materia, materia: stato.materie.find((m) => m.id === l.materia_id) || null, tuttoIlGiorno: false,
      inizio: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h1, m1), fine: new Date(d.getFullYear(), d.getMonth(), d.getDate(), h2, m2),
      luogo: [l.aula, l.prof && `prof. ${l.prof}`].filter(Boolean).join(" · "), scadenza: false,
    });
  }
  return voci.sort((a, b) => (b.tuttoIlGiorno - a.tuttoIlGiorno) || (a.inizio - b.inizio));
}

const apriVoceScuola = (v) => (v.sorgente === "lezione" ? apriModificaLezione(v.rif) : apriModificaEvento(v.rif));

Viste.lezioni = function (box) {
  if (!settimanaLezioni) settimanaLezioni = inizioSettimana(new Date());
  const adesso = new Date();
  const oggiK = oggiChiave();
  const daHFarm = usaCalendarioScuola();

  // ---------- La settimana: una scheda per giorno ----------
  const lunedi = settimanaLezioni;
  const giorni = [0, 1, 2, 3, 4, 5, 6].map((i) => aggiungiGiorni(lunedi, i))
    .filter((d, i) => i < 5 || scuolaDelGiorno(d).length);   // sabato e domenica solo se servono
  const ultimo = aggiungiGiorni(lunedi, 6);
  const intervallo = lunedi.getMonth() === ultimo.getMonth()
    ? `${lunedi.getDate()} – ${ultimo.getDate()} ${ultimo.toLocaleDateString("it-IT", { month: "long" })}`
    : `${lunedi.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${ultimo.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;
  const sposta = (n) => { settimanaLezioni = aggiungiGiorni(lunedi, 7 * n); disegna(); };

  const comandi = h("div", { class: "gruppo-pill" },
    h("span", { class: `pill piccola${daHFarm ? " attiva" : ""}` }, daHFarm ? "Dal calendario H-Farm" : "Orario manuale"),
    !daHFarm && h("button", { class: "pill", type: "button", onclick: apriEditorOrario }, icona("matita", 14), "Modifica orario"),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Settimana precedente", onclick: () => sposta(-1) }, icona("sinistra", 16)),
    h("button", { class: "pill", type: "button", onclick: () => { settimanaLezioni = inizioSettimana(new Date()); disegna(); } }, "Questa settimana"),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Settimana successiva", onclick: () => sposta(1) }, icona("destra", 16)));

  const schede = giorni.map((d) => {
    const k = chiaveGiorno(d);
    const voci = scuolaDelGiorno(d);
    return h("article", { class: `giorno-scuola${k === oggiK ? " oggi" : ""}${k < oggiK ? " passato-giorno" : ""}` },
      h("header", {},
        h("span", { class: "giorno-scuola-nome" }, NOMI_GIORNI[d.getDay()] || "Domenica"),
        h("strong", { class: "giorno-scuola-data" }, d.getDate()),
        k === oggiK && h("span", { class: "pill piccola urgente" }, "oggi")),
      voci.length
        ? h("ul", {}, voci.map((v) => h("li", {},
            h("button", { class: `voce-scuola${v.scadenza ? " scadenza" : ""}${v.fine < adesso ? " passato" : ""}`, type: "button", onclick: () => apriVoceScuola(v), title: v.titolo },
              h("span", { class: "voce-ora" }, v.tuttoIlGiorno ? "Tutto il giorno" : `${oraDi(v.inizio)} – ${oraDi(v.fine)}`,
                v.scadenza && h("span", { class: "voce-badge" }, "Esame / scadenza")),
              h("strong", { class: "voce-titolo" }, v.titolo),
              v.luogo && h("small", { class: "voce-luogo" }, v.luogo)))))
        : h("p", { class: "giorno-vuoto" }, "Libero"));
  });

  const settimana = pannello("card-settimana-scuola", intervallo, comandi, h("div", { class: "griglia-giorni-scuola" }, schede));

  // ---------- Colonna destra: esami/scadenze + materie ----------
  const scadenze = [];
  for (let i = 0; i < 30; i++) {
    const d = aggiungiGiorni(adesso, i);
    for (const v of scuolaDelGiorno(d)) if (v.scadenza && v.fine >= adesso) scadenze.push(v);
  }
  const pannelloScadenze = pannello("", "Esami e scadenze", h("span", { class: "pill piccola" }, "30 giorni"),
    scadenze.length
      ? h("ul", { class: "lista-semplice" }, scadenze.slice(0, 8).map((v) => {
          const giorniMancanti = Math.round((daChiave(chiaveGiorno(v.inizio)) - daChiave(oggiK)) / 86400000);
          return h("li", {},
            h("button", { class: "riga-cliccabile", type: "button", onclick: () => apriVoceScuola(v) },
              h("span", { class: "data-cubo" }, h("small", {}, GIORNI_BREVI[v.inizio.getDay()]), h("strong", {}, v.inizio.getDate())),
              h("span", { class: "riga-testo" }, h("strong", {}, v.titolo), h("small", {}, v.tuttoIlGiorno ? "tutto il giorno" : oraDi(v.inizio))),
              h("span", { class: `pill piccola${giorniMancanti <= 2 ? " urgente" : ""}` }, giorniMancanti === 0 ? "oggi" : giorniMancanti === 1 ? "domani" : `${giorniMancanti} g`)));
        }))
      : h("p", { class: "vuoto" }, "Niente in arrivo"));

  // ore per materia in questa settimana + prossima lezione di ciascuna
  const statistiche = stato.materie.map((m) => {
    let minuti = 0, prossimaM = null;
    for (const d of [0, 1, 2, 3, 4, 5, 6].map((i) => aggiungiGiorni(lunedi, i))) {
      for (const v of scuolaDelGiorno(d)) if (v.materia === m && !v.tuttoIlGiorno && !v.scadenza) minuti += (v.fine - v.inizio) / 60000;
    }
    for (let i = 0; i < 21 && !prossimaM; i++) {
      prossimaM = scuolaDelGiorno(aggiungiGiorni(adesso, i)).find((v) => v.materia === m && !v.scadenza && v.inizio > adesso) || null;
    }
    return { m, minuti, prossimaM };
  });
  const pannelloMaterie = pannello("", "Materie", !daHFarm && h("button", { class: "pill piccola", type: "button", onclick: apriEditorOrario }, icona("matita", 12), "Modifica"),
    h("ul", { class: "lista-materie" }, statistiche.map(({ m, minuti, prossimaM }) => h("li", {},
      h("span", { class: "materia-segno" }),
      h("span", { class: "riga-testo" },
        h("strong", {}, m.nome),
        h("small", {}, `${minuti ? durata(minuti) : "0 h"} questa settimana${prossimaM ? ` · prossima ${dataBreve(prossimaM.inizio)} ${oraDi(prossimaM.inizio)}` : ""}`))))));

  box.append(settimana, h("div", { class: "griglia-due" }, pannelloScadenze, pannelloMaterie));
};

// ---------- Modificare una lezione (finestrella piccola) ----------
const selectGiorno = (valore) => h("select", {}, [1, 2, 3, 4, 5, 6].map((g) => h("option", { value: g, selected: g === valore }, NOMI_GIORNI[g])));
const selectMateria = (valore) => h("select", {}, stato.materie.map((m) => h("option", { value: m.id, selected: m.id === valore }, m.nome)));

function apriModificaLezione(l) {
  const materia = selectMateria(l.materia_id);
  const giorno = selectGiorno(l.giorno);
  const inizio = h("input", { type: "time", value: l.inizio, required: true });
  const fine = h("input", { type: "time", value: l.fine, required: true });

  apriModale("Modifica lezione",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      if (fine.value <= inizio.value) { alert("L'ora di fine deve essere dopo l'inizio."); return; }
      const lez = stato.orario.find((x) => x.id === l.id);
      Object.assign(lez, { materia_id: materia.value, giorno: Number(giorno.value), inizio: inizio.value, fine: fine.value });
      chiudiModale();
      aggiorna();
    } },
      campo("Materia", materia),
      h("div", { class: "tre-campi" }, campo("Giorno", giorno), campo("Inizio", inizio), campo("Fine", fine)),
      h("p", { class: "testo-leggero piccolo" }, `${l.aula ? `Aula ${l.aula}` : ""}${l.prof ? ` · prof. ${l.prof}` : ""} — si cambiano da "Modifica orario".`),
      h("div", { class: "azioni-modale" },
        h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
          stato.orario = stato.orario.filter((x) => x.id !== l.id);
          chiudiModale();
          aggiorna();
        } }, icona("cestino", 16), "Togli"),
        h("button", { class: "bottone-secondario", type: "button", onclick: apriEditorOrario }, "Modifica orario"),
        h("button", { class: "bottone-accento", type: "submit" }, "Salva"))));
}

// ---------- Modifica orario: materie + lezioni in una sola finestra compatta ----------
function apriEditorOrario() {
  // lavoriamo su una copia: si salva solo premendo "Salva"
  const materie = structuredClone(stato.materie);
  const orario = structuredClone(stato.orario);
  const contenuto = h("div", { class: "editor-orario" });

  const ridisegna = () => {
    contenuto.innerHTML = "";

    const righeMaterie = materie.map((m) => h("li", { class: "editor-riga" },
      h("input", { type: "color", value: m.colore, "aria-label": "Colore", oninput: (e) => { m.colore = e.target.value; } }),
      h("input", { type: "text", value: m.nome, placeholder: "Nome materia", "aria-label": "Nome materia", class: "lungo", oninput: (e) => { m.nome = e.target.value; } }),
      h("input", { type: "text", value: m.prof, placeholder: "Prof.", "aria-label": "Professore", oninput: (e) => { m.prof = e.target.value; } }),
      h("input", { type: "text", value: m.aula, placeholder: "Aula", "aria-label": "Aula", oninput: (e) => { m.aula = e.target.value; } }),
      h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": `Elimina ${m.nome}`, onclick: () => {
        const usata = orario.filter((l) => l.materia_id === m.id).length;
        if (usata && !confirm(`«${m.nome}» ha ${usata} lezioni: le tolgo tutte?`)) return;
        materie.splice(materie.indexOf(m), 1);
        for (let i = orario.length - 1; i >= 0; i--) if (orario[i].materia_id === m.id) orario.splice(i, 1);
        ridisegna();
      } }, icona("x", 14))));

    const ordinate = [...orario].sort((a, b) => a.giorno - b.giorno || a.inizio.localeCompare(b.inizio));
    const righeLezioni = ordinate.map((l) => {
      const sel = h("select", { "aria-label": "Materia", class: "lungo", onchange: (e) => { l.materia_id = e.target.value; } },
        materie.map((m) => h("option", { value: m.id, selected: m.id === l.materia_id }, m.nome)));
      const g = selectGiorno(l.giorno);
      g.setAttribute("aria-label", "Giorno");
      g.addEventListener("change", (e) => { l.giorno = Number(e.target.value); });
      return h("li", { class: "editor-riga" },
        g,
        h("input", { type: "time", value: l.inizio, "aria-label": "Inizio", oninput: (e) => { l.inizio = e.target.value; } }),
        h("input", { type: "time", value: l.fine, "aria-label": "Fine", oninput: (e) => { l.fine = e.target.value; } }),
        sel,
        h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Togli lezione", onclick: () => { orario.splice(orario.indexOf(l), 1); ridisegna(); } }, icona("x", 14)));
    });

    contenuto.append(
      h("div", { class: "editor-sezione" },
        h("div", { class: "editor-titolo" }, h("strong", {}, "Materie"),
          h("button", { class: "pill piccola", type: "button", onclick: () => {
            materie.push({ id: nuovoId("mat"), nome: "Nuova materia", prof: "", aula: "", colore: "#8ab4f8" });
            ridisegna();
          } }, icona("piu", 12), "Materia")),
        h("ul", { class: "editor-lista" }, righeMaterie)),
      h("div", { class: "editor-sezione" },
        h("div", { class: "editor-titolo" }, h("strong", {}, "Lezioni della settimana"),
          h("button", { class: "pill piccola", type: "button", disabled: !materie.length, onclick: () => {
            orario.push({ id: nuovoId("lez"), giorno: 1, inizio: "09:00", fine: "10:00", materia_id: materie[0].id });
            ridisegna();
          } }, icona("piu", 12), "Lezione")),
        righeLezioni.length ? h("ul", { class: "editor-lista" }, righeLezioni) : h("p", { class: "vuoto" }, "Nessuna lezione")));
  };
  ridisegna();

  apriModale("Modifica orario", contenuto,
    h("div", { class: "azioni-modale" },
      h("button", { class: "bottone-secondario", type: "button", onclick: chiudiModale }, "Annulla"),
      h("button", { class: "bottone-accento", type: "button", onclick: () => {
        if (orario.some((l) => !l.inizio || !l.fine || l.fine <= l.inizio)) { alert("Controlla gli orari: la fine di ogni lezione deve essere dopo l'inizio."); return; }
        for (const m of materie) m.nome = m.nome.trim() || "Senza nome";
        stato.materie = materie;
        stato.orario = orario;
        chiudiModale();
        aggiorna();
      } }, "Salva")));
  document.querySelector(".modale-box").classList.add("larga");
}

// Per compatibilità con le altre sezioni
const dettaglioEvento = (e) => apriModificaEvento(e);
