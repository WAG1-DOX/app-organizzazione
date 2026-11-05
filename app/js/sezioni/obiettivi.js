// ===== Obiettivi a lungo termine, divisi in categorie che crei tu =====
// Ogni categoria è un riquadro sullo schermo. Gli obiettivi si trascinano da un riquadro all'altro.

const COLORI_CATEGORIA = ["#d1fe17", "#7dd3c0", "#c3a6ff", "#f4a261", "#8ab4f8", "#f28b82", "#9be89b", "#e6c79c"];

// Avanzamento di un obiettivo: dai passi spuntati (o 100% se è segnato come raggiunto)
function avanzamento(o) {
  if (o.fatto) return 1;
  if (!o.passi.length) return 0;
  return o.passi.filter((p) => p.fatto).length / o.passi.length;
}

function etichettaScadenza(o) {
  if (!o.scadenza) return null;
  const giorni = Math.round((daChiave(o.scadenza) - daChiave(oggiChiave())) / 86400000);
  if (o.fatto) return h("span", { class: "pill piccola" }, dataBreve(daChiave(o.scadenza)));
  if (giorni < 0) return h("span", { class: "pill piccola pericolo" }, "scaduto");
  if (giorni <= 14) return h("span", { class: "pill piccola urgente" }, giorni === 0 ? "oggi" : `tra ${giorni} g`);
  const mesi = Math.round(giorni / 30);
  return h("span", { class: "pill piccola", title: dataLunga(daChiave(o.scadenza)) }, giorni < 60 ? `tra ${giorni} g` : `tra ${mesi} mesi`);
}

