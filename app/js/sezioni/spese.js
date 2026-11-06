// ===== Spese: conti, saldo, entrate e uscite, budget, movimenti e consigli =====
//
// I movimenti arrivano dalla banca (banca.js, Enable Banking), dal CSV o scritti a mano.
// I totali contano solo i movimenti "veri" (contaNeiTotali in base.js: niente giroconti,
// niente conti nascosti, solo euro). I movimenti "in attesa" contano già, come nell'app della banca.

let meseSpese = null;   // primo giorno del mese mostrato
const FiltroSpese = { testo: "", tipo: "tutti", conto: "tutti", categoria: "tutte", quanti: 60, seleziona: false, scelti: new Set() };

const COLORI_CATEGORIE = ["#d1fe17", "#7dd3c0", "#f4a261", "#c3a6ff", "#8ab4f8", "#f28b82", "#fdd663", "#81c995", "#ff8bd1", "#a0a0a8"];
function coloreCategoria(c) {
  if (c === "Giroconto") return "#66666e";
  const tutte = [...new Set([...Object.keys(stato.budget.categorie), ...categorieEntrate, "Altro"])];
  const i = tutte.indexOf(c);
  return COLORI_CATEGORIE[(i < 0 ? impronta(c).length : i) % COLORI_CATEGORIE.length];
}

