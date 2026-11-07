// ===== Check-up mail: solo quelle che contano, senza AI e senza spendere =====
// Il "cervello" (leggere Gmail, smistare, scadenze, newsletter, ricevute) è in js/gmail.js.
// Qui c'è solo quello che si vede.

const quando = (ms) => {
  const d = new Date(ms);
  if (chiaveGiorno(d) === oggiChiave()) return oraDi(d);
  if (chiaveGiorno(d) === chiaveGiorno(aggiungiGiorni(new Date(), -1))) return "ieri";
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};
const giornoScadenza = (s) => {
  const oggi = oggiChiave(), domani = chiaveGiorno(aggiungiGiorni(new Date(), 1));
  const g = s.data === oggi ? "Oggi" : s.data === domani ? "Domani" : maiuscola(dataBreve(daChiave(s.data)));
  return s.ora ? `${g} · ${s.ora}` : g;
};
const giorniA = (k) => Math.round((daChiave(k) - daChiave(oggiChiave())) / 864e5);

Viste.mail = function (box) {
  if (!Posta.mail.length) caricaPosta();
  aggiornaPosta();   // da sola non fa niente se ha controllato da poco

  if (!Posta.mail.length && Posta.stato !== "pronto") return box.append(schermataCollegamento());

  // se arrivano mail da più account (es. quella della scuola inoltrata), filtro in alto
  const conti = contiPosta();
  if (Posta.conto !== "tutti" && !conti.has(Posta.conto)) Posta.conto = "tutti";
  const sceltaConto = conti.size > 1 && h("div", { class: "segmenti conti-mail" },
    [["tutti", "Tutte", Posta.mail.length], ...[...conti.entries()].sort((a, b) => (a[0] === "personale" ? -1 : b[0] === "personale" ? 1 : a[0].localeCompare(b[0])))
      .map(([k, n]) => [k, k === "personale" ? "Personale" : k, n])].map(([k, nome, n]) =>
      h("button", { type: "button", class: Posta.conto === k ? "attivo" : "", onclick: () => { Posta.conto = k; ridisegnaFermo(); } },
        nome, h("small", {}, ` ${n}`))));

  const g = gruppiPosta();
  const scadenze = scadenzeDaDecidere();
  const ricevute = ricevuteTrovate();

  // ---------- Barra in alto: i numeri ----------
  const numero = (chiave, titolo, valore, sotto) => h("button", {
    type: "button", class: `tessera-mail${Posta.filtro === chiave ? " attiva" : ""}${chiave === "importanti" && valore ? " calda" : ""}`,
    onclick: () => { Posta.filtro = chiave; ridisegnaFermo(); },
  }, h("strong", {}, String(valore)), h("span", {}, titolo), h("small", {}, sotto));

  const nonLetteImp = g.importanti.filter((m) => m.etichette.includes("UNREAD")).length;
  const numeri = h("div", { class: "numeri-mail" },
    numero("importanti", "Importanti", g.importanti.length, nonLetteImp ? `${nonLetteImp} da leggere` : "tutte lette"),
    numero("leggere", "Da leggere", g.leggere.length, "non lette, meno urgenti"),
    numero("rumore", "Rumore", g.rumore.length, "promozioni, social, newsletter"),
    numero("scadenze", "Scadenze", scadenze.length, scadenze.length ? `la prima: ${giornoScadenza(scadenze[0].s).toLowerCase()}` : "nessuna da segnare"));

  // ---------- Elenco ----------
  const elenco = pannelloElenco(g, scadenze);

  // ---------- Colonna destra ----------
  const colonna = h("div", { class: "colonna" },
    pannelloStato(),
    Posta.filtro !== "scadenze" && pannelloScadenze(scadenze.slice(0, 4), scadenze.length),
    pannelloNewsletter(),
    pannelloRicevute(ricevute),
    pannelloRegole());

  box.append(...[
    Posta.annulla && h("div", { class: "barra-annulla" },
      h("span", {}, Posta.annulla.testo),
      h("button", { type: "button", class: "bottone-secondario", onclick: () => azionePosta(annullaArchiviazione) }, "Annulla")),
    sceltaConto,
    numeri,
    h("div", { class: "griglia-due larga-sinistra" }, elenco, colonna)].filter(Boolean));
};