Viste.obiettivi = function (box) {
  const tutti = stato.obiettiviLungo;
  const raggiunti = tutti.filter((o) => o.fatto).length;
  const media = tutti.length ? tutti.reduce((s, o) => s + avanzamento(o), 0) / tutti.length : 0;

  // ---------- Riepilogo ----------
  const riepilogo = h("div", { class: "riga-numeri" },
    h("div", { class: "numero-card" }, h("small", {}, "Obiettivi"), h("strong", {}, String(tutti.length)), h("span", { class: "testo-leggero piccolo" }, `in ${stato.categorieObiettivi.length} categorie`)),
    h("div", { class: "numero-card" }, h("small", {}, "Raggiunti"), h("strong", {}, String(raggiunti)), h("span", { class: "testo-leggero piccolo" }, "complimenti 🎉")),
    h("div", { class: "numero-card accento" }, h("small", {}, "Avanzamento medio"), h("strong", {}, `${Math.round(media * 100)}%`),
      h("span", { class: "barra-binario" }, h("span", { style: `width:${Math.round(media * 100)}%` }))),
    h("div", { class: "numero-card azioni-obiettivi" },
      h("button", { class: "bottone-accento", type: "button", onclick: () => apriObiettivo(null, stato.categorieObiettivi[0] && stato.categorieObiettivi[0].id) }, icona("piu", 16), "Nuovo obiettivo"),
      h("button", { class: "bottone-secondario", type: "button", onclick: () => apriCategoria(null) }, icona("piu", 16), "Nuova categoria")));

  // ---------- Un riquadro per ogni categoria ----------
  const riquadri = stato.categorieObiettivi.map((c, i) => {
    const obiettivi = tutti.filter((o) => o.categoria_id === c.id)
      .sort((a, b) => (a.fatto - b.fatto) || (a.scadenza || "9999").localeCompare(b.scadenza || "9999"));

    const sposta = (n) => {
      const lista = stato.categorieObiettivi;
      const j = i + n;
      if (j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      aggiorna();
    };

    const riquadro = h("section", { class: "pannello categoria-obiettivi", style: `--c:${c.colore}` },
      h("header", { class: "categoria-testa" },
        h("i", { class: "categoria-pallino" }),
        h("h3", {}, c.nome),
        h("span", { class: "pill piccola" }, String(obiettivi.length)),
        h("div", { class: "categoria-azioni" },
          h("button", { class: "icona-tonda piccola fantasma-chiaro", type: "button", "aria-label": "Sposta a sinistra", disabled: i === 0, onclick: () => sposta(-1) }, icona("sinistra", 14)),
          h("button", { class: "icona-tonda piccola fantasma-chiaro", type: "button", "aria-label": "Sposta a destra", disabled: i === stato.categorieObiettivi.length - 1, onclick: () => sposta(1) }, icona("destra", 14)),
          h("button", { class: "icona-tonda piccola fantasma-chiaro", type: "button", "aria-label": `Modifica ${c.nome}`, onclick: () => apriCategoria(c) }, icona("matita", 14)))),
      obiettivi.length
        ? h("ul", { class: "lista-obiettivi" }, obiettivi.map((o) => cartaObiettivo(o)))
        : h("p", { class: "giorno-vuoto" }, "Nessun obiettivo qui. Trascinane uno o creane uno nuovo."),
      h("button", { class: "aggiungi-obiettivo", type: "button", onclick: () => apriObiettivo(null, c.id) }, icona("piu", 14), "Aggiungi obiettivo"));

    // si può lasciare cadere qui un obiettivo preso da un'altra categoria
    riquadro.addEventListener("dragover", (ev) => { ev.preventDefault(); riquadro.classList.add("sopra"); });
    riquadro.addEventListener("dragleave", (ev) => { if (!riquadro.contains(ev.relatedTarget)) riquadro.classList.remove("sopra"); });
    riquadro.addEventListener("drop", (ev) => {
      ev.preventDefault();
      riquadro.classList.remove("sopra");
      const [cosa, id] = ev.dataTransfer.getData("text/plain").split(":");
      const o = cosa === "obiettivo" && stato.obiettiviLungo.find((x) => x.id === id);
      if (o && o.categoria_id !== c.id) { o.categoria_id = c.id; aggiorna(); }
    });
    return riquadro;
  });

  box.append(riepilogo,
    stato.categorieObiettivi.length
      ? h("div", { class: "griglia-obiettivi" }, riquadri)
      : pannello("", null, null, h("p", { class: "vuoto" }, "Crea la tua prima categoria (es. Scuola, Sport, Personale)")));
};

function cartaObiettivo(o) {
  const quota = avanzamento(o);
  return h("li", {
    class: `carta-obiettivo${o.fatto ? " raggiunto" : ""}`, draggable: "true",
    ondragstart: (ev) => { ev.dataTransfer.setData("text/plain", `obiettivo:${o.id}`); ev.dataTransfer.effectAllowed = "move"; },
  },
    h("div", { class: "obiettivo-testa" },
      h("button", { class: `spunta${o.fatto ? " fatta" : ""}`, type: "button", "aria-label": o.fatto ? "Segna come non raggiunto" : "Segna come raggiunto",
        onclick: () => { o.fatto = !o.fatto; aggiorna(); } }, icona("check", 14)),
      h("button", { class: "obiettivo-titolo", type: "button", onclick: () => apriObiettivo(o) }, o.titolo),
      etichettaScadenza(o)),
    o.descrizione && h("p", { class: "obiettivo-descrizione" }, o.descrizione),
    h("div", { class: "obiettivo-avanzamento" },
      h("span", { class: "barra-binario" }, h("span", { style: `width:${Math.round(quota * 100)}%;background:var(--c)` })),
      h("small", {}, o.passi.length ? `${o.passi.filter((p) => p.fatto).length}/${o.passi.length} passi` : `${Math.round(quota * 100)}%`)),
    o.passi.length > 0 && !o.fatto && h("ul", { class: "passi-obiettivo" }, o.passi.map((p) => h("li", {},
      h("label", { class: `passo${p.fatto ? " fatto" : ""}` },
        h("input", { type: "checkbox", checked: p.fatto, onchange: (ev) => { p.fatto = ev.target.checked; aggiorna(); } }),
        h("span", {}, p.testo))))));
}

// ---------- Finestra: creare o modificare un obiettivo ----------
function apriObiettivo(o, categoriaId) {
  const nuovo = !o;
  const titolo = h("input", { type: "text", value: o ? o.titolo : "", placeholder: "es. Superare l'esame di Accounting con 28", required: true, maxlength: 100, class: "input-titolo" });
  const categoria = h("select", {}, stato.categorieObiettivi.map((c) => h("option", { value: c.id, selected: c.id === (o ? o.categoria_id : categoriaId) }, c.nome)));
  const scadenza = h("input", { type: "date", value: o ? o.scadenza || "" : "" });
  const descrizione = h("textarea", { rows: 2, placeholder: "Perché è importante per te? (facoltativo)" });
  descrizione.value = o ? o.descrizione || "" : "";

  // i passi si modificano su una copia, salvata solo con "Salva"
  const passi = structuredClone(o ? o.passi : []);
  const listaPassi = h("ul", { class: "editor-lista" });
  const disegnaPassi = () => {
    listaPassi.innerHTML = "";
    passi.forEach((p, i) => listaPassi.append(h("li", { class: "editor-riga" },
      h("input", { type: "checkbox", checked: p.fatto, "aria-label": "Fatto", onchange: (ev) => { p.fatto = ev.target.checked; } }),
      h("input", { type: "text", value: p.testo, class: "lungo", "aria-label": `Passo ${i + 1}`, oninput: (ev) => { p.testo = ev.target.value; } }),
      h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Togli passo", onclick: () => { passi.splice(i, 1); disegnaPassi(); } }, icona("x", 14)))));
  };
  disegnaPassi();
  const nuovoPasso = h("input", { type: "text", placeholder: "Aggiungi un passo e premi Invio", maxlength: 100 });
  nuovoPasso.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    if (!nuovoPasso.value.trim()) return;
    passi.push({ id: nuovoId("ps"), testo: nuovoPasso.value.trim(), fatto: false });
    nuovoPasso.value = "";
    disegnaPassi();
  });

  if (!stato.categorieObiettivi.length) { apriCategoria(null); return; }

  apriModale(nuovo ? "Nuovo obiettivo" : "Obiettivo",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      const dati = {
        titolo: titolo.value.trim(), categoria_id: categoria.value, scadenza: scadenza.value || null,
        descrizione: descrizione.value.trim(), passi: passi.filter((p) => p.testo.trim()),
      };
      if (nuovo) stato.obiettiviLungo.push({ id: nuovoId("ol"), fatto: false, ...dati });
      else Object.assign(o, dati);
      chiudiModale();
      aggiorna();
    } },
      titolo,
      h("div", { class: "due-campi" }, campo("Categoria", categoria), campo("Entro il (facoltativo)", scadenza)),
      descrizione,
      h("div", { class: "editor-sezione" },
        h("div", { class: "editor-titolo" }, h("strong", {}, "Passi"), h("small", { class: "testo-leggero" }, "spezzalo in piccoli traguardi")),
        listaPassi,
        nuovoPasso),
      h("div", { class: "azioni-modale" },
        !nuovo && h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
          if (!confirm(`Eliminare l'obiettivo «${o.titolo}»?`)) return;
          stato.obiettiviLungo = stato.obiettiviLungo.filter((x) => x.id !== o.id);
          chiudiModale();
          aggiorna();
        } }, icona("cestino", 16), "Elimina"),
        h("button", { class: "bottone-accento", type: "submit" }, "Salva"))));
  document.querySelector(".modale-box").classList.add("larga");
}