Viste.spese = function (box) {
  if (!meseSpese) meseSpese = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const anno = meseSpese.getFullYear(), mese = meseSpese.getMonth();
  const t = totaliMese(anno, mese);
  const budget = stato.budget.mensile;
  const conBudget = budget > 0;
  const rimasto = budget - t.uscite;
  const sposta = (n) => { meseSpese = new Date(anno, mese + n, 1); FiltroSpese.quanti = 60; disegna(); };
  const meseCorrente = anno === new Date().getFullYear() && mese === new Date().getMonth();
  const analisi = analisiMese(anno, mese);
  const totaleConti = saldoTotale();

  const navMese = h("div", { class: "gruppo-pill" },
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Mese precedente", onclick: () => sposta(-1) }, icona("sinistra", 16)),
    h("span", { class: "pill attiva" }, maiuscola(nomeMese(meseSpese))),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Mese successivo", onclick: () => sposta(1) }, icona("destra", 16)));

  // ---------- 4 numeri in alto ----------
  const numero = (titolo, valore, classe, nomeIcona, extra) =>
    h("div", { class: `numero-card ${classe}` },
      h("span", { class: "tessera-icona" }, icona(nomeIcona, 18)),
      h("small", {}, titolo), h("strong", {}, valore), extra);
  const quotaBudget = conBudget ? Math.min(1, t.uscite / budget) : 0;
  const inAttesa = t.lista.filter((m) => m.in_attesa && contaNeiTotali(m) && m.tipo === "uscita").reduce((s, m) => s + m.importo, 0);
  const numeri = h("div", { class: "riga-numeri" },
    totaleConti
      ? numero("Sui conti adesso", euro(totaleConti.totale), totaleConti.totale >= 0 ? "" : "negativo", "portafoglio", h("small", { class: "sotto-numero" }, `${totaleConti.conti} cont${totaleConti.conti === 1 ? "o" : "i"} collegat${totaleConti.conti === 1 ? "o" : "i"}`))
      : numero("Saldo del mese", euro(t.saldo), t.saldo >= 0 ? "" : "negativo", "portafoglio", h("small", { class: "sotto-numero" }, "entrate − uscite")),
    numero("Entrate", euro(t.entrate), "positivo", "frecciaSu", totaleConti && h("small", { class: "sotto-numero" }, `saldo del mese ${t.saldo >= 0 ? "+" : "−"}${euro(Math.abs(t.saldo))}`)),
    numero("Uscite", euro(t.uscite), "negativo", "frecciaGiu", inAttesa > 0 && h("small", { class: "sotto-numero" }, `di cui ${euro(inAttesa)} in attesa`)),
    numero("Budget rimasto", conBudget ? euro(rimasto) : "—", rimasto >= 0 || !conBudget ? "accento" : "negativo", "griglia",
      conBudget && h("span", { class: "barra-binario" }, h("span", { style: `width:${quotaBudget * 100}%`, class: quotaBudget > 0.9 ? "rosso" : "" })),
      conBudget && meseCorrente && t.uscite > 0 && h("small", { class: "sotto-numero" }, `${euro(Math.max(0, rimasto) / Math.max(1, giorniNelMese(anno, mese) - new Date().getDate() + 1))} al giorno fino a fine mese`)));

  // ---------- Grafico: saldo vero dei conti (se ci sono banche) o entrate − uscite del mese ----------
  const reale = puntiSaldoReale(anno, mese);
  const grafico = pannello("card-grafico", reale ? "Saldo dei conti" : "Andamento del saldo", navMese,
    graficoArea(reale || puntiSaldoMese(anno, mese), { formato: (v) => euro(v), altezza: 220 }),
    !reale && h("p", { class: "testo-leggero piccolo" }, "Entrate meno uscite dall'inizio del mese. Collega una banca per vedere i soldi veri sui conti."));

  // ---------- Budget per categoria ----------
  const perCategoria = {};
  for (const m of t.lista) if (m.tipo === "uscita" && contaNeiTotali(m)) perCategoria[m.categoria] = (perCategoria[m.categoria] || 0) + m.importo;
  const fuoriBudget = Object.entries(perCategoria).filter(([c]) => !(c in stato.budget.categorie));
  const rigaCategoria = (cat, speso, limite) => {
    const quota = limite > 0 ? speso / limite : 0;
    return h("li", { class: "riga-budget-cliccabile", onclick: () => { FiltroSpese.categoria = cat; FiltroSpese.quanti = 60; ridisegnaFermo(); document.querySelector(".pannello-movimenti")?.scrollIntoView({ behavior: "smooth" }); } },
      h("div", { class: "budget-riga" },
        h("strong", {}, h("i", { class: "pallino-categoria", style: `background:${coloreCategoria(cat)}` }), cat),
        h("span", { class: quota > 1 ? "testo-rosso" : "testo-leggero" }, limite > 0 ? `${euro(speso)} / ${euro(limite)}` : euro(speso))),
      limite > 0 && h("span", { class: "barra-binario" }, h("span", { style: `width:${Math.min(1, quota) * 100}%`, class: quota > 1 ? "rosso" : quota > 0.8 ? "arancio" : "" })));
  };
  const categorie = pannello("", "Budget per categoria",
    h("button", { class: "pill", type: "button", title: "Cambia il budget", onclick: apriModificaBudget },
      conBudget ? `${euro(budget)} al mese` : "Imposta", " ", icona("matita", 12)),
    !conBudget && h("p", { class: "vuoto" }, "Non hai ancora un budget. Premi «Imposta» per decidere quanto spendere al mese."),
    h("ul", { class: "lista-budget" },
      Object.entries(stato.budget.categorie).map(([cat, limite]) => rigaCategoria(cat, perCategoria[cat] || 0, limite)),
      fuoriBudget.map(([cat, speso]) => rigaCategoria(cat, speso, 0))),
    conBudget && h("p", { class: "testo-leggero piccolo" }, `Budget di ogni giorno: ${euro(budgetGiornaliero(meseSpese))}. Se lo superi, il quadratino del Monitor resta nero. Tocca una categoria per vederne i movimenti.`));

  // ---------- Analisi e consigli ----------
  const consigli = pannello("pannello-consigli", "Analisi e consigli", null,
    analisi.consigli.length
      ? h("ul", { class: "lista-consigli" }, analisi.consigli.map((c) =>
          h("li", { class: `consiglio${c.tono ? ` tono-${c.tono}` : ""}` }, h("span", { class: "consiglio-icona" }, icona(c.icona, 15)), h("span", {}, c.testo))))
      : h("p", { class: "vuoto" }, "Servono un po' di movimenti per i consigli. Collega una banca o importa un CSV."),
    analisi.topNegozi.length > 0 && h("div", { class: "classifica" },
      h("small", { class: "etichetta-luce" }, "Dove vanno i soldi"),
      h("ol", {}, analisi.topNegozi.map(([n, v]) => h("li", {}, h("span", {}, n), h("strong", {}, euro(v)))))),
    analisi.abbonamenti.length > 0 && h("div", { class: "classifica" },
      h("small", { class: "etichetta-luce" }, `Spese che si ripetono · ${euro(analisi.totAbb)} al mese`),
      h("ol", {}, analisi.abbonamenti.slice(0, 8).map((a) => h("li", {},
        h("span", {}, a.nome, h("small", {}, ` ${a.frequenza} · prossima ~${dataBreve(daChiave(a.prossimo))}`)),
        h("strong", {}, euro(a.importo)))))));

  box.append(numeri, h("div", { class: "griglia-due larga-sinistra" },
    h("div", { class: "colonna" }, grafico, categorie, consigli),
    h("div", { class: "colonna" }, pannelloBanche(), pannelloMovimenti(t.lista))));
};

// ---------- Movimenti: filtri, ricerca, raggruppati per giorno, selezione multipla ----------
function pannelloMovimenti(listaMese) {
  const f = FiltroSpese;
  const conti = {};
  for (const m of listaMese) conti[m.conto_chiave || (m.fonte === "csv" ? "csv" : "mano")] = m.conto_chiave ? nomeConto(m.conto_chiave, m.conto) : m.fonte === "csv" ? "Da CSV" : "Scritti a mano";
  const categorieMese = [...new Set(listaMese.map((m) => m.categoria))].sort();

  const cerca = h("input", { type: "search", placeholder: "Cerca (es. Esselunga, 12,50)", value: f.testo, autocomplete: "off" });
  const segmento = h("div", { class: "segmenti piccoli" }, [["tutti", "Tutti"], ["uscita", "Uscite"], ["entrata", "Entrate"], ["attesa", "In attesa"]].map(([v, n]) =>
    h("button", { type: "button", class: f.tipo === v ? "attivo" : "", onclick: () => { f.tipo = v; f.quanti = 60; ridisegnaFermo(); } }, n)));
  const sceltaConto = h("select", { "aria-label": "Conto", onchange: (ev) => { f.conto = ev.target.value; f.quanti = 60; ridisegnaFermo(); } },
    h("option", { value: "tutti" }, "Tutti i conti"), Object.entries(conti).map(([k, n]) => h("option", { value: k, selected: f.conto === k }, n)));
  const sceltaCategoria = h("select", { "aria-label": "Categoria", onchange: (ev) => { f.categoria = ev.target.value; f.quanti = 60; ridisegnaFermo(); } },
    h("option", { value: "tutte" }, "Tutte le categorie"), categorieMese.map((c) => h("option", { value: c, selected: f.categoria === c }, c)));

  const elenco = h("div", { class: "elenco-movimenti" });
  const filtrati = () => {
    const testo = f.testo.trim().toLowerCase().replace(",", ".");
    return listaMese.filter((m) => {
      if (f.tipo === "attesa" ? !m.in_attesa : f.tipo !== "tutti" && m.tipo !== f.tipo) return false;
      const k = m.conto_chiave || (m.fonte === "csv" ? "csv" : "mano");
      if (f.conto !== "tutti" && k !== f.conto) return false;
      if (f.categoria !== "tutte" && m.categoria !== f.categoria) return false;
      if (testo && !`${m.descrizione} ${m.originale || ""} ${m.categoria} ${m.importo.toFixed(2)} ${m.conto || ""} ${m.nota || ""}`.toLowerCase().includes(testo)) return false;
      return true;
    }).sort((a, b) => b.data.localeCompare(a.data) || (a.in_attesa ? -1 : 0));
  };

  const disegnaElenco = () => {
    const lista = filtrati();
    const visibili = lista.slice(0, f.quanti);
    const perGiorno = {};
    for (const m of visibili) (perGiorno[m.data] = perGiorno[m.data] || []).push(m);
    const totaleFiltro = lista.filter(contaNeiTotali).reduce((s, m) => s + (m.tipo === "entrata" ? m.importo : -m.importo), 0);
    elenco.replaceChildren(...[
      (f.testo || f.tipo !== "tutti" || f.conto !== "tutti" || f.categoria !== "tutte") && h("div", { class: "riepilogo-filtro" },
        h("span", {}, `${lista.length} moviment${lista.length === 1 ? "o" : "i"} · totale ${totaleFiltro >= 0 ? "+" : "−"}${euro(Math.abs(totaleFiltro))}`),
        h("button", { class: "link-sottile", type: "button", onclick: () => { Object.assign(f, { testo: "", tipo: "tutti", conto: "tutti", categoria: "tutte", quanti: 60 }); ridisegnaFermo(); } }, "Togli i filtri")),
      lista.length === 0 && h("p", { class: "vuoto" }, listaMese.length ? "Nessun movimento con questi filtri" : "Nessun movimento in questo mese"),
      ...Object.entries(perGiorno).map(([giorno, mov]) => {
        const usciteGiorno = mov.filter((m) => m.tipo === "uscita" && contaNeiTotali(m)).reduce((s, m) => s + m.importo, 0);
        return h("section", { class: "giorno-movimenti" },
          h("div", { class: "giorno-movimenti-testa" }, h("span", {}, maiuscola(dataLunga(daChiave(giorno)))), usciteGiorno > 0 && h("span", {}, `−${euro(usciteGiorno)}`)),
          h("ul", { class: "lista-movimenti" }, mov.map(rigaMovimento)));
      }),
      lista.length > visibili.length && h("button", { class: "bottone-secondario largo", type: "button", onclick: () => { f.quanti += 100; disegnaElenco(); } }, `Mostra altri ${Math.min(100, lista.length - visibili.length)}`),
    ].filter(Boolean));   // (replaceChildren scriverebbe "false" per gli elementi saltati)
    barraSelezione();
  };

  const rigaMovimento = (m) => {
    const conta = contaNeiTotali(m);
    const scelto = f.scelti.has(m.id);
    return h("li", { class: `riga-movimento${conta ? "" : " non-conta"}${scelto ? " scelta" : ""}`, onclick: () => {
      if (f.seleziona) { scelto ? f.scelti.delete(m.id) : f.scelti.add(m.id); disegnaElenco(); }
      else apriDettaglioMovimento(m);
    } },
      f.seleziona && h("span", { class: `spunta${scelto ? " fatta" : ""}` }, icona("check", 12)),
      h("span", { class: "avatar-movimento", style: `--colore:${coloreCategoria(m.categoria)}` }, (m.descrizione || "?")[0].toUpperCase()),
      h("span", { class: "riga-testo" },
        h("strong", {}, m.descrizione),
        h("small", {}, h("span", { class: "etichetta-categoria", style: `--colore:${coloreCategoria(m.categoria)}` }, m.categoria),
          m.conto && ` · ${m.conto_chiave ? nomeConto(m.conto_chiave, m.conto) : m.conto}`,
          m.in_attesa && h("span", { class: "pill piccola urgente" }, "in attesa"),
          m.giroconto && " · non conta", m.valuta && ` · ${m.valuta}`)),
      h("strong", { class: `importo-movimento${!conta ? " testo-leggero" : m.tipo === "entrata" ? " testo-verde" : ""}` },
        `${m.tipo === "entrata" ? "+" : "−"}${euroValuta(m.importo, m.valuta || "EUR")}`));
  };

  const barra = h("div", { class: "barra-selezione" });
  const barraSelezione = () => {
    barra.style.display = f.seleziona ? "" : "none";
    if (!f.seleziona) return;
    const lista = filtrati();
    const scelti = stato.movimenti.filter((m) => f.scelti.has(m.id));
    barra.replaceChildren(
      h("span", {}, `${scelti.length} scelt${scelti.length === 1 ? "o" : "i"}`),
      h("button", { class: "link-sottile", type: "button", onclick: () => { lista.forEach((m) => f.scelti.add(m.id)); disegnaElenco(); } }, `Tutti (${lista.length})`),
      h("span", { class: "spazio" }),
      h("button", { class: "bottone-secondario", type: "button", disabled: !scelti.length, onclick: () => apriCategoriaMultipla(scelti) }, "Categoria"),
      h("button", { class: "bottone-secondario pericolo", type: "button", disabled: !scelti.length, onclick: () => {
        if (!confirm(`Eliminare ${scelti.length} movimenti? Quelli arrivati dalla banca non verranno reimportati (puoi ripristinarli da «Conti e banche»).`)) return;
        f.scelti.clear(); f.seleziona = false; eliminaMovimenti(scelti);
      } }, icona("cestino", 14), "Elimina"));
  };

  cerca.addEventListener("input", () => { f.testo = cerca.value; f.quanti = 60; disegnaElenco(); });

  const azioni = h("div", { class: "pannello-azioni-gruppo" },
    h("button", { class: `pill${f.seleziona ? " attiva" : ""}`, type: "button", onclick: () => { f.seleziona = !f.seleziona; f.scelti.clear(); ridisegnaFermo(); } }, f.seleziona ? "Fine" : "Seleziona"),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Aggiungi un movimento a mano", title: "Aggiungi a mano", onclick: apriNuovoMovimento }, icona("piu", 16)));

  const p = pannello("pannello-movimenti", "Movimenti", azioni,
    h("div", { class: "filtri-movimenti" }, cerca, segmento, h("div", { class: "due-campi stretti" }, sceltaConto, sceltaCategoria)),
    barra, elenco);
  disegnaElenco();
  return p;
}

// ---------- Dettaglio di un movimento ----------
function apriDettaglioMovimento(m) {
  const elenco = m.tipo === "entrata" ? [...categorieEntrate, "Giroconto"] : [...categorieUscite(), "Giroconto"];
  if (!elenco.includes(m.categoria)) elenco.unshift(m.categoria);
  const scelta = h("select", {}, elenco.map((c) => h("option", { value: c, selected: c === m.categoria }, c)));
  const quanti = m.negozio ? stato.movimenti.filter((x) => x !== m && x.negozio === m.negozio && x.tipo === m.tipo).length : 0;
  const perTutti = h("input", { type: "checkbox", checked: quanti > 0 });
  const nome = h("input", { type: "text", value: m.descrizione, maxlength: 60 });
  const nota = h("input", { type: "text", value: m.nota || "", maxlength: 120, placeholder: "es. regalo per Marco" });
  apriModale(m.descrizione,
    h("div", { class: "dettaglio-importo" },
      h("strong", { class: m.tipo === "entrata" ? "testo-verde" : "" }, `${m.tipo === "entrata" ? "+" : "−"}${euroValuta(m.importo, m.valuta || "EUR")}`),
      m.in_attesa && h("span", { class: "pill piccola urgente" }, "in attesa: diventa definitivo quando la banca lo conferma")),
    h("dl", { class: "dettagli" },
      h("dt", {}, "Giorno"), h("dd", {}, maiuscola(dataLunga(daChiave(m.data)))),
      (m.banca || m.conto) && [h("dt", {}, "Conto"), h("dd", {}, [m.banca, m.conto_chiave ? nomeConto(m.conto_chiave, m.conto) : m.conto].filter(Boolean).join(" · "))],
      h("dt", {}, "Da dove"), h("dd", {}, m.fonte === "banca" ? "Dalla banca (Enable Banking)" : m.fonte === "csv" ? "Dall'estratto conto (CSV)" : "Scritto a mano"),
      m.originale && m.originale !== m.descrizione && [h("dt", {}, "Testo della banca"), h("dd", { class: "testo-originale" }, m.originale)]),
    h("div", { class: "modulo" },
      campo("Nome", nome),
      campo("Categoria", scelta),
      quanti > 0 && h("label", { class: "spunta-riga" }, perTutti, h("span", {}, `Usa questa categoria anche per ${quanti === 1 ? "l'altro movimento" : `gli altri ${quanti} movimenti`} di «${m.descrizione}» e per quelli futuri`)),
      campo("Nota", nota),
      h("div", { class: "azioni-modale" },
        h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
          if (m.fonte && !confirm("Eliminarlo? Non verrà reimportato dalla banca (puoi ripristinarlo da «Conti e banche»).")) return;
          chiudiModale(); eliminaMovimenti([m]);
        } }, icona("cestino", 14), "Elimina"),
        h("button", { class: "bottone-accento", type: "button", onclick: () => {
          m.descrizione = nome.value.trim() || m.descrizione;
          m.nota = nota.value.trim() || undefined;
          if (scelta.value !== m.categoria || perTutti.checked) impostaCategoria(m, scelta.value, quanti > 0 && perTutti.checked);
          chiudiModale(); aggiorna();
        } }, "Salva"))));
}