// ---------- Riepilogo in Home ----------
function cartaMailHome() {
  if (!Posta.mail.length) return null;
  const g = gruppiPosta(true);
  const scadenze = scadenzeDaDecidere(true);
  const prime = g.importanti.filter((m) => m.etichette.includes("UNREAD")).slice(0, 3);
  return pannello("card-mail-home", "Mail", h("a", { class: "pill", href: "#mail" }, "Apri"),
    h("p", { class: "riassunto-mail" },
      h("b", {}, String(g.importanti.length)), ` importanti · `,
      h("b", {}, String(scadenze.length)), ` scadenz${scadenze.length === 1 ? "a" : "e"} · `,
      h("b", {}, String(g.rumore.length)), " nel rumore"),
    scadenze[0] && h("a", { class: "riga-home-mail scadenza", href: "#mail" },
      icona("orologio", 14), h("span", {}, `${scadenze[0].s.tipo} ${giornoScadenza(scadenze[0].s).toLowerCase()}: ${scadenze[0].m.oggetto}`)),
    prime.map((m) => h("a", { class: "riga-home-mail", href: "#mail" },
      h("strong", {}, m.da), h("span", {}, m.oggetto))));
}

// ---------- Non ancora collegato ----------
function schermataCollegamento() {
  const s = Posta.stato;
  const carica = s === "carico";
  const testo = {
    "api-spenta": "Il permesso c'è, ma nel progetto Google «x-ecute» le API di Gmail non sono ancora attive. Lo deve fare Edoardo (Google Cloud → API e servizi → Libreria → Gmail API → Abilita). Poi premi «Riprova».",
    "manca-permesso": Posta.errore || "Google è collegato solo per il calendario. Premi il bottone e, nella finestra di Google, spunta anche il permesso per Gmail.",
    errore: Posta.errore || "Qualcosa non ha funzionato.",
    spento: "Serve prima il collegamento a Google (quello del calendario).",
  }[s] || "Collega Gmail una volta sola: da lì l'app controlla le mail da sola.";
  return h("div", { class: "griglia-due larga-sinistra" },
    pannello("card-luce", null, null,
      h("small", { class: "etichetta-luce" }, "Check-up mail"),
      h("p", { class: "luce-titolo" }, carica ? "Leggo le tue mail…" : "Le mail che contano, e basta"),
      h("p", { class: "testo-leggero" }, carica ? "La prima volta ci mette 10-20 secondi: guardo le ultime 3 settimane e a chi scrivi di solito." : testo),
      !carica && h("div", { class: "azioni-modale sinistra" },
        s === "api-spenta"
          ? h("button", { class: "bottone-accento", type: "button", onclick: () => aggiornaPosta(true) }, icona("sync", 16), "Riprova")
          : h("button", { class: "bottone-accento", type: "button", onclick: collegaGmail }, icona("google", 16), "Collega Gmail"))),
    pannello("", "Cosa fa", null,
      h("ul", { class: "elenco-spiegato" },
        h("li", {}, h("strong", {}, "Smista "), "la posta in Importanti, Da leggere e Rumore, e ti dice perché."),
        h("li", {}, h("strong", {}, "Trova le scadenze "), "nel testo (\"entro il 15/11 alle 23:59\") e le trasforma in promemoria con un tocco."),
        h("li", {}, h("strong", {}, "Pulisce le newsletter: "), "chi ti scrive di più, quante ne apri, disiscriviti o silenzia."),
        h("li", {}, h("strong", {}, "Collega le ricevute "), "ai movimenti della banca (es. «AMZN 23,99» → il tuo ordine)."),
        h("li", {}, h("strong", {}, "Gratis e privato: "), "niente AI, le mail restano nel tuo browser. Può leggere e archiviare, non cancellare né mandare mail."))));
}

