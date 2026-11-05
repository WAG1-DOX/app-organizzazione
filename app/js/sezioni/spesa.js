// ===== Lista della spesa + foto dello scontrino =====
//
// Quando fotografi uno scontrino:
// 1. la foto viene rimpicciolita e salvata nel browser;
// 2. il testo viene letto in automatico (Tesseract, gratis, gira nel browser: niente AI a pagamento);
// 3. l'app trova totale, negozio e data e li propone (puoi correggerli);
// 4. premendo Salva nasce un'uscita nelle Spese, collegata allo scontrino,
//    e gli articoli comprati spariscono dalla lista.

Viste.spesa = function (box) {
  // ---------- Lista, divisa in 4 gruppi ----------
  const nome = h("input", { type: "text", placeholder: "es. Petto di pollo", required: true, maxlength: 40 });
  const quantita = h("input", { type: "text", placeholder: "es. 500 g", maxlength: 20 });
  const categoria = h("select", {}, Object.entries(CATEGORIE_SPESA).map(([c, info]) => h("option", { value: c }, info.nome)));
  let sceltaAMano = false;
  categoria.addEventListener("change", () => { sceltaAMano = true; });
  // mentre scrivi il nome, l'app indovina il gruppo (puoi sempre cambiarlo)
  nome.addEventListener("input", () => { if (!sceltaAMano) categoria.value = indovinaCategoria(nome.value); });

  const modulo = h("form", { class: "modulo-riga", onsubmit: (ev) => {
    ev.preventDefault();
    stato.listaSpesa.push({ id: nuovoId("ls"), nome: nome.value.trim(), quantita: quantita.value.trim(), categoria: categoria.value, preso: false });
    aggiorna();
    document.querySelector(".modulo-riga input").focus();
  } }, campo("Cosa comprare", nome), campo("Quantità", quantita), campo("Gruppo", categoria), h("button", { class: "bottone-accento", type: "submit" }, icona("piu", 16), "Aggiungi"));

  const presi = stato.listaSpesa.filter((i) => i.preso).length;
  const rigaArticolo = (i) => h("li", { class: `riga-promemoria${i.preso ? " fatto" : ""}` },
    h("button", { class: `spunta${i.preso ? " fatta" : ""}`, type: "button", "aria-label": i.preso ? "Segna come da prendere" : "Segna come preso",
      onclick: () => { i.preso = !i.preso; aggiorna(); } }, icona("check", 14)),
    h("span", { class: "promemoria-testo" }, i.nome, i.quantita && h("small", { class: "quantita" }, i.quantita)),
    h("select", { class: "sposta-gruppo", "aria-label": `Gruppo di ${i.nome}`, title: "Sposta in un altro gruppo",
      onchange: (ev) => { i.categoria = ev.target.value; aggiorna(); } },
      Object.entries(CATEGORIE_SPESA).map(([c, info]) => h("option", { value: c, selected: i.categoria === c }, info.nome))),
    h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": `Togli ${i.nome}`, onclick: () => {
      stato.listaSpesa = stato.listaSpesa.filter((x) => x.id !== i.id);
      aggiorna();
    } }, icona("x", 14)));

  const gruppi = h("div", { class: "gruppi-spesa" }, Object.entries(CATEGORIE_SPESA).map(([c, info]) => {
    const articoli = stato.listaSpesa.filter((i) => (i.categoria || "carboidrati") === c).sort((a, b) => a.preso - b.preso);
    const daPrendere = articoli.filter((i) => !i.preso).length;
    return h("section", { class: "gruppo-spesa", style: `--c:${info.colore}` },
      h("header", {}, h("i"), h("strong", {}, info.nome), h("span", { class: "pill piccola" }, `${daPrendere}`)),
      articoli.length ? h("ul", { class: "lista-promemoria" }, articoli.map(rigaArticolo)) : h("p", { class: "giorno-vuoto" }, "Niente"));
  }));

  const lista = pannello("", "Lista della spesa", h("span", { class: "pill" }, `${stato.listaSpesa.length - presi} da prendere`),
    modulo,
    gruppi,
    presi > 0 && h("button", { class: "bottone-secondario largo spazio-sopra", type: "button", onclick: () => {
      stato.listaSpesa = stato.listaSpesa.filter((i) => !i.preso);
      aggiorna();
    } }, `Togli i ${presi} già presi`));

  // ---------- Foto scontrino ----------
  const inputFoto = h("input", { type: "file", accept: "image/*", capture: "environment", class: "nascosto",
    onchange: (ev) => { const f = ev.target.files[0]; ev.target.value = ""; if (f) nuovaFotoScontrino(f); } });
  const foto = pannello("card-luce", null, null,
    h("span", { class: "cerchio-grande" }, icona("fotocamera", 28)),
    h("p", { class: "luce-titolo" }, "Hai fatto la spesa?"),
    h("p", { class: "testo-leggero" }, "Fotografa lo scontrino: leggo il totale da solo e lo aggiungo alle Spese."),
    h("label", { class: "bottone-accento" }, inputFoto, icona("fotocamera", 16), "Fotografa lo scontrino"));

  // ---------- Scontrini salvati ----------
  const adesso = new Date();
  const delMese = stato.scontrini.filter((s) => s.data.startsWith(`${adesso.getFullYear()}-${pad(adesso.getMonth() + 1)}`));
  const totaleMese = delMese.reduce((s, x) => s + x.totale, 0);
  const ordinati = [...stato.scontrini].sort((a, b) => b.data.localeCompare(a.data));

  const scontrini = pannello("", "Scontrini", h("span", { class: "pill" }, `${euro(totaleMese)} questo mese`),
    ordinati.length
      ? h("ul", { class: "lista-scontrini" }, ordinati.map((s) => {
          const miniatura = h("span", { class: "miniatura" }, icona("scontrino", 18));
          if (s.foto_id) Foto.leggi(s.foto_id).then((url) => { if (url) { miniatura.innerHTML = ""; miniatura.append(h("img", { src: url, alt: "" })); } }).catch(() => {});
          return h("li", {},
            h("button", { class: "riga-cliccabile", type: "button", onclick: () => apriScontrino(s) },
              miniatura,
              h("span", { class: "riga-testo" }, h("strong", {}, s.negozio || "Spesa"), h("small", {}, `${dataBreve(daChiave(s.data))}${s.movimento_id ? " · collegato alle Spese" : ""}`)),
              h("strong", {}, euro(s.totale))));
        }))
      : h("p", { class: "vuoto" }, "Ancora nessuno scontrino"));

  box.append(h("div", { class: "griglia-due larga-sinistra" }, lista, h("div", { class: "colonna" }, foto, scontrini)));
};

