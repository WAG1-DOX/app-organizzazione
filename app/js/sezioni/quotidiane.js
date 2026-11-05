// ===== Quotidiane e nutrizione =====

const PASTI = [
  { id: "colazione", nome: "Colazione", esempio: "es. latte, cereali, frutta" },
  { id: "pranzo", nome: "Pranzo", esempio: "es. pasta, verdure" },
  { id: "merenda", nome: "Merenda", esempio: "es. yogurt, frutta secca" },
  { id: "cena", nome: "Cena", esempio: "es. pesce, insalata, pane" },
];
const BICCHIERI_OBIETTIVO = 8;

Viste.quotidiane = function (box) {
  const k = oggiChiave();
  if (!stato.registro[k]) stato.registro[k] = {};
  const reg = stato.registro[k];
  const q = quotaQuotidiane(k);

  // ---------- Routine di oggi ----------
  const righe = stato.quotidiane.map((a) => {
    const fatte = Math.min(reg[a.id] || 0, a.volte_al_giorno);
    const completa = fatte >= a.volte_al_giorno;
    const segna = (i) => { reg[a.id] = i < fatte ? i : i + 1; aggiorna(); };

    return h("li", { class: `riga-attivita${completa ? " completa" : ""}` },
      h("span", { class: "cerchio-icona" }, icona(a.icona || "sole", 20)),
      h("div", { class: "riga-testo" },
        h("strong", {}, a.nome),
        h("small", {}, `${durata(a.minuti)} · ${a.volte_al_giorno === 1 ? "1 volta" : `${a.volte_al_giorno} volte`} al giorno · ${durata(a.minuti * a.volte_al_giorno)} in tutto`)),
      h("div", { class: "pallini" }, Array.from({ length: a.volte_al_giorno }, (_, i) =>
        h("button", {
          class: `pallino${i < fatte ? " fatto" : ""}`, type: "button",
          "aria-label": `${a.nome}: volta ${i + 1}${i < fatte ? " (fatta)" : ""}`, onclick: () => segna(i),
        }, icona("check", 16)))),
      h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": `Elimina ${a.nome}`, onclick: () => {
        if (!confirm(`Eliminare «${a.nome}» dalle attività quotidiane?`)) return;
        stato.quotidiane = stato.quotidiane.filter((x) => x.id !== a.id);
        aggiorna();
      } }, icona("x", 14)));
  });

  const nome = h("input", { type: "text", placeholder: "es. Skincare", required: true, maxlength: 40 });
  const minuti = h("input", { type: "number", min: 1, max: 240, value: 5, required: true });
  const volte = h("input", { type: "number", min: 1, max: 6, value: 1, required: true });
  const modulo = h("form", { class: "modulo-riga", onsubmit: (ev) => {
    ev.preventDefault();
    stato.quotidiane.push({ id: nuovoId("q"), nome: nome.value.trim(), minuti: Number(minuti.value), volte_al_giorno: Number(volte.value), icona: "sole" });
    aggiorna();
  } },
    campo("Nuova attività", nome), campo("Minuti", minuti), campo("Volte al giorno", volte),
    h("button", { class: "bottone-accento", type: "submit" }, icona("piu", 16), "Aggiungi"));

  const routine = pannello("card-routine", "Routine di oggi", h("span", { class: "pill" }, maiuscola(dataBreve(new Date()))),
    h("div", { class: "routine-testa" },
      anello(q.quota, `${Math.round(q.quota * 100)}%`, 104),
      h("div", {},
        h("p", { class: "numero-medio" }, `${q.fatte} su ${q.totali}`),
        h("p", { class: "testo-leggero" }, `Le attività quotidiane ti occupano ${durata(minutiQuotidiane())} al giorno.`),
        h("p", { class: "testo-leggero piccolo" }, `Con almeno il ${SOGLIA_ROUTINE * 100}% fatto (e il budget rispettato) il quadratino di oggi nel Monitor diventa giallo.`))),
    h("ul", { class: "lista-attivita" }, righe),
    modulo);

  // ---------- Acqua ----------
  const bicchieri = stato.acqua[k] || 0;
  const acqua = pannello("", "Acqua", h("span", { class: "pill" }, `${bicchieri * 250} ml`),
    h("div", { class: "bicchieri" }, Array.from({ length: BICCHIERI_OBIETTIVO }, (_, i) =>
      h("button", {
        class: `bicchiere${i < bicchieri ? " pieno" : ""}`, type: "button", "aria-label": `${i + 1} bicchieri`,
        onclick: () => { stato.acqua[k] = i < bicchieri ? i : i + 1; aggiorna(); },
      }, icona("bicchiere", 22)))),
    h("p", { class: "testo-leggero piccolo" }, `${bicchieri} di ${BICCHIERI_OBIETTIVO} bicchieri (un bicchiere = 250 ml). Tocca un bicchiere per segnarlo.`));

  // ---------- Pasti ----------
  if (!stato.pasti[k]) stato.pasti[k] = {};
  const pastiOggi = stato.pasti[k];
  const pasti = pannello("", "Pasti di oggi", h("span", { class: "pill" }, `${PASTI.filter((p) => pastiOggi[p.id]).length}/${PASTI.length}`),
    h("ul", { class: "lista-pasti" }, PASTI.map((p) => {
      const segno = h("span", { class: `segno-pasto${pastiOggi[p.id] ? " fatto" : ""}` }, icona("check", 14));
      return h("li", {},
        segno,
        h("label", { class: "pasto" },
          h("strong", {}, p.nome),
          h("input", { type: "text", placeholder: p.esempio, value: pastiOggi[p.id] || "", maxlength: 80,
            // salviamo mentre scrivi, senza ridisegnare (così non perdi il punto in cui scrivi)
            oninput: (ev) => { pastiOggi[p.id] = ev.target.value; segno.classList.toggle("fatto", !!ev.target.value.trim()); salva(); },
          })));
    })),
    h("div", { class: "consiglio" }, icona("mela", 18), h("p", {}, consiglioNutrizione(bicchieri, pastiOggi))));

  box.append(h("div", { class: "griglia-due" }, routine, h("div", { class: "colonna" }, acqua, pasti)));
};

function consiglioNutrizione(bicchieri, pasti) {
  const ora = new Date().getHours();
  if (!pasti.colazione && ora >= 10) return "Non hai segnato la colazione: è il pasto che ti dà energia per le lezioni del mattino.";
  if (bicchieri < 3 && ora >= 14) return "Sei indietro con l'acqua: prova a tenere una borraccia sul banco.";
  if (!pasti.merenda && ora >= 17) return "Prima dell'allenamento una merenda leggera (frutta o yogurt) aiuta tanto.";
  if (bicchieri >= BICCHIERI_OBIETTIVO) return "Obiettivo acqua raggiunto, ottimo! 💧";
  return "Cerca di avere in ogni pasto un po' di verdura o frutta, e bevi a piccoli sorsi durante il giorno.";
}