// ---------- Elenco delle mail ----------
function pannelloElenco(g, scadenze) {
  const f = Posta.filtro;
  if (f === "scadenze") return pannelloScadenze(scadenze, scadenze.length, true);

  const titoli = { importanti: "Importanti", leggere: "Da leggere", rumore: "Rumore" };
  const cerca = h("input", { type: "search", placeholder: "Cerca mittente o oggetto", value: Posta.cerca, autocomplete: "off",
    oninput: (ev) => { Posta.cerca = ev.target.value; disegnaRighe(); } });
  const lista = h("ul", { class: "lista-mail" });
  const disegnaRighe = () => {
    const q = minuscolo(Posta.cerca.trim());
    const mostra = g[f].filter((m) => !q || minuscolo(`${m.da} ${m.email} ${m.oggetto} ${m.anteprima}`).includes(q));
    lista.replaceChildren(...(mostra.length ? mostra.map(rigaMail) : [h("li", { class: "vuoto" },
      q ? "Nessuna mail trovata" : f === "importanti" ? "Niente di importante adesso. 🎉" : f === "leggere" ? "Hai letto tutto. 🎉" : "Il rumore è a zero. 🎉")]));
  };
  disegnaRighe();

  const azioni = h("div", { class: "gruppo-pill" },
    f === "rumore" && g.rumore.length > 0 && h("button", { class: "pill attiva", type: "button", onclick: () => {
      if (!confirm(`Archiviare ${g.rumore.length} mail di rumore (e segnarle come lette)? Restano in Gmail in «Tutti i messaggi», e puoi annullare subito.`)) return;
      azionePosta(() => archivia(g.rumore.map((m) => m.id), { segnaLette: true, testo: `${g.rumore.length} mail di rumore archiviate` }));
    } }, icona("check", 14), `Pulisci tutto (${g.rumore.length})`),
    f === "leggere" && g.leggere.length > 0 && h("button", { class: "pill", type: "button", onclick: () =>
      azionePosta(async () => { await cambiaEtichette(g.leggere.map((m) => m.id), { togli: ["UNREAD"] }); await aggiornaPosta(true); }) }, "Segna tutte lette"),
    h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Aggiorna", title: "Aggiorna",
      onclick: () => azionePosta(() => aggiornaPosta(true)) }, icona("sync", 14)));

  return pannello("", titoli[f], azioni,
    h("div", { class: "filtri-mail" }, cerca),
    lista,
    h("p", { class: "testo-leggero piccolo" }, `Posta in arrivo degli ultimi ${GIORNI_INBOX} giorni · aggiornata ${Posta.ultimo ? quandoFa(new Date(Posta.ultimo).toISOString()) : "mai"}${Posta.inCorso ? " · aggiorno…" : ""}`));
}

function rigaMail(m) {
  const s = smista(m);
  const nonLetta = m.etichette.includes("UNREAD");
  const scad = scadenzeDi(m).filter((x) => x.data >= oggiChiave())[0];
  const mostraMotivi = s.motivi.filter((x) => x.tono === "forte" || (s.gruppo !== "importanti" && x.tono !== "neutro")).slice(0, 2);
  const iniziale = (m.da || m.email || "?").replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase() || "?";
  return h("li", { class: `riga-mail${nonLetta ? " non-letta" : ""}${s.gruppo === "importanti" ? " importante" : ""}` },
    h("span", { class: "avatar piccolo" }, iniziale),
    h("button", { type: "button", class: "riga-testo riga-cliccabile", onclick: () => apriMail(m) },
      h("span", { class: "mail-testa" },
        h("strong", {}, m.da || m.email),
        h("span", { class: "mail-testa-destra" },
          Posta.conto === "tutti" && m.conto && m.conto !== "personale" && h("span", { class: "pill piccola conto-pill" }, m.conto),
          h("small", { class: "testo-leggero" }, quando(m.data)))),
      h("span", { class: "mail-oggetto" }, m.oggetto),
      h("small", { class: "mail-anteprima" }, m.anteprima),
      (mostraMotivi.length > 0 || !!scad) && h("span", { class: "gruppo-pill" },
        scad && h("span", { class: "pill piccola urgente" }, icona("orologio", 11), `${scad.tipo} · ${giornoScadenza(scad).toLowerCase()}`),
        mostraMotivi.filter((x) => !/^Scadenza/.test(x.t)).map((x) => h("span", { class: `pill piccola motivo-${x.tono}` }, x.t)))),
    h("div", { class: "mail-azioni" },
      h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Archivia", title: "Archivia",
        onclick: () => azionePosta(() => archivia([m.id])) }, icona("archivio", 15)),
      h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Fallo dopo", title: "Fallo dopo (promemoria + archivia)",
        onclick: () => apriRimanda(m) }, icona("orologio", 15))));
}

