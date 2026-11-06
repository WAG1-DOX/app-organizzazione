// ===== Spese: entrate, uscite e budget =====

let meseSpese = null; // primo giorno del mese mostrato

Viste.spese = function (box) {
  if (!meseSpese) meseSpese = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const anno = meseSpese.getFullYear(), mese = meseSpese.getMonth();
  const t = totaliMese(anno, mese);
  const budget = stato.budget.mensile;
  const rimasto = budget - t.uscite;
  const sposta = (n) => { meseSpese = new Date(anno, mese + n, 1); disegna(); };

  const navMese = h("div", { class: "gruppo-pill" },
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Mese precedente", onclick: () => sposta(-1) }, icona("sinistra", 16)),
    h("span", { class: "pill attiva" }, maiuscola(nomeMese(meseSpese))),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Mese successivo", onclick: () => sposta(1) }, icona("destra", 16)));

  // ---------- 4 numeri in alto ----------
  const numero = (titolo, valore, classe, nomeIcona, extra) =>
    h("div", { class: `numero-card ${classe}` },
      h("span", { class: "tessera-icona" }, icona(nomeIcona, 18)),
      h("small", {}, titolo), h("strong", {}, valore), extra);

  const conBudget = budget > 0;
  const quotaBudget = conBudget ? Math.min(1, t.uscite / budget) : 0;
  const numeri = h("div", { class: "riga-numeri" },
    numero("Entrate", euro(t.entrate), "positivo", "frecciaSu"),
    numero("Uscite", euro(t.uscite), "negativo", "frecciaGiu"),
    numero("Saldo del mese", euro(t.saldo), t.saldo >= 0 ? "" : "negativo", "portafoglio"),
    numero("Budget rimasto", conBudget ? euro(rimasto) : "—", rimasto >= 0 || !conBudget ? "accento" : "negativo", "griglia",
      h("span", { class: "barra-binario" }, h("span", { style: `width:${quotaBudget * 100}%`, class: quotaBudget > 0.9 ? "rosso" : "" }))));

  // ---------- Grafico ----------
  const grafico = pannello("card-grafico", "Andamento del saldo", navMese,
    graficoArea(puntiSaldoMese(anno, mese), { formato: (v) => euro(v), altezza: 220 }));

  // ---------- Budget per categoria ----------
  const perCategoria = {};
  for (const m of t.lista) if (m.tipo === "uscita" && !m.giroconto) perCategoria[m.categoria] = (perCategoria[m.categoria] || 0) + m.importo;

  const categorie = pannello("", "Budget per categoria",
    h("button", { class: "pill", type: "button", title: "Cambia il budget", onclick: apriModificaBudget },
      conBudget ? `${euro(budget)} al mese` : "Imposta", " ", icona("matita", 12)),
    !conBudget && h("p", { class: "vuoto" }, "Non hai ancora un budget. Premi «Imposta» per decidere quanto spendere al mese."),
    h("ul", { class: "lista-budget" }, Object.entries(stato.budget.categorie).map(([cat, limite]) => {
      const speso = perCategoria[cat] || 0;
      const quota = limite > 0 ? speso / limite : 0;
      return h("li", {},
        h("div", { class: "budget-riga" }, h("strong", {}, cat), h("span", { class: quota > 1 ? "testo-rosso" : "testo-leggero" }, `${euro(speso)} / ${euro(limite)}`)),
        h("span", { class: "barra-binario" }, h("span", { style: `width:${Math.min(1, quota) * 100}%`, class: quota > 1 ? "rosso" : quota > 0.8 ? "arancio" : "" })));
    })),
    conBudget && h("p", { class: "testo-leggero piccolo" }, `Budget di ogni giorno: ${euro(budgetGiornaliero(meseSpese))}. Se lo superi, il quadratino del Monitor resta nero.`));

  // ---------- Nuovo movimento + elenco ----------
  let tipoScelto = "uscita";
  const importo = h("input", { type: "number", min: 0.01, step: 0.01, placeholder: "0,00", required: true });
  const categoria = h("select", {});
  const descrizione = h("input", { type: "text", placeholder: "es. Pizza con gli amici", maxlength: 60 });
  const data = h("input", { type: "date", value: oggiChiave(), required: true });
  const riempiCategorie = () => {
    categoria.innerHTML = "";
    const elenco = tipoScelto === "uscita" ? categorieUscite() : categorieEntrate;
    for (const c of elenco) categoria.append(h("option", { value: c }, c));
  };
  riempiCategorie();

  const bottoniTipo = ["uscita", "entrata"].map((tp) => h("button", {
    class: `pill${tp === tipoScelto ? " attiva" : ""}`, type: "button",
    onclick: (ev) => {
      tipoScelto = tp;
      bottoniTipo.forEach((b) => b.classList.remove("attiva"));
      ev.currentTarget.classList.add("attiva");
      riempiCategorie();
    },
  }, tp === "uscita" ? "Uscita" : "Entrata"));

  const modulo = h("form", { class: "modulo-movimento", onsubmit: (ev) => {
    ev.preventDefault();
    stato.movimenti.push({
      id: nuovoId("mv"), tipo: tipoScelto, importo: Math.round(Number(importo.value) * 100) / 100,
      categoria: categoria.value, descrizione: descrizione.value.trim() || categoria.value, data: data.value,
    });
    aggiorna();
  } },
    h("div", { class: "gruppo-pill" }, bottoniTipo),
    h("div", { class: "due-campi" }, campo("Importo (€)", importo), campo("Categoria", categoria)),
    h("div", { class: "due-campi" }, campo("Descrizione", descrizione), campo("Giorno", data)),
    h("button", { class: "bottone-accento largo", type: "submit" }, icona("piu", 16), "Aggiungi movimento"));

  const lista = [...t.lista].sort((a, b) => b.data.localeCompare(a.data));
  const movimenti = pannello("", "Movimenti", h("span", { class: "pill" }, `${lista.length}`),
    modulo,
    lista.length
      ? h("ul", { class: "lista-movimenti" }, lista.map((m) =>
          h("li", {},
            h("span", { class: `cerchio-icona ${m.tipo === "entrata" ? "positivo" : ""}` }, icona(m.tipo === "entrata" ? "frecciaSu" : "frecciaGiu", 16)),
            h("span", { class: "riga-testo" }, h("strong", {}, m.descrizione),
              h("small", {},
                h("button", { class: "link-categoria", type: "button", title: "Cambia categoria", onclick: () => apriCategoriaMovimento(m) }, m.categoria),
                ` · ${dataBreve(daChiave(m.data))}`, m.conto && ` · ${m.conto}`, m.giroconto && " · non conta")),
            h("strong", { class: m.giroconto ? "testo-leggero" : m.tipo === "entrata" ? "testo-verde" : "" }, `${m.tipo === "entrata" ? "+" : "−"}${euro(m.importo)}`),
            m.scontrino_id && stato.scontrini.some((s) => s.id === m.scontrino_id) &&
              h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Vedi lo scontrino", title: "Vedi lo scontrino",
                onclick: () => apriScontrino(stato.scontrini.find((s) => s.id === m.scontrino_id)) }, icona("scontrino", 14)),
            h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Elimina movimento", onclick: () => {
              ricordaEliminato(m);   // se arrivava dalla banca o dal CSV, non lo reimportiamo
              stato.movimenti = stato.movimenti.filter((x) => x.id !== m.id);
              aggiorna();
            } }, icona("cestino", 14)))))
      : h("p", { class: "vuoto" }, "Nessun movimento in questo mese"));

  box.append(numeri, h("div", { class: "griglia-due larga-sinistra" },
    h("div", { class: "colonna" }, grafico, categorie), h("div", { class: "colonna" }, pannelloBanche(), movimenti)));
};