function apriCategoriaMultipla(lista) {
  const tipi = new Set(lista.map((m) => m.tipo));
  const elenco = tipi.size === 1 && tipi.has("entrata") ? [...categorieEntrate, "Giroconto"] : [...categorieUscite(), "Giroconto"];
  const scelta = h("select", {}, elenco.map((c) => h("option", { value: c }, c)));
  const impara = h("input", { type: "checkbox", checked: true });
  apriModale(`Categoria di ${lista.length} movimenti`,
    h("div", { class: "modulo" }, campo("Categoria", scelta),
      h("label", { class: "spunta-riga" }, impara, h("span", {}, "Ricordala per questi negozi anche in futuro")),
      h("button", { class: "bottone-accento largo", type: "button", onclick: () => {
        for (const m of lista) impostaCategoria(m, scelta.value, impara.checked);
        FiltroSpese.seleziona = false; FiltroSpese.scelti.clear();
        chiudiModale(); aggiorna();
      } }, "Applica")));
}

// ---------- Aggiungere un movimento a mano ----------
function apriNuovoMovimento() {
  let tipoScelto = "uscita";
  const importo = h("input", { type: "number", min: 0.01, step: 0.01, placeholder: "0,00", required: true });
  const categoria = h("select", {});
  const descrizione = h("input", { type: "text", placeholder: "es. Pizza con gli amici", maxlength: 60 });
  const data = h("input", { type: "date", value: oggiChiave(), required: true });
  const riempiCategorie = () => {
    categoria.innerHTML = "";
    for (const c of tipoScelto === "uscita" ? categorieUscite() : categorieEntrate) categoria.append(h("option", { value: c }, c));
  };
  riempiCategorie();
  const bottoniTipo = ["uscita", "entrata"].map((tp) => h("button", {
    class: `pill${tp === tipoScelto ? " attiva" : ""}`, type: "button",
    onclick: (ev) => { tipoScelto = tp; bottoniTipo.forEach((b) => b.classList.remove("attiva")); ev.currentTarget.classList.add("attiva"); riempiCategorie(); },
  }, tp === "uscita" ? "Uscita" : "Entrata"));
  apriModale("Nuovo movimento",
    h("p", { class: "testo-leggero piccolo" }, "Per contanti o spese che la banca non vede. Se poi arriva lo stesso movimento dalla banca (stesso giorno e importo), non viene contato due volte."),
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      const desc = descrizione.value.trim() || categoria.value;
      stato.movimenti.push({
        id: nuovoId("mv"), tipo: tipoScelto, importo: Math.round(Number(importo.value) * 100) / 100,
        categoria: categoria.value, descrizione: desc, negozio: desc.toLowerCase(), data: data.value, categoria_manuale: true,
      });
      chiudiModale(); aggiorna();
    } },
      h("div", { class: "gruppo-pill" }, bottoniTipo),
      h("div", { class: "due-campi" }, campo("Importo (€)", importo), campo("Categoria", categoria)),
      h("div", { class: "due-campi" }, campo("Descrizione", descrizione), campo("Giorno", data)),
      h("button", { class: "bottone-accento largo", type: "submit" }, icona("piu", 16), "Aggiungi")));
}

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