// ---------- Dettaglio di una mail ----------
function apriMail(m) {
  const s = smista(m);
  const scad = scadenzeDi(m).filter((x) => x.data >= oggiChiave());
  const ric = Posta.analisi[m.id] && Posta.analisi[m.id].ricevuta;
  const nonLetta = m.etichette.includes("UNREAD");
  const etichettaGruppo = { importanti: "Importante", leggere: "Da leggere", rumore: "Rumore" }[s.gruppo];
  const azioneRegola = (chiave, testo) => h("button", { class: "bottone-secondario", type: "button", onclick: () => {
    aggiungiRegola(chiave, m.email);
    chiudiModale();
    if (chiave === "silenziati") azionePosta(() => archiviaMittente({ email: m.email, nome: m.da }));
    else ridisegnaFermo();
  } }, testo);

  apriModale(m.oggetto,
    m.conto && m.conto !== "personale" && h("p", { class: "testo-leggero" }, `Arrivata su ${m.contoEmail || m.conto} (inoltrata)`),
    h("p", { class: "testo-leggero" }, `${m.da} · ${m.email} · ${new Date(m.data).toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`),
    h("p", { class: "mail-anteprima-grande" }, m.anteprima || "(nessuna anteprima)"),
    h("div", { class: "perche-mail" },
      h("strong", {}, `${etichettaGruppo} — perché:`),
      h("div", { class: "gruppo-pill" }, s.motivi.length ? s.motivi.map((x) => h("span", { class: `pill piccola motivo-${x.tono}` }, x.t)) : h("span", { class: "testo-leggero" }, "nessun segnale particolare"))),
    scad.length > 0 && h("div", { class: "scadenze-mail" }, scad.map((x) => rigaScadenza({ m, s: x, k: chiaveScadenza(m, x) }, true))),
    ric && h("p", { class: "testo-leggero" }, icona("scontrino", 13), ` Ricevuta da ${euro(ric.importo)}${stato.movimenti.some((x) => x.ricevuta && x.ricevuta.id === m.id) ? " · collegata al movimento della banca" : ""}`),
    h("div", { class: "azioni-modale sinistra a-capo" },
      h("a", { class: "bottone-accento", href: linkGmail(m.thread), target: "_blank", rel: "noopener" }, icona("mail", 15), "Apri in Gmail"),
      h("button", { class: "bottone-secondario", type: "button", onclick: () => { chiudiModale(); azionePosta(() => archivia([m.id])); } }, icona("archivio", 15), "Archivia"),
      h("button", { class: "bottone-secondario", type: "button", onclick: () => { chiudiModale(); azionePosta(() => segnaLetta(m, nonLetta)); } }, nonLetta ? "Segna letta" : "Segna da leggere"),
      h("button", { class: "bottone-secondario", type: "button", onclick: () => apriRimanda(m) }, icona("orologio", 15), "Fallo dopo")),
    h("div", { class: "insegna-mail" },
      h("small", { class: "testo-leggero" }, `Insegna all'app (vale per tutte le mail di ${m.email}):`),
      h("div", { class: "azioni-modale sinistra a-capo" },
        s.gruppo !== "importanti" && azioneRegola("mittenti", "★ Sempre importante"),
        s.gruppo === "importanti" && azioneRegola("mai", "Non è importante"),
        azioneRegola("silenziati", "Silenzia (archivia sempre)"))));
}

