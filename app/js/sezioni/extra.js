// ===== Attività extra: modelli salvati da mettere in calendario col + =====

Viste.extra = function (box) {
  // ---------- Le attività salvate ----------
  const carte = stato.modelliExtra.map((m) =>
    h("article", { class: `carta-extra tipo-${m.tipo}` },
      h("div", { class: "carta-extra-testa" },
        h("span", { class: "cerchio-icona" }, icona(m.tipo === "allenamento" ? "peso" : m.tipo === "produttivita" ? "matita" : m.tipo === "impegno" ? "orologio" : "stella", 18)),
        h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": `Elimina ${m.nome}`, onclick: () => {
          if (!confirm(`Eliminare «${m.nome}» dalle attività salvate? (Gli eventi già in calendario restano.)`)) return;
          stato.modelliExtra = stato.modelliExtra.filter((x) => x.id !== m.id);
          aggiorna();
        } }, icona("x", 14))),
      h("strong", { class: "carta-extra-nome" }, m.nome),
      h("div", { class: "carta-extra-piede" },
        h("span", { class: "testo-leggero" }, `${durata(m.minuti)} · ${ETICHETTE_TIPO[m.tipo]}`),
        h("button", { class: "bottone-piu-piccolo", type: "button", "aria-label": `Aggiungi ${m.nome} al calendario`, onclick: () => apriAggiungiAlCalendario(m.id) }, icona("piu", 18)))));

  carte.push(h("button", { class: "carta-extra nuova", type: "button", onclick: apriNuovoModello },
    icona("piu", 22), h("strong", {}, "Nuova attività"), h("small", {}, "Salvala una volta, usala quando vuoi")));

  const modelli = pannello("", "Le tue attività salvate", h("span", { class: "pill" }, `${stato.modelliExtra.length} salvate`),
    h("div", { class: "griglia-carte" }, carte));

  // ---------- In programma ----------
  const adesso = new Date();
  const prossimi = stato.eventi
    .filter((e) => e.tipo !== "scuola" && new Date(e.fine) >= adesso)
    .sort((a, b) => a.inizio.localeCompare(b.inizio))
    .slice(0, 12);

  const minutiSettimana = stato.eventi
    .filter((e) => e.tipo !== "scuola" && !e.tutto_il_giorno && new Date(e.inizio) >= inizioSettimana(adesso) && new Date(e.inizio) < aggiungiGiorni(inizioSettimana(adesso), 7))
    .reduce((s, e) => s + minutiEvento(e), 0);

  const inProgramma = pannello("", "In programma", h("span", { class: "pill" }, `${durata(minutiSettimana)} questa settimana`),
    prossimi.length
      ? h("ul", { class: "lista-semplice" }, prossimi.map((e) => {
          const d = new Date(e.inizio);
          return h("li", {},
            h("button", { class: "riga-cliccabile", type: "button", onclick: () => dettaglioEvento(e) },
              h("span", { class: "data-cubo" }, h("small", {}, GIORNI_BREVI[d.getDay()]), h("strong", {}, d.getDate())),
              h("span", { class: "riga-testo" }, h("strong", {}, e.titolo), h("small", {}, `${oraDi(d)}–${oraDi(new Date(e.fine))} · ${durata(minutiEvento(e))}`)),
              h("span", { class: `pill piccola tipo-${e.tipo}` }, ETICHETTE_TIPO[e.tipo])));
        }))
      : h("p", { class: "vuoto" }, "Niente in programma. Usa il + per aggiungere qualcosa."));

  box.append(h("div", { class: "griglia-due larga-sinistra" }, modelli, inProgramma));
};

// Finestra: crea una nuova attività salvata
function apriNuovoModello() {
  const nome = h("input", { type: "text", placeholder: "es. Nuoto", required: true, maxlength: 40 });
  const minuti = h("input", { type: "number", min: 5, max: 600, step: 5, value: 60, required: true });
  const tipo = h("select", {}, ["allenamento", "produttivita", "impegno", "altro"].map((t) => h("option", { value: t }, ETICHETTE_TIPO[t])));

  apriModale("Nuova attività extra",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      stato.modelliExtra.push({ id: nuovoId("x"), nome: nome.value.trim(), minuti: Number(minuti.value), tipo: tipo.value });
      chiudiModale();
      aggiorna();
    } },
      campo("Nome", nome),
      h("div", { class: "due-campi" }, campo("Durata (minuti)", minuti), campo("Tipo", tipo)),
      h("button", { class: "bottone-accento largo", type: "submit" }, "Salva attività")));
}

// Finestra: mette un'attività nel calendario (usata dal + in basso e dalle carte)
function apriAggiungiAlCalendario(idModello) {
  if (!stato.modelliExtra.length) { apriNuovoModello(); return; }

  const scelta = h("select", {}, stato.modelliExtra.map((m) =>
    h("option", { value: m.id, selected: m.id === idModello }, `${m.nome} · ${durata(m.minuti)}`)));
  const giorno = h("input", { type: "date", value: oggiChiave(), required: true });
  const ora = h("input", { type: "time", value: "17:00", required: true });
  const settimane = h("input", { type: "number", min: 1, max: 20, value: 1, required: true });

  apriModale("Aggiungi al calendario",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      const m = stato.modelliExtra.find((x) => x.id === scelta.value);
      const [h_, min_] = ora.value.split(":").map(Number);
      const base = daChiave(giorno.value);
      for (let i = 0; i < Number(settimane.value); i++) {
        const inizio = aggiungiGiorni(base, 7 * i);
        inizio.setHours(h_, min_, 0, 0);
        const fine = new Date(inizio.getTime() + m.minuti * 60000);
        salvaEvento(nuovoEvento({ titolo: m.nome, tipo: m.tipo, inizio: isoLocale(inizio), fine: isoLocale(fine) }));
      }
      chiudiModale();
      dataCal = base;
      vistaCal = "settimana";
      vaiA("calendario");
    } },
      campo("Attività", scelta),
      h("div", { class: "due-campi" }, campo("Giorno", giorno), campo("Ora di inizio", ora)),
      campo("Ripeti per quante settimane", settimane),
      h("button", { class: "bottone-accento largo", type: "submit" }, icona("piu", 16), "Metti in calendario"),
      h("button", { class: "bottone-secondario largo", type: "button", onclick: apriNuovoModello }, "Oppure crea una nuova attività")));
}