// ---------- Cambiare il budget: un importo per ogni categoria (il totale è la somma) ----------
// Lo usa anche la configurazione guidata (editorBudget)
function editorBudget(categorie) {
  // categorie: { "Cibo": 80, ... } → righe modificabili; restituisce { elemento, leggi() }
  const righe = Object.entries(categorie).map(([nome, euroMese]) => ({ nome, euroMese }));
  const lista = h("ul", { class: "editor-budget" });
  const totale = h("strong", {});
  const ridisegna = () => {
    lista.innerHTML = "";
    for (const r of righe) {
      const importo = h("input", { type: "number", min: 0, step: 1, value: r.euroMese, "aria-label": `Budget ${r.nome}`,
        oninput: (ev) => { r.euroMese = Math.max(0, Number(ev.target.value) || 0); aggiornaTotale(); } });
      lista.append(h("li", {}, h("span", {}, r.nome), h("span", { class: "editor-budget-euro" }, importo, "€"),
        h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": `Togli ${r.nome}`,
          onclick: () => { righe.splice(righe.indexOf(r), 1); ridisegna(); } }, icona("x", 12))));
    }
    aggiornaTotale();
  };
  const aggiornaTotale = () => { totale.textContent = euro(righe.reduce((s, r) => s + r.euroMese, 0)); };
  const nuova = h("input", { type: "text", placeholder: "Nuova categoria, es. Regali", maxlength: 30 });
  const aggiungi = h("div", { class: "modulo-chip" }, nuova,
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Aggiungi categoria", onclick: () => {
      const n = nuova.value.trim();
      if (n && !righe.some((r) => r.nome.toLowerCase() === n.toLowerCase())) righe.push({ nome: n, euroMese: 0 });
      nuova.value = "";
      ridisegna();
    } }, icona("piu", 14)));
  ridisegna();
  return {
    elemento: h("div", { class: "colonna" }, lista, aggiungi, h("p", { class: "testo-leggero" }, "Totale al mese: ", totale)),
    leggi: () => {
      const cat = Object.fromEntries(righe.map((r) => [r.nome, r.euroMese]));
      return { mensile: righe.reduce((s, r) => s + r.euroMese, 0), categorie: cat };
    },
  };
}

function apriModificaBudget() {
  const partenza = Object.keys(stato.budget.categorie).length
    ? stato.budget.categorie
    : Object.fromEntries(SUGGERIMENTI.categorieSpesa.map((c) => [c.nome, c.budget]));
  const ed = editorBudget(partenza);
  apriModale("Budget del mese",
    h("p", { class: "testo-leggero" }, "Quanto vuoi spendere al mese in ogni categoria? Metti 0 dove non vuoi un limite."),
    ed.elemento,
    h("div", { class: "azioni-modale" },
      h("button", { class: "bottone-accento", type: "button", onclick: () => { stato.budget = ed.leggi(); chiudiModale(); aggiorna(); } }, "Salva")));
}