// "Fallo dopo": promemoria + archivia (la mail sparisce finché non è il momento)
function apriRimanda(m) {
  const adesso = new Date();
  const opzioni = [
    adesso.getHours() < 17 && { n: "Stasera", d: adesso, ora: "18:00" },
    { n: "Domani mattina", d: aggiungiGiorni(adesso, 1), ora: "09:00" },
    { n: "Sabato", d: aggiungiGiorni(adesso, ((6 - adesso.getDay() + 7) % 7) || 7), ora: "10:00" },
    { n: "Lunedì", d: aggiungiGiorni(adesso, ((1 - adesso.getDay() + 7) % 7) || 7), ora: "09:00" },
  ].filter(Boolean);
  const testo = h("input", { type: "text", maxlength: 100, value: `Rispondere a ${m.da}: ${m.oggetto.replace(/^((re|fwd?|i)\s*:\s*)+/i, "")}`.slice(0, 100) });
  const data = h("input", { type: "date", value: chiaveGiorno(aggiungiGiorni(adesso, 1)) });
  const ora = h("input", { type: "time", value: "09:00" });
  const fai = (giorno, orario) => {
    const p = { id: nuovoId("p"), testo: testo.value.trim() || m.oggetto, scadenza: giorno, ora: orario, fatto: false, da_inviare: true, da_mail: m.id };
    stato.promemoria.push(p);
    chiudiModale();
    aggiorna();
    if (typeof inviaPromemoriaAGoogle === "function") inviaPromemoriaAGoogle(p);
    azionePosta(() => archivia([m.id], { testo: `Archiviata · promemoria ${giornoScadenza({ data: giorno, ora: orario }).toLowerCase()}` }));
  };
  apriModale("Fallo dopo",
    h("p", { class: "testo-leggero" }, "Crea un promemoria (arriva anche sul telefono) e toglie la mail dalla posta in arrivo."),
    campo("Promemoria", testo),
    h("div", { class: "gruppo-pill rimanda" }, opzioni.map((o) =>
      h("button", { class: "pill", type: "button", onclick: () => fai(chiaveGiorno(o.d), o.ora) }, `${o.n} · ${o.ora}`))),
    h("div", { class: "modulo-riga" }, campo("Giorno", data), campo("Ora", ora),
      h("button", { class: "bottone-accento", type: "button", onclick: () => data.value && fai(data.value, ora.value || null) }, "Crea")));
}

// ---------- Scadenze ----------
function rigaScadenza({ m, s, k }, compatta = false) {
  const tra = giorniA(s.data);
  const testo = h("input", { type: "text", maxlength: 100, value: titoloScadenza(m, s), "aria-label": "Testo del promemoria" });
  return h("div", { class: `riga-scadenza${tra <= 2 ? " vicina" : ""}` },
    h("div", { class: "scadenza-data" },
      h("strong", {}, giornoScadenza(s)),
      h("small", {}, tra === 0 ? "oggi" : tra === 1 ? "domani" : `tra ${tra} giorni`)),
    h("div", { class: "scadenza-corpo" },
      compatta ? h("strong", {}, s.tipo) : testo,
      h("small", { class: "testo-leggero" }, `«${s.contesto}»`),
      !compatta && h("small", { class: "testo-leggero" }, `da ${m.da}`)),
    h("div", { class: "scadenza-azioni" },
      h("button", { class: "bottone-accento piccolo", type: "button", onclick: () => {
        creaPromemoriaDaMail(m, s, compatta ? null : testo.value.trim());
        if (compatta) chiudiModale();
      } }, icona("campana", 14), "Promemoria"),
      h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Ignora", title: "Ignora", onclick: () => {
        ricordaScadenza(k); aggiorna();
      } }, icona("x", 14))));
}

