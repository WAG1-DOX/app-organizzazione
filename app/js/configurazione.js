// ===== configurazione.js: la configurazione guidata =====
//
// Compare da sola la prima volta che entri (stato.configurazione.completata = false)
// e si può rifare quando vuoi dal menu ("Configurazione guidata").
// Passo dopo passo scegli da cosa partire: per ogni sezione ci sono dei suggerimenti
// (suggerimenti.js) da toccare per sceglierli, e puoi aggiungere i tuoi.
// Niente viene salvato finché non arrivi alla fine (o premi "Finisco dopo").
// Tutto si può cambiare anche dopo, dalle singole sezioni.

const NOMI_CATEGORIE_MICRO = { routine: "Routine", integratori: "Integratori", pasti: "Pasti", riposo: "Riposo", movimento: "Movimento" };
const TIPI_EXTRA = { allenamento: "Allenamento", produttivita: "Produttività", altro: "Altro" };
const COLORI_CONFIG = ["#d1fe17", "#7dd3c0", "#c3a6ff", "#f4a261", "#8ab4f8", "#f28b82", "#fdd663", "#81c995"];

// Elenco "scelto": parte da quello che hai già (se rifai la configurazione) oppure da niente
function elencoScelto(attuali) {
  return new Map(attuali.map((x) => [x.id, structuredClone(x)]));
}

