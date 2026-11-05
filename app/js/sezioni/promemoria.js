// ===== Promemoria =====

Viste.promemoria = function (box) {
  const oggiK = oggiChiave();
  const domaniK = chiaveGiorno(aggiungiGiorni(new Date(), 1));

  const testo = h("input", { type: "text", placeholder: "Cosa non devi dimenticare?", required: true, maxlength: 100 });
  const scadenza = h("input", { type: "date" });
  const modulo = h("form", { class: "modulo-riga", onsubmit: (ev) => {
    ev.preventDefault();
    stato.promemoria.push({ id: nuovoId("p"), testo: testo.value.trim(), scadenza: scadenza.value || null, fatto: false });
    aggiorna();
  } },
    campo("Nuovo promemoria", testo), campo("Entro il (facoltativo)", scadenza),
    h("button", { class: "bottone-accento", type: "submit" }, icona("piu", 16), "Aggiungi"));

  const etichettaScadenza = (p) => {
    if (!p.scadenza) return h("span", { class: "pill piccola" }, "senza data");
    if (p.fatto) return h("span", { class: "pill piccola" }, dataBreve(daChiave(p.scadenza)));
    if (p.scadenza < oggiK) return h("span", { class: "pill piccola pericolo" }, "scaduto");
    if (p.scadenza === oggiK) return h("span", { class: "pill piccola urgente" }, "oggi");
    if (p.scadenza === domaniK) return h("span", { class: "pill piccola urgente" }, "domani");
    return h("span", { class: "pill piccola" }, dataBreve(daChiave(p.scadenza)));
  };

  const riga = (p) => h("li", { class: `riga-promemoria${p.fatto ? " fatto" : ""}` },
    h("button", { class: `spunta${p.fatto ? " fatta" : ""}`, type: "button", "aria-label": p.fatto ? "Segna come da fare" : "Segna come fatto",
      onclick: () => { p.fatto = !p.fatto; aggiorna(); } }, icona("check", 14)),
    h("span", { class: "promemoria-testo" }, p.testo),
    etichettaScadenza(p),
    h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Elimina", onclick: () => {
      stato.promemoria = stato.promemoria.filter((x) => x.id !== p.id);
      aggiorna();
    } }, icona("cestino", 14)));

  // ordine: prima quelli con data (dalla più vicina), poi quelli senza data
  const ordina = (a, b) => (a.scadenza || "9999").localeCompare(b.scadenza || "9999");
  const daFare = stato.promemoria.filter((p) => !p.fatto).sort(ordina);
  const fatti = stato.promemoria.filter((p) => p.fatto).sort(ordina);

  const lista = pannello("", "Da fare", h("span", { class: "pill" }, `${daFare.length}`),
    modulo,
    daFare.length ? h("ul", { class: "lista-promemoria" }, daFare.map(riga)) : h("p", { class: "vuoto" }, "Tutto fatto! 🎉"));

  const scaduti = daFare.filter((p) => p.scadenza && p.scadenza < oggiK).length;
  const questaSettimana = daFare.filter((p) => p.scadenza && p.scadenza >= oggiK && p.scadenza <= chiaveGiorno(aggiungiGiorni(new Date(), 7))).length;

  const riepilogo = pannello("card-luce piccola", null, null,
    h("small", { class: "etichetta-luce" }, "Situazione"),
    h("p", { class: "luce-titolo" }, scaduti ? `${scaduti} scadut${scaduti === 1 ? "o" : "i"}` : "Niente in ritardo"),
    h("p", { class: "testo-leggero" }, `${questaSettimana} da fare nei prossimi 7 giorni · ${fatti.length} completati`));

  const completati = pannello("", "Completati", null,
    fatti.length ? h("ul", { class: "lista-promemoria" }, fatti.map(riga)) : h("p", { class: "vuoto" }, "Ancora nessuno"));

  box.append(h("div", { class: "griglia-due larga-sinistra" }, lista, h("div", { class: "colonna" }, riepilogo, completati)));
};