function pannelloScadenze(lista, totale, grande = false) {
  if (!lista.length && !grande) return null;
  return pannello(grande ? "" : "card-scadenze", "Scadenze trovate nelle mail",
    !grande && totale > lista.length ? h("button", { class: "pill", type: "button", onclick: () => { Posta.filtro = "scadenze"; ridisegnaFermo(); } }, `Tutte (${totale})`) : h("span", { class: "pill" }, String(totale)),
    lista.length
      ? h("div", { class: "elenco-scadenze" }, lista.map((x) => rigaScadenza(x)))
      : h("p", { class: "vuoto" }, "Nessuna scadenza da segnare. Quando una mail dice «entro il…», compare qui."),
    grande && h("p", { class: "testo-leggero piccolo" }, "Le cerco nelle mail Importanti e Da leggere: date con parole come «entro», «scadenza», «esame», «consegna», «deadline», «pagamento», «appuntamento». Puoi cambiare il testo prima di creare il promemoria."));
}

// ---------- Stato del collegamento ----------
function pannelloStato() {
  if (Posta.stato === "pronto" || Posta.stato === "carico") return null;
  return pannello("card-luce piccola", null, null,
    h("small", { class: "etichetta-luce" }, "Gmail"),
    h("p", {}, Posta.stato === "manca-permesso" ? "Il permesso per Gmail non c'è più: ricollega." : Posta.stato === "api-spenta" ? "Le API di Gmail sono spente nel progetto Google." : Posta.errore || "Non riesco ad aggiornare."),
    h("button", { class: "bottone-accento", type: "button", onclick: Posta.stato === "manca-permesso" ? collegaGmail : () => aggiornaPosta(true) },
      Posta.stato === "manca-permesso" ? "Ricollega Gmail" : "Riprova"));
}

// ---------- Newsletter ----------
function pannelloNewsletter() {
  const n = Posta.newsletter;
  const analizza = h("button", { class: n ? "pill" : "bottone-accento", type: "button", onclick: async (ev) => {
    ev.currentTarget.disabled = true; ev.currentTarget.textContent = "Analizzo…";
    await azionePosta(analizzaNewsletter);
  } }, n ? "Rianalizza" : "Analizza le ultime 4 settimane");

  if (!n) return pannello("", "Pulizia newsletter", null,
    h("p", { class: "testo-leggero piccolo" }, "Ti mostro chi ti scrive di più e quante di quelle mail apri davvero. Con un tocco ti disiscrivi o le silenzi."),
    analizza);

  const vive = n.mittenti.filter((x) => !regole().silenziati.includes(x.email));
  const totale = vive.reduce((s, x) => s + x.totale, 0);
  const aperte = vive.reduce((s, x) => s + x.aperte, 0);
  return pannello("", "Pulizia newsletter", analizza,
    h("p", { class: "testo-leggero piccolo" }, vive.length
      ? `${totale} mail in 4 settimane da ${vive.length} mittenti: ne hai aperte ${aperte} (${totale ? Math.round(aperte / totale * 100) : 0}%).`
      : "Nessuna newsletter rimasta. 🎉"),
    h("ul", { class: "lista-newsletter" }, vive.slice(0, 12).map((x) => {
      const quota = x.totale ? Math.round(x.aperte / x.totale * 100) : 0;
      return h("li", {},
        h("div", { class: "riga-testo" },
          h("strong", {}, x.nome || x.email),
          h("small", { class: "testo-leggero" }, `${x.totale} mail · ne apri ${quota}%${x.inArrivo ? ` · ${x.inArrivo} in arrivo` : ""}`),
          h("span", { class: "barra-aperte" }, h("i", { style: `width:${Math.max(3, quota)}%` }))),
        h("div", { class: "newsletter-azioni" },
          x.disiscrivi && h("button", { class: "pill piccola", type: "button", title: "Usa il link ufficiale della mail", onclick: () => azionePosta(async () => {
            const r = await disiscrivi(x);
            if (r === "pagina") alert("Ho aperto la pagina di disiscrizione in un'altra scheda: conferma lì. Intanto le sue mail le archivio io.");
          }) }, "Disiscriviti"),
          h("button", { class: "pill piccola", type: "button", title: "Le sue mail (anche le prossime) vanno in archivio da sole", onclick: () => azionePosta(async () => {
            aggiungiRegola("silenziati", x.email); await archiviaMittente(x);
          }) }, "Silenzia")));
    })),
    h("small", { class: "testo-leggero" }, `Analisi del ${new Date(n.del).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`));
}

