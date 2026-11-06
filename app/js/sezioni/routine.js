// ===== Monitor routine: un quadratino per giorno, punteggio e review del mese =====

let meseRoutine = null;
let giornoSelezionato = null;

// Consigli pratici per ogni attività quotidiana preimpostata
const CONSIGLI_ATTIVITA = {
  "q-denti": "tieni lo spazzolino in vista e lavali subito dopo colazione e appena prima di andare a letto: legarli a qualcosa che fai già li rende automatici.",
  "q-doccia": "scegli un momento fisso, per esempio subito dopo l'allenamento o prima di cena.",
  "q-zaino": "preparalo la sera guardando l'orario di domani nella sezione Lezioni: la mattina dopo eviti la corsa.",
};

Viste.routine = function (box) {
  if (!meseRoutine) meseRoutine = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const anno = meseRoutine.getFullYear(), mese = meseRoutine.getMonth();
  const r = punteggioMese(anno, mese);
  const sposta = (n) => { meseRoutine = new Date(anno, mese + n, 1); giornoSelezionato = null; disegna(); };

  const navMese = h("div", { class: "gruppo-pill" },
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Mese precedente", onclick: () => sposta(-1) }, icona("sinistra", 16)),
    h("span", { class: "pill attiva" }, maiuscola(nomeMese(meseRoutine))),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Mese successivo", onclick: () => sposta(1) }, icona("destra", 16)));

  // ---------- La griglia dei quadratini ----------
  const griglia = h("div", { class: "griglia-routine" },
    ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((g) => h("span", { class: "nome-giorno" }, g)));
  for (let i = 0; i < (new Date(anno, mese, 1).getDay() + 6) % 7; i++) griglia.append(h("span"));

  for (const g of r.giorni) {
    const classi = ["quadrato"];
    if (g.rispettato) classi.push("pieno");
    if (g.futuro) classi.push("futuro");
    if (g.oggi) classi.push("oggi");
    if (giornoSelezionato === g.k) classi.push("selezionato");
    griglia.append(h("button", {
      class: classi.join(" "), type: "button", disabled: g.futuro,
      "aria-label": `${dataLunga(g.d)}: ${g.futuro ? "futuro" : g.rispettato ? "routine rispettata" : "routine non rispettata"}`,
      onclick: () => { giornoSelezionato = g.k; disegna(); },
    }, h("span", {}, g.d.getDate())));
  }

  // dettaglio del giorno cliccato
  const sel = r.giorni.find((g) => g.k === giornoSelezionato);
  const dettaglio = sel
    ? h("div", { class: "dettaglio-giorno" },
        h("strong", {}, maiuscola(dataLunga(sel.d))),
        h("span", { class: sel.quota >= SOGLIA_ROUTINE ? "ok" : "no" }, icona(sel.quota >= SOGLIA_ROUTINE ? "check" : "x", 14), `Routine ${Math.round(sel.quota * 100)}%`),
        h("span", { class: sel.uscite <= sel.limite ? "ok" : "no" }, icona(sel.uscite <= sel.limite ? "check" : "x", 14), `Spese ${euro(sel.uscite)} su ${euro(sel.limite)}`))
    : h("p", { class: "testo-leggero piccolo" }, "Tocca un quadratino per vedere com'è andato quel giorno.");

  const monitor = pannello("card-monitor", "Monitor della routine", navMese,
    griglia,
    h("div", { class: "legenda" },
      h("span", {}, h("i", { class: "leg-nero" }), "Non rispettata"),
      h("span", {}, h("i", { class: "leg-giallo" }), "Rispettata"),
      h("span", {}, h("i", { class: "leg-futuro" }), "Deve ancora arrivare")),
    dettaglio,
    h("p", { class: "testo-leggero piccolo" },
      `Regola: un giorno è giallo se fai almeno il ${SOGLIA_ROUTINE * 100}% delle attività quotidiane e non superi il budget giornaliero delle spese.`));

  // ---------- Punteggio ----------
  const punteggio = pannello("card-luce", null, null,
    h("small", { class: "etichetta-luce" }, "Punteggio del mese"),
    h("div", { class: "punteggio" }, anello(r.punteggio / 100, `${r.punteggio}`, 120),
      h("div", { class: "punteggio-dati" },
        h("p", {}, h("strong", {}, r.rispettati), ` giorni rispettati su ${r.contati}`),
        h("p", {}, h("strong", {}, r.serie), " giorni di fila (serie attuale)"),
        h("p", {}, h("strong", {}, r.serieMax), " record di giorni di fila"))));

  // ---------- Review con consigli ----------
  const review = pannello("card-review", "Review del mese", h("span", { class: "stelle", "aria-label": `${stelle(r.punteggio)} stelle su 5` },
    Array.from({ length: 5 }, (_, i) => h("span", { class: i < stelle(r.punteggio) ? "piena" : "" }, "★"))),
    h("p", { class: "giudizio" }, giudizio(r)),
    h("ul", { class: "lista-consigli" }, consigli(r, anno, mese).map((c) => h("li", {}, icona("scintilla", 16), h("span", {}, c)))));

  box.append(h("div", { class: "griglia-due larga-sinistra" }, monitor, h("div", { class: "colonna" }, punteggio, review)));
};

const stelle = (p) => Math.max(1, Math.round(p / 20));

function giudizio(r) {
  if (!r.contati) return "Il mese è appena iniziato: ogni giorno che completi diventa un quadratino giallo.";
  if (r.punteggio >= 85) return "Mese da campione. La routine ormai è un'abitudine: continua così e alza un po' l'asticella.";
  if (r.punteggio >= 65) return "Buon mese! Sei costante quasi sempre: lavora sui pochi giorni che ti sfuggono.";
  if (r.punteggio >= 40) return "Mese a metà: la base c'è, ma ci sono troppe giornate in cui salta qualcosa.";
  return "Mese difficile, capita. Riparti dalle cose piccole: due attività fatte bene valgono più di dieci a metà.";
}

function consigli(r, anno, mese) {
  const lista = [];
  const passati = r.giorni.filter((g) => !g.futuro && !g.oggi);

  // 1. l'attività saltata più spesso
  const saltate = stato.quotidiane.map((a) => ({
    a, volte: passati.filter((g) => ((stato.registro[g.k] || {})[a.id] || 0) < a.volte_al_giorno).length,
  })).sort((x, y) => y.volte - x.volte);
  if (saltate[0] && saltate[0].volte > 0) {
    const { a, volte } = saltate[0];
    lista.push(`«${a.nome}» è l'attività che salti di più (${volte} ${volte === 1 ? "giorno" : "giorni"}): ${CONSIGLI_ATTIVITA[a.id] || "prova a farla sempre alla stessa ora, così diventa automatica."}`);
  }

  // 2. giorni con troppe spese
  const sforati = passati.filter((g) => g.uscite > g.limite);
  if (sforati.length) {
    const perCat = {};
    for (const m of movimentiDelMese(anno, mese)) if (m.tipo === "uscita" && !m.giroconto) perCat[m.categoria] = (perCat[m.categoria] || 0) + m.importo;
    const top = Object.entries(perCat).sort((a, b) => b[1] - a[1])[0];
    lista.push(`Hai superato il budget giornaliero in ${sforati.length} giorni. La categoria dove spendi di più è «${top[0]}» (${euro(top[1])}): fissati un tetto settimanale per quella.`);
  } else if (passati.length) {
    lista.push("Spese sempre sotto controllo: non hai mai superato il budget giornaliero. Potresti mettere da parte quello che avanza.");
  }

  // 3. weekend contro giorni di scuola
  const quotaDi = (gg) => (gg.length ? gg.filter((g) => g.rispettato).length / gg.length : 0);
  const weekend = passati.filter((g) => g.d.getDay() === 0 || g.d.getDay() === 6);
  const feriali = passati.filter((g) => g.d.getDay() !== 0 && g.d.getDay() !== 6);
  if (weekend.length && feriali.length) {
    if (quotaDi(weekend) + 0.15 < quotaDi(feriali)) lista.push("Nel weekend la routine cala: tieni almeno l'orario della sveglia simile a quello dei giorni di scuola.");
    else if (quotaDi(feriali) + 0.15 < quotaDi(weekend)) lista.push("Nei giorni di scuola fai più fatica: prepara la sera prima quello che ti serve la mattina.");
  }

  // 4. quanto puoi ancora recuperare
  const rimasti = r.giorni.filter((g) => g.futuro || (g.oggi && !g.rispettato)).length;
  if (rimasti > 0) {
    const max = Math.round(((r.rispettati + rimasti) / (r.contati + rimasti)) * 100);
    lista.push(`Mancano ${rimasti} giorni alla fine del mese: se li rispetti tutti arrivi a ${max}/100.`);
  }
  return lista;
}