function apriConfigurazione() {
  if (document.getElementById("configura")) return;
  const giaFatta = !!(stato.configurazione && stato.configurazione.completata);

  // ---------- Bozza: quello che scegli (diventa vero solo alla fine) ----------
  const bozza = {
    nome: utenteAttuale.nome || "",
    sveglia: stato.sonno.sveglia, dormire: stato.sonno.dormire,
    materie: elencoScelto(stato.materie),
    quotidiane: elencoScelto(stato.quotidiane),
    micro: elencoScelto(stato.microModelli),
    extra: elencoScelto(stato.modelliExtra),
    senzaBudget: giaFatta && !(stato.budget.mensile > 0),
    categorieObiettivi: elencoScelto(stato.categorieObiettivi),
  };
  let editorSoldi = null;

  // ---------- Pezzi comuni ----------
  // Una "pastiglia" da toccare per scegliere / togliere un suggerimento
  const pastiglia = (mappa, oggetto, testo, dettaglio, dopo) => {
    const b = h("button", { type: "button", class: `scelta${mappa.has(oggetto.id) ? " scelta-attiva" : ""}`, "aria-pressed": String(mappa.has(oggetto.id)) },
      h("span", { class: "scelta-segno" }, icona("check", 12)),
      h("span", { class: "scelta-testo" }, h("strong", {}, testo), dettaglio && h("small", {}, dettaglio)));
    b.addEventListener("click", () => {
      if (mappa.has(oggetto.id)) mappa.delete(oggetto.id);
      else mappa.set(oggetto.id, structuredClone(oggetto));
      b.classList.toggle("scelta-attiva", mappa.has(oggetto.id));
      b.setAttribute("aria-pressed", String(mappa.has(oggetto.id)));
      if (dopo) dopo();
    });
    return b;
  };

  // Suggerimenti + le cose tue (aggiunte a mano o già salvate) in un'unica griglia
  const griglia = (mappa, suggerimenti, testo, dettaglio) => {
    const tutti = [...suggerimenti];
    for (const x of mappa.values()) if (!tutti.some((s) => s.id === x.id)) tutti.push(x);
    return h("div", { class: "scelte" }, tutti.map((o) => pastiglia(mappa, o, testo(o), dettaglio && dettaglio(o))));
  };

  // Modulo "aggiungi il tuo": campi + bottone; crea(valori) restituisce l'oggetto nuovo
  const aggiungiTuo = (mappa, campi, crea) => {
    const form = h("form", { class: "configura-aggiungi", onsubmit: (ev) => {
      ev.preventDefault();
      const o = crea();
      if (!o) return;
      mappa.set(o.id, o);
      mostraPasso(); // ridisegna il passo con la pastiglia nuova (già scelta)
    } }, ...campi, h("button", { class: "bottone-secondario", type: "submit" }, icona("piu", 14), "Aggiungi"));
    return form;
  };

  // ---------- I passi ----------
  const passi = [
    {
      titolo: giaFatta ? "Rifacciamo la configurazione" : "Benvenuto in XECUTE",
      testo: giaFatta
        ? "Ritrovi già scelto quello che hai. Cambia quello che vuoi: niente si salva finché non arrivi alla fine."
        : "Configuriamo l'app insieme: ci vogliono 2 minuti. Ti propongo delle idee, tu tocchi quelle che ti servono. Tutto si può cambiare anche dopo.",
      corpo: () => {
        const nome = h("input", { type: "text", value: bozza.nome, maxlength: 40, placeholder: "Il tuo nome", oninput: (ev) => { bozza.nome = ev.target.value; } });
        return h("div", { class: "modulo" }, campo("Come ti chiami?", nome));
      },
    },
    {
      titolo: "Sonno",
      testo: "A che ora ti svegli e vai a dormire di solito? Serve alla Giornata, alla Settimana e ai conti del tempo libero. Per i giorni diversi lo cambi dopo nella Settimana.",
      corpo: () => h("div", { class: "due-campi" },
        campo("Sveglia", h("input", { type: "time", value: bozza.sveglia, required: true, oninput: (ev) => { bozza.sveglia = ev.target.value || bozza.sveglia; } })),
        campo("A letto", h("input", { type: "time", value: bozza.dormire, required: true, oninput: (ev) => { bozza.dormire = ev.target.value || bozza.dormire; } }))),
    },
    {
      titolo: "Scuola",
      testo: "Che materie hai? Le lezioni vere arrivano dal calendario di H-Farm su Google: lo colleghi dopo, dal bottone Google nella sezione Calendario.",
      corpo: () => {
        const nome = h("input", { type: "text", placeholder: "Altra materia, es. Business Law", maxlength: 60, required: true });
        return h("div", { class: "colonna" },
          griglia(bozza.materie, SUGGERIMENTI.materie, (m) => m.nome),
          aggiungiTuo(bozza.materie, [nome], () => ({
            id: nuovoId("mat"), nome: nome.value.trim(), prof: "", aula: "",
            colore: COLORI_CONFIG[bozza.materie.size % COLORI_CONFIG.length],
          })));
      },
    },
    {
      titolo: "Le cose di ogni giorno",
      testo: "Quali attività fai tutti i giorni? Sono quelle che il Monitor routine controlla: se ne fai almeno il 75%, il quadratino del giorno diventa giallo.",
      corpo: () => {
        const nome = h("input", { type: "text", placeholder: "es. Meditazione", maxlength: 40, required: true });
        const minuti = h("input", { type: "number", min: 1, max: 300, value: 10, required: true, "aria-label": "Minuti" });
        const volte = h("input", { type: "number", min: 1, max: 10, value: 1, required: true, "aria-label": "Volte al giorno" });
        return h("div", { class: "colonna" },
          griglia(bozza.quotidiane, SUGGERIMENTI.quotidiane, (q) => q.nome, (q) => `${durata(q.minuti)}${q.volte_al_giorno > 1 ? ` × ${q.volte_al_giorno} al giorno` : ""}`),
          aggiungiTuo(bozza.quotidiane, [campo("Attività", nome), campo("Minuti", minuti), campo("Volte al giorno", volte)], () => ({
            id: nuovoId("q"), nome: nome.value.trim(), minuti: Number(minuti.value), volte_al_giorno: Number(volte.value), icona: "stella",
          })));
      },
    },
    {
      titolo: "La tua giornata tipo",
      testo: "Questi sono i mattoncini che trascini nella sezione Giornata per organizzarla minuto per minuto (integratori, pasti, pause…). Scegli quelli che usi.",
      corpo: () => {
        const nome = h("input", { type: "text", placeholder: "es. Proteine in polvere", maxlength: 40, required: true });
        const minuti = h("input", { type: "number", min: 1, max: 300, value: 5, required: true, "aria-label": "Minuti" });
        const categoria = h("select", {}, Object.entries(NOMI_CATEGORIE_MICRO).map(([v, n]) => h("option", { value: v }, n)));
        const gruppi = Object.entries(NOMI_CATEGORIE_MICRO).map(([cat, nomeCat]) => {
          const sugg = SUGGERIMENTI.micro.filter((m) => m.categoria === cat);
          const tuoi = [...bozza.micro.values()].filter((m) => m.categoria === cat && !sugg.some((s) => s.id === m.id));
          if (!sugg.length && !tuoi.length) return null;
          return h("div", { class: "configura-gruppo" }, h("small", { class: "etichetta-luce" }, nomeCat),
            h("div", { class: "scelte" }, [...sugg, ...tuoi].map((m) => pastiglia(bozza.micro, m, m.nome, durata(m.minuti)))));
        });
        return h("div", { class: "colonna" }, gruppi,
          aggiungiTuo(bozza.micro, [campo("Cosa", nome), campo("Minuti", minuti), campo("Tipo", categoria)], () => ({
            id: nuovoId("mm"), nome: nome.value.trim(), minuti: Number(minuti.value), categoria: categoria.value, note: "",
          })));
      },
    },
    {
      titolo: "Allenamenti e attività extra",
      testo: "Cose che non fai tutti i giorni ma che metti spesso in calendario. Poi le aggiungi con il + in un attimo, con la durata già giusta.",
      corpo: () => {
        const nome = h("input", { type: "text", placeholder: "es. Padel", maxlength: 40, required: true });
        const minuti = h("input", { type: "number", min: 5, max: 600, value: 60, required: true, "aria-label": "Minuti" });
        const tipo = h("select", {}, Object.entries(TIPI_EXTRA).map(([v, n]) => h("option", { value: v }, n)));
        return h("div", { class: "colonna" },
          griglia(bozza.extra, SUGGERIMENTI.extra, (x) => x.nome, (x) => `${durata(x.minuti)} · ${TIPI_EXTRA[x.tipo] || x.tipo}`),
          aggiungiTuo(bozza.extra, [campo("Attività", nome), campo("Minuti", minuti), campo("Tipo", tipo)], () => ({
            id: nuovoId("x"), nome: nome.value.trim(), minuti: Number(minuti.value), tipo: tipo.value,
          })));
      },
    },
    {
      titolo: "Soldi",
      testo: "Quanto vuoi spendere al mese? Dai un tetto a ogni categoria (0 = nessun limite). Il Monitor routine controlla anche che tu non sfori il budget di ogni giorno.",
      corpo: () => {
        const partenza = Object.keys(stato.budget.categorie).length
          ? stato.budget.categorie
          : Object.fromEntries(SUGGERIMENTI.categorieSpesa.map((c) => [c.nome, c.budget]));
        if (!editorSoldi) editorSoldi = editorBudget(partenza);
        const zona = h("div", { class: bozza.senzaBudget ? "spento" : "" }, editorSoldi.elemento);
        const senza = h("label", { class: "spunta-riga" },
          h("input", { type: "checkbox", checked: bozza.senzaBudget, onchange: (ev) => { bozza.senzaBudget = ev.target.checked; zona.className = bozza.senzaBudget ? "spento" : ""; } }),
          h("span", {}, "Per ora non voglio un budget"));
        return h("div", { class: "colonna" }, senza, zona);
      },
    },
    {
      titolo: "Obiettivi a lungo termine",
      testo: "In quali parti della tua vita vuoi darti degli obiettivi? Ognuna diventa un riquadro nella sezione Obiettivi, dove poi scrivi gli obiettivi veri.",
      corpo: () => {
        const nome = h("input", { type: "text", placeholder: "es. Viaggi", maxlength: 30, required: true });
        return h("div", { class: "colonna" },
          griglia(bozza.categorieObiettivi, SUGGERIMENTI.categorieObiettivi, (c) => c.nome),
          aggiungiTuo(bozza.categorieObiettivi, [nome], () => ({
            id: nuovoId("co"), nome: nome.value.trim(), colore: COLORI_CONFIG[bozza.categorieObiettivi.size % COLORI_CONFIG.length],
          })));
      },
    },
    {
      titolo: "Tutto pronto",
      testo: "Ecco cosa hai scelto. Premi «Inizia» per salvarlo. Puoi rifare questa configurazione quando vuoi dal menu.",
      corpo: () => {
        const conta = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;
        const budget = editorSoldi ? editorSoldi.leggi() : stato.budget;
        return h("div", { class: "colonna" },
          h("ul", { class: "configura-riepilogo" },
            h("li", {}, icona("luna", 16), `Sveglia ${bozza.sveglia} · a letto ${bozza.dormire}`),
            h("li", {}, icona("scuola", 16), conta(bozza.materie.size, "materia", "materie")),
            h("li", {}, icona("sole", 16), conta(bozza.quotidiane.size, "attività di ogni giorno", "attività di ogni giorno")),
            h("li", {}, icona("orologio", 16), conta(bozza.micro.size, "mattoncino per la Giornata", "mattoncini per la Giornata")),
            h("li", {}, icona("stella", 16), conta(bozza.extra.size, "attività extra", "attività extra")),
            h("li", {}, icona("portafoglio", 16), bozza.senzaBudget || !budget.mensile ? "Nessun budget" : `Budget: ${euro(budget.mensile)} al mese`),
            h("li", {}, icona("bandiera", 16), conta(bozza.categorieObiettivi.size, "area di obiettivi", "aree di obiettivi"))),
          h("div", { class: "card-luce piccola configura-dopo" },
            h("small", { class: "etichetta-luce" }, "Dopo, per avere tutto"),
            h("ol", { class: "passi" },
              h("li", {}, "Calendario → bottone Google: collega il tuo Google Calendar (anche H-Farm e Canvas)."),
              h("li", {}, "Su Google Calendar crea un calendario chiamato «Promemoria»: i promemoria arrivano anche sul telefono."),
              h("li", {}, "Giornata: trascina i mattoncini e salva la tua routine base."))));
      },
    },
  ];

  // ---------- Finestra ----------
  let passo = 0;
  const barra = h("span", { class: "configura-barra-piena" });
  const contatore = h("small", { class: "configura-contatore" });
  const titolo = h("h2", {});
  const testo = h("p", { class: "testo-leggero" });
  const corpo = h("div", { class: "configura-corpo" });
  const indietro = h("button", { class: "bottone-secondario", type: "button", onclick: () => { if (passo > 0) { passo--; mostraPasso(); } } }, "Indietro");
  const avanti = h("button", { class: "bottone-accento", type: "button", onclick: () => {
    if (passo < passi.length - 1) { passo++; mostraPasso(); } else finisci();
  } });
  const dopo = h("button", { class: "link-sottile", type: "button", onclick: () => {
    if (confirm("Salvo quello che hai scelto finora e chiudo? La configurazione la ritrovi nel menu.")) finisci();
  } }, "Finisco dopo");

  function mostraPasso() {
    const p = passi[passo];
    barra.style.width = `${((passo + 1) / passi.length) * 100}%`;
    contatore.textContent = `Passo ${passo + 1} di ${passi.length}`;
    titolo.textContent = p.titolo;
    testo.textContent = p.testo;
    corpo.replaceChildren(p.corpo());
    indietro.style.visibility = passo === 0 ? "hidden" : "";
    avanti.textContent = passo === passi.length - 1 ? "Inizia" : passo === 0 ? "Cominciamo" : "Avanti";
    dopo.style.display = passo === passi.length - 1 ? "none" : "";
    schermata.querySelector(".configura-box").scrollTop = 0;
  }

  // ---------- Alla fine: la bozza diventa vera ----------
  async function finisci() {
    stato.sonno.sveglia = bozza.sveglia;
    stato.sonno.dormire = bozza.dormire;
    stato.materie = [...bozza.materie.values()];
    stato.quotidiane = [...bozza.quotidiane.values()];
    stato.modelliExtra = [...bozza.extra.values()];
    // i mattoncini collegati a un'attività quotidiana che non hai scelto restano, ma senza collegamento
    const idQuotidiane = new Set(stato.quotidiane.map((q) => q.id));
    stato.microModelli = [...bozza.micro.values()].map((m) => {
      if (m.quotidiana_id && !idQuotidiane.has(m.quotidiana_id)) { const { quotidiana_id, ...resto } = m; return resto; }
      return m;
    });
    const idMicro = new Set(stato.microModelli.map((m) => m.id));
    stato.routineBase = stato.routineBase.filter((r) => idMicro.has(r.modello_id));
    // le aree di obiettivi che contengono già degli obiettivi non si perdono
    const categorie = [...bozza.categorieObiettivi.values()];
    for (const c of stato.categorieObiettivi) {
      if (!bozza.categorieObiettivi.has(c.id) && stato.obiettiviLungo.some((o) => o.categoria_id === c.id)) categorie.push(c);
    }
    stato.categorieObiettivi = categorie;
    if (bozza.senzaBudget) stato.budget = { mensile: 0, categorie: {} };
    else if (editorSoldi) stato.budget = editorSoldi.leggi();
    stato.configurazione = { ...(stato.configurazione || {}), completata: true, dal: (stato.configurazione && stato.configurazione.dal) || oggiChiave() };

    // il nome va anche nel profilo del database (lo vedono gli amici nella chat)
    const nome = bozza.nome.trim();
    if (nome && nome !== utenteAttuale.nome) {
      utenteAttuale.nome = nome;
      if (typeof aggiornaProfiloInAlto === "function") aggiornaProfiloInAlto();
      if (typeof sb !== "undefined" && sb && utenteAttuale.id) {
        sb.from("profili").update({ nome }).eq("id", utenteAttuale.id).then(({ error }) => { if (error) console.warn("Nome non salvato:", error.message); });
      }
    }

    schermata.remove();
    document.body.classList.remove("in-configurazione");
    location.hash = "home";
    aggiorna();
  }

  const schermata = h("div", { class: "configura", id: "configura", role: "dialog", "aria-modal": "true", "aria-label": "Configurazione guidata" },
    h("div", { class: "configura-box" },
      h("div", { class: "configura-testa" },
        h("img", { class: "configura-logo", src: "img/logo.svg", alt: "" }),
        contatore,
        giaFatta && h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Chiudi senza salvare", title: "Chiudi senza salvare",
          onclick: () => { schermata.remove(); document.body.classList.remove("in-configurazione"); } }, icona("x", 16))),
      h("div", { class: "configura-barra" }, barra),
      titolo, testo, corpo,
      h("div", { class: "configura-piede" }, indietro, h("span", { class: "spazio" }), dopo, avanti)));

  document.body.append(schermata);
  document.body.classList.add("in-configurazione");
  mostraPasso();
}

// Va mostrata? (la prima volta, dopo il login)
function serveConfigurazione() {
  return !(stato.configurazione && stato.configurazione.completata);
}