// ---------- Ricevute ----------
function pannelloRicevute(lista) {
  if (!lista.length) return null;
  const collegate = lista.filter((r) => r.movimento).length;
  return pannello("", "Ricevute e ordini", h("span", { class: "pill" }, `${collegate}/${lista.length} collegate`),
    h("p", { class: "testo-leggero piccolo" }, "Le collego da solo al movimento della banca con lo stesso importo: in Spese, aprendo il movimento, vedi la ricevuta."),
    h("ul", { class: "lista-ricevute" }, lista.slice(0, 8).map((r) => h("li", {},
      h("div", { class: "riga-testo" },
        h("strong", {}, `${r.negozio} · ${euro(r.importo)}`),
        h("small", { class: "testo-leggero" }, r.movimento
          ? `✓ ${r.movimento.descrizione} del ${dataBreve(daChiave(r.movimento.data))}`
          : `${quando(r.testa.data || Date.now())} · non ancora trovata in banca`)),
      h("a", { class: "icona-tonda piccola fantasma", href: linkGmail(r.testa.thread || r.id), target: "_blank", rel: "noopener", "aria-label": "Apri in Gmail" }, icona("freccia", 14))))));
}

// ---------- Regole ----------
function pannelloRegole() {
  const R = regole();
  const gruppo = (titolo, chiave, segnaposto, spiegazione) => {
    const input = h("input", { type: "text", placeholder: segnaposto, maxlength: 60, required: true });
    return h("div", { class: "regole" },
      h("strong", {}, titolo),
      h("small", { class: "testo-leggero" }, spiegazione),
      h("div", { class: "chips" }, R[chiave].map((v) =>
        h("span", { class: "chip" }, v, h("button", { type: "button", "aria-label": `Togli ${v}`, onclick: () => {
          R[chiave] = R[chiave].filter((x) => x !== v);
          cacheSmista.clear();
          aggiorna();
        } }, icona("x", 12))))),
      h("form", { class: "modulo-chip", onsubmit: (ev) => {
        ev.preventDefault();
        if (chiave === "parole") { const v = input.value.trim(); if (v && !R.parole.includes(v)) R.parole.push(v); cacheSmista.clear(); salva(); }
        else aggiungiRegola(chiave, input.value);
        aggiorna();
        if (chiave === "silenziati") aggiornaPosta(true);
      } }, input, h("button", { class: "icona-tonda piccola", type: "submit", "aria-label": "Aggiungi" }, icona("piu", 14))));
  };
  return h("details", { class: "pannello dettagli-regole" },
    h("summary", {}, h("h3", {}, "Le tue regole"), h("small", { class: "testo-leggero" }, "mittenti, parole, silenziati")),
    gruppo("Sempre importanti", "mittenti", "es. prof.rossi@h-farm.com o h-farm.com", "Un indirizzo, un dominio o un nome."),
    gruppo("Parole importanti", "parole", "es. compiti", "Nell'oggetto contano di più."),
    gruppo("Mai importanti", "mai", "es. linkedin.com", "Restano in Da leggere, mai in Importanti."),
    gruppo("Silenziati", "silenziati", "es. zalando", "Le loro mail vanno in archivio da sole."));
}
