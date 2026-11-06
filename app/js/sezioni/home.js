// ===== Dashboard: il riassunto di tutto =====

Viste.home = function (box) {
  const adesso = new Date();
  const k = oggiChiave();

  const lezioni = lezioniDelGiorno(adesso);
  const eventi = eventiDelGiorno(adesso).filter((e) => !e.tutto_il_giorno);
  const aree = minutiPerArea(adesso);   // lezioni, produttività, extra, routine
  const totale = Object.values(aree).reduce((s, x) => s + x, 0);

  const routine = quotaQuotidiane(k);
  const prossima = prossimaLezione(adesso);
  const soldi = totaliMese(adesso.getFullYear(), adesso.getMonth());
  const rimasto = stato.budget.mensile - soldi.uscite;
  const promemoriaAperti = stato.promemoria.filter((p) => !p.fatto);
  const mese = punteggioMese(adesso.getFullYear(), adesso.getMonth());

  // --- La tua giornata: barra divisa in lezioni / produttività / extra / routine ---
  const parti = Object.entries(AREE_GIORNATA).map(([a, info]) => ({ nome: info.nome, min: aree[a], colore: info.colore }));
  const giornata = pannello("card-giornata", "La tua giornata", h("span", { class: "pill" }, "Oggi"),
    h("p", { class: "numero-grande" }, durata(totale)),
    h("p", { class: "testo-leggero" }, "di tempo già occupato oggi"),
    h("div", { class: "barra-divisa" }, parti.filter((p) => p.min).map((p) =>
      h("span", { style: `flex:${p.min};background:${p.colore}`, title: `${p.nome}: ${durata(p.min)}` }))),
    h("div", { class: "legenda" }, parti.map((p) =>
      h("span", {}, h("i", { style: `background:${p.colore}` }), `${p.nome} `, h("b", {}, durata(p.min))))),
    h("a", { class: "link-sottile", href: "#giornata" }, "Organizza la giornata minuto per minuto →"));

  // --- Prossima lezione, con la luce gialla ---
  const luce = pannello("card-luce", null, null,
    h("small", { class: "etichetta-luce" }, prossima ? (prossima.inCorso ? "Lezione in corso" : "Prossima lezione") : "Lezioni"),
    h("p", { class: "luce-titolo" }, prossima ? prossima.materia : "Nessuna lezione in vista"),
    prossima && h("p", { class: "testo-leggero" },
      [chiaveGiorno(prossima.data) === k ? "Oggi" : maiuscola(dataLunga(prossima.data)), `${prossima.inizio}–${prossima.fine}`, prossima.aula].filter(Boolean).join(" · ")),
    h("a", { class: "bottone-accento", href: "#lezioni" }, "Apri l'orario"));

  // --- Agenda di oggi ---
  const righe = [
    ...lezioni.map((l) => ({ ora: l.inizio, titolo: l.materia, sotto: `${l.aula} · prof. ${l.prof}`, tipo: "scuola", fine: l.fine, passato: minutiDa(l.fine) < adesso.getHours() * 60 + adesso.getMinutes() })),
    ...eventi.map((e) => ({ ora: oraDi(new Date(e.inizio)), titolo: e.titolo, sotto: e.luogo || primaRiga(e.descrizione) || ETICHETTE_TIPO[e.tipo], tipo: e.tipo, fine: oraDi(new Date(e.fine)), passato: ePassato(e), colore: coloreEvento(e) })),
  ].sort((a, b) => a.ora.localeCompare(b.ora));

  const agenda = pannello("card-agenda", "Agenda di oggi", h("a", { class: "pill", href: "#lezioni" }, "Settimana"),
    righe.length
      ? h("ul", { class: "lista-agenda" }, righe.map((r) =>
          h("li", { class: `riga-agenda tipo-${r.tipo}${r.passato ? " passato" : ""}`, style: r.colore ? `--colore-riga:${r.colore}` : null },
            h("span", { class: "riga-ora" }, r.ora),
            h("div", { class: "riga-testo" }, h("strong", {}, r.titolo), h("small", {}, r.sotto)),
            h("span", { class: "riga-fine" }, r.fine))))
      : h("p", { class: "vuoto" }, "Oggi niente lezioni né impegni 🎉"));

  // --- 4 tessere di riepilogo ---
  const tessera = (titolo, valore, sotto, link, nomeIcona) =>
    h("a", { class: "tessera", href: link },
      h("span", { class: "tessera-icona" }, icona(nomeIcona, 18)),
      h("strong", { class: "tessera-valore" }, valore),
      h("small", { class: "tessera-sotto" }, sotto),
      h("span", { class: "tessera-titolo" }, titolo));

  const tessere = pannello("card-tessere", "Riepilogo", h("a", { class: "icona-tonda piccola", href: "#routine", "aria-label": "Apri il monitor" }, icona("freccia", 16)),
    h("div", { class: "tessere" },
      tessera("Routine di oggi", `${Math.round(routine.quota * 100)}%`, `${routine.fatte} su ${routine.totali} fatte`, "#quotidiane", "sole"),
      stato.budget.mensile > 0
        ? tessera("Budget rimasto", euro(rimasto), `su ${euro(stato.budget.mensile)} al mese`, "#spese", "portafoglio")
        : tessera("Spese del mese", euro(soldi.uscite), "nessun budget impostato", "#spese", "portafoglio"),
      tessera("Promemoria", String(promemoriaAperti.length), "ancora da fare", "#promemoria", "campana"),
      tessera("Punteggio del mese", `${mese.punteggio}`, `${mese.rispettati} giorni rispettati`, "#routine", "griglia")));

  // --- Grafico: saldo del mese ---
  const grafico = pannello("card-grafico", `Saldo di ${nomeMese(adesso)}`, h("a", { class: "pill", href: "#spese" }, "Vai alle spese"),
    graficoArea(puntiSaldoMese(adesso.getFullYear(), adesso.getMonth()), { formato: (v) => euro(v), altezza: 200 }));

  // --- Striscia della routine (ultimi giorni del mese) ---
  const striscia = pannello("card-striscia", "Routine del mese", h("span", { class: "testo-accento grassetto" }, `${mese.punteggio}/100`),
    h("div", { class: "striscia" }, mese.giorni.map((g) =>
      h("span", {
        class: `quadratino${g.rispettato ? " pieno" : ""}${g.futuro ? " futuro" : ""}${g.oggi ? " oggi" : ""}`,
        title: `${dataBreve(g.d)}${g.futuro ? "" : g.rispettato ? " · rispettata" : " · non rispettata"}`,
      }))),
    h("p", { class: "testo-leggero piccolo" }, `Serie attuale: ${mese.serie} giorni · record del mese: ${mese.serieMax}`));

  box.append(h("div", { class: "griglia-home" },
    h("div", { class: "colonna" }, giornata, luce, typeof cartaMailHome === "function" && cartaMailHome()),
    agenda,
    tessere,
    grafico,
    striscia));
};