// ---------- Lettura automatica dello scontrino ----------
let tesseractPronto = null;
function caricaTesseract() {
  if (!tesseractPronto) {
    tesseractPronto = new Promise((ok, ko) => {
      if (window.Tesseract) return ok();
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      s.onload = ok;
      s.onerror = () => { tesseractPronto = null; ko(new Error("Non riesco a scaricare il lettore di scontrini (serve internet)")); };
      document.head.append(s);
    });
  }
  return tesseractPronto;
}

async function leggiTestoScontrino(dataUrl, avanzamento) {
  await caricaTesseract();
  const worker = await Tesseract.createWorker("ita", 1, {
    logger: (m) => { if (m.status === "recognizing text") avanzamento(m.progress); },
  });
  try {
    const { data } = await worker.recognize(dataUrl);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// Dal testo letto tira fuori totale, negozio, data e articoli della lista
function analizzaScontrino(testo) {
  const righe = testo.split("\n").map((r) => r.trim()).filter(Boolean);
  const importi = (s) => (s.match(/\d{1,4}(?:\.\d{3})*[.,]\d{2}(?!\d)/g) || [])
    .map((x) => Number(x.replace(/\.(?=\d{3}[.,])/g, "").replace(",", ".")));

  let totale = null;
  for (const r of righe) {
    if (/tot(ale)?|importo|da pagare|pagamento|contanti|carta/i.test(r) && !/sub ?tot|iva|resto/i.test(r)) {
      const n = importi(r);
      if (n.length && totale === null) totale = n[n.length - 1];
    }
  }
  if (totale === null) {
    const tutti = righe.flatMap(importi);
    if (tutti.length) totale = Math.max(...tutti);
  }

  const negozio = (righe.find((r) => /[a-zà-ù]{3,}/i.test(r) && !/scontrino|documento|commerciale|fiscale/i.test(r)) || "").slice(0, 40);

  let data = oggiChiave();
  const md = testo.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (md) {
    const g = Number(md[1]), m = Number(md[2]);
    const a = Number(md[3].length === 2 ? `20${md[3]}` : md[3]);
    if (g >= 1 && g <= 31 && m >= 1 && m <= 12 && a > 2000 && a < 2100) data = chiaveGiorno(new Date(a, m - 1, g));
  }

  const minuscolo = testo.toLowerCase();
  const trovati = stato.listaSpesa.filter((i) => minuscolo.includes(i.nome.toLowerCase().split(" ")[0].slice(0, 5))).map((i) => i.id);
  return { totale, negozio, data, trovati };
}

async function nuovaFotoScontrino(file) {
  let dataUrl;
  try { dataUrl = await rimpicciolisciFoto(file); }
  catch (e) { alert(e.message); return; }

  const barra = h("span", { style: "width:0%" });
  const messaggio = h("p", {}, "Sto leggendo lo scontrino…");
  apriModale("Nuovo scontrino",
    h("img", { class: "anteprima-scontrino", src: dataUrl, alt: "Foto dello scontrino" }),
    h("div", { class: "lettura" }, messaggio, h("span", { class: "barra-binario" }, barra)),
    h("button", { class: "bottone-secondario largo", type: "button", onclick: () => mostraModuloScontrino(dataUrl, analisiVuota(), "Scrivi tu i dati.") }, "Salta, li scrivo io"));

  let analisi = analisiVuota(), avviso = "";
  try {
    const testo = await leggiTestoScontrino(dataUrl, (p) => { barra.style.width = `${Math.round(p * 100)}%`; });
    const a = analizzaScontrino(testo);
    analisi = { ...a, trovati: [...new Set([...analisi.trovati, ...a.trovati])] };
    avviso = a.totale === null ? "Non ho trovato il totale: scrivilo tu." : "Ho letto lo scontrino: controlla che i dati siano giusti.";
  } catch (e) {
    avviso = `${e.message}. Scrivi tu i dati.`;
  }
  // se nel frattempo l'utente ha chiuso la finestra o ha scelto di scrivere a mano, ci fermiamo
  if (!document.getElementById("modale").classList.contains("aperta") || !document.querySelector(".lettura")) return;
  mostraModuloScontrino(dataUrl, analisi, avviso);
}

const analisiVuota = () => ({ totale: null, negozio: "", data: oggiChiave(), trovati: stato.listaSpesa.filter((i) => i.preso).map((i) => i.id) });

function mostraModuloScontrino(dataUrl, a, avviso) {
  const negozio = h("input", { type: "text", value: a.negozio, placeholder: "es. Esselunga", maxlength: 40 });
  const totale = h("input", { type: "number", min: 0.01, step: 0.01, value: a.totale ?? "", placeholder: "0,00", required: true });
  const data = h("input", { type: "date", value: a.data, required: true });
  const categoria = h("select", {}, Object.keys(stato.budget.categorie).map((c) => h("option", { value: c, selected: c === "Cibo" }, c)));
  const spunte = stato.listaSpesa.map((i) => ({ i, box: h("input", { type: "checkbox", checked: a.trovati.includes(i.id) }) }));

  apriModale("Nuovo scontrino",
    h("img", { class: "anteprima-scontrino piccola", src: dataUrl, alt: "Foto dello scontrino" }),
    avviso && h("p", { class: "testo-leggero piccolo" }, avviso),
    h("form", { class: "modulo", onsubmit: async (ev) => {
      ev.preventDefault();
      const idScontrino = nuovoId("sc"), idMovimento = nuovoId("mv"), idFoto = nuovoId("foto");
      let fotoSalvata = true;
      try { await Foto.salva(idFoto, dataUrl); } catch (e) { fotoSalvata = false; }
      const importo = Math.round(Number(totale.value) * 100) / 100;
      const comprati = spunte.filter((s) => s.box.checked).map((s) => s.i);

      stato.movimenti.push({
        id: idMovimento, tipo: "uscita", importo, categoria: categoria.value,
        descrizione: `Spesa · ${negozio.value.trim() || "supermercato"}`, data: data.value, scontrino_id: idScontrino,
      });
      stato.scontrini.push({
        id: idScontrino, negozio: negozio.value.trim(), data: data.value, totale: importo,
        movimento_id: idMovimento, foto_id: fotoSalvata ? idFoto : null, articoli: comprati.map((i) => i.nome),
      });
      stato.listaSpesa = stato.listaSpesa.filter((i) => !comprati.includes(i));
      chiudiModale();
      aggiorna();
    } },
      h("div", { class: "due-campi" }, campo("Negozio", negozio), campo("Totale (€)", totale)),
      h("div", { class: "due-campi" }, campo("Giorno", data), campo("Categoria", categoria)),
      spunte.length > 0 && h("fieldset", { class: "articoli" },
        h("legend", {}, "Cosa hai comprato? (si toglie dalla lista)"),
        spunte.map(({ i, box }) => h("label", { class: "spunta-riga" }, box, i.nome))),
      h("button", { class: "bottone-accento largo", type: "submit" }, icona("check", 16), "Salva e collega alle Spese")));
}

// Finestra con la foto e i dati di uno scontrino (si apre anche dalle Spese)
function apriScontrino(s) {
  const img = h("div", { class: "anteprima-scontrino vuota" }, "Foto non disponibile");
  if (s.foto_id) Foto.leggi(s.foto_id).then((url) => { if (url) img.replaceWith(h("img", { class: "anteprima-scontrino", src: url, alt: "Foto dello scontrino" })); }).catch(() => {});
  apriModale(s.negozio || "Scontrino",
    img,
    h("dl", { class: "dettagli" },
      h("dt", {}, "Giorno"), h("dd", {}, maiuscola(dataLunga(daChiave(s.data)))),
      h("dt", {}, "Totale"), h("dd", {}, euro(s.totale)),
      s.articoli && s.articoli.length > 0 && h("dt", {}, "Articoli"), s.articoli && s.articoli.length > 0 && h("dd", {}, s.articoli.join(", ")),
      h("dt", {}, "Nelle Spese"), h("dd", {}, stato.movimenti.some((m) => m.id === s.movimento_id) ? "Sì, come uscita" : "No")),
    h("div", { class: "azioni-modale" },
      h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
        if (!confirm("Eliminare lo scontrino e il pagamento collegato nelle Spese?")) return;
        stato.scontrini = stato.scontrini.filter((x) => x.id !== s.id);
        stato.movimenti = stato.movimenti.filter((m) => m.id !== s.movimento_id);
        if (s.foto_id) Foto.elimina(s.foto_id).catch(() => {});
        chiudiModale();
        aggiorna();
      } }, icona("cestino", 16), "Elimina"),
      h("button", { class: "bottone-accento", type: "button", onclick: chiudiModale }, "Ok")));
}