// ---------- Finestra: creare o modificare una categoria ----------
function apriCategoria(c) {
  const nuova = !c;
  const nome = h("input", { type: "text", value: c ? c.nome : "", placeholder: "es. Sport, Lingue, Lavoro…", required: true, maxlength: 40 });
  let colore = c ? c.colore : COLORI_CATEGORIA[stato.categorieObiettivi.length % COLORI_CATEGORIA.length];
  const pallini = COLORI_CATEGORIA.map((hex) => h("button", {
    class: `pallino-colore${hex === colore ? " scelto" : ""}`, type: "button", style: `background:${hex}`, "aria-label": `Colore ${hex}`,
    onclick: (ev) => { colore = hex; pallini.forEach((p) => p.classList.remove("scelto")); ev.currentTarget.classList.add("scelto"); },
  }));

  apriModale(nuova ? "Nuova categoria" : "Modifica categoria",
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      if (nuova) stato.categorieObiettivi.push({ id: nuovoId("co"), nome: nome.value.trim(), colore });
      else Object.assign(c, { nome: nome.value.trim(), colore });
      chiudiModale();
      aggiorna();
    } },
      campo("Nome", nome),
      h("div", { class: "scelta-colore" }, h("span", { class: "testo-leggero piccolo" }, "Colore"), pallini),
      h("div", { class: "azioni-modale" },
        !nuova && h("button", { class: "bottone-secondario pericolo", type: "button", onclick: () => {
          const quanti = stato.obiettiviLungo.filter((o) => o.categoria_id === c.id).length;
          if (!confirm(quanti ? `Eliminare «${c.nome}» e i suoi ${quanti} obiettivi?` : `Eliminare «${c.nome}»?`)) return;
          stato.categorieObiettivi = stato.categorieObiettivi.filter((x) => x.id !== c.id);
          stato.obiettiviLungo = stato.obiettiviLungo.filter((o) => o.categoria_id !== c.id);
          chiudiModale();
          aggiorna();
        } }, icona("cestino", 16), "Elimina"),
        h("button", { class: "bottone-accento", type: "submit" }, "Salva"))));
}
