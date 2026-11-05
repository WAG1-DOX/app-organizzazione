// ===== Settimana prossima: organizzarla in anticipo =====

let settimanaPiano = null;   // il lunedì della settimana che stai organizzando

Viste.settimana = function (box) {
  if (!settimanaPiano) settimanaPiano = aggiungiGiorni(inizioSettimana(new Date()), 7);
  const lunedi = settimanaPiano;
  const giorni = [0, 1, 2, 3, 4, 5, 6].map((i) => aggiungiGiorni(lunedi, i));
  const kSettimana = chiaveGiorno(lunedi);
  const oggiK = oggiChiave();
  const questa = chiaveGiorno(inizioSettimana(new Date()));
  const etichetta = kSettimana === questa ? "Questa settimana" : kSettimana === chiaveGiorno(aggiungiGiorni(daChiave(questa), 7)) ? "Settimana prossima" : "Settimana";
  const sposta = (n) => { settimanaPiano = aggiungiGiorni(lunedi, 7 * n); disegna(); };

  // ---------- Totali della settimana per area ----------
  const totali = { lezioni: 0, produttivita: 0, extra: 0, routine: 0 };
  const perGiorno = giorni.map((d) => {
    const m = minutiPerArea(d);
    for (const a in totali) totali[a] += m[a];
    return m;
  });
  const occupato = Object.values(totali).reduce((s, x) => s + x, 0);
  const sveglioSettimana = giorni.reduce((s, d) => s + minutiSveglio(d), 0);   // dipende da sveglia e ora di dormire
  const libero = Math.max(0, sveglioSettimana - occupato);

  const riga = h("div", { class: "riga-numeri cinque" },
    Object.entries(AREE_GIORNATA).map(([a, info]) => h("div", { class: "numero-card", style: `--c:${info.colore}` },
      h("small", { class: "con-pallino" }, h("i", { style: `background:${info.colore}` }), info.nome),
      h("strong", {}, durata(totali[a])),
      h("span", { class: "testo-leggero piccolo" }, `${Math.round((totali[a] / sveglioSettimana) * 100)}% del tempo sveglio`))),
    h("div", { class: "numero-card accento" },
      h("small", {}, "Tempo libero"),
      h("strong", {}, durata(libero)),
      h("span", { class: "testo-leggero piccolo" }, `circa ${durata(libero / 7)} al giorno`)));

  // ---------- Attività da trascinare ----------
  const tavolozza = h("div", { class: "tavolozza-settimana" },
    h("span", { class: "testo-leggero piccolo" }, "Trascina su un giorno:"),
    stato.modelliExtra.map((m) => h("button", {
      class: "chip-micro", type: "button", draggable: "true", style: `--c:${AREE_GIORNATA[areaEvento(m)].colore}`,
      ondragstart: (ev) => { ev.dataTransfer.setData("text/plain", `extra:${m.id}`); ev.dataTransfer.effectAllowed = "copy"; },
      onclick: () => apriPianifica(m, null, giorni),
    }, h("span", {}, m.nome), h("small", {}, durata(m.minuti)))),
    h("button", { class: "pill piccola", type: "button", onclick: apriNuovoModello }, icona("piu", 12), "Nuova attività"));

  // ---------- Una colonna per giorno ----------
  const colonne = giorni.map((d, i) => {
    const k = chiaveGiorno(d);
    const m = perGiorno[i];
    const voci = [
      ...lezioniDelGiorno(d).map((l) => ({ ora: l.inizio, fine: l.fine, titolo: l.materia, colore: AREE_GIORNATA.lezioni.colore, apri: () => apriModificaLezione(l) })),
      ...eventiDelGiorno(d).map((e) => ({
        ora: e.tutto_il_giorno ? "" : oraDi(new Date(e.inizio)), fine: e.tutto_il_giorno ? "" : oraDi(new Date(e.fine)), titolo: e.titolo,
        colore: coloreEvento(e) || AREE_GIORNATA[areaEvento(e)].colore, apri: () => apriModificaEvento(e),
      })),
    ].sort((a, b) => a.ora.localeCompare(b.ora));

    const colonna = h("article", { class: `giorno-piano${k === oggiK ? " oggi" : ""}${k < oggiK ? " passato-giorno" : ""}` },
      h("header", {},
        h("span", {}, GIORNI_BREVI[d.getDay()]),
        h("strong", {}, d.getDate()),
        h("button", { class: "icona-tonda piccola", type: "button", "aria-label": `Nuovo evento ${dataLunga(d)}`, onclick: () => apriModificaEvento(null, { data: k, ora: daMinutiS(primoSpazioLibero(d, 60)) }) }, icona("piu", 14))),
      h("button", { class: `orari-sonno${stato.sonno.giorni[k] ? " cambiati" : ""}`, type: "button", title: "Cambia sveglia e ora di dormire di questo giorno", onclick: () => apriSonnoGiorno(d) },
        h("span", {}, icona("sole", 12), orariSonno(d).sveglia), h("span", {}, icona("luna", 12), orariSonno(d).dormire)),
      h("div", { class: "carico", title: `Occupato: ${durata(Object.values(m).reduce((s, x) => s + x, 0))} su ${durata(minutiSveglio(d))} da sveglio` },
        Object.entries(AREE_GIORNATA).map(([a, info]) => m[a] ? h("span", { style: `width:${Math.min(100, (m[a] / minutiSveglio(d)) * 100)}%;background:${info.colore}` }) : null)),
      voci.length
        ? h("ul", {}, voci.map((v) => h("li", {},
            h("button", { type: "button", class: "voce-piano", style: `--c:${v.colore}`, onclick: v.apri, title: `${v.titolo}${v.ora ? ` · ${v.ora}–${v.fine}` : ""}` },
              h("span", { class: "voce-piano-ora" }, v.ora || "giorno"),
              h("span", { class: "voce-piano-titolo" }, v.titolo)))))
        : h("p", { class: "giorno-vuoto" }, "Libero"),
      h("p", { class: "zona-rilascio" }, "Lascia qui"));

    colonna.addEventListener("dragover", (ev) => { ev.preventDefault(); colonna.classList.add("sopra"); });
    colonna.addEventListener("dragleave", (ev) => { if (!colonna.contains(ev.relatedTarget)) colonna.classList.remove("sopra"); });
    colonna.addEventListener("drop", (ev) => {
      ev.preventDefault();
      colonna.classList.remove("sopra");
      const [cosa, id] = ev.dataTransfer.getData("text/plain").split(":");
      const modello = cosa === "extra" && stato.modelliExtra.find((x) => x.id === id);
      if (modello) apriPianifica(modello, d, giorni);
    });
    return colonna;
  });

  const tabellone = pannello("card-piano", `${etichetta} · ${lunedi.getDate()}–${giorni[6].getDate()} ${giorni[6].toLocaleDateString("it-IT", { month: "long" })}`,
    h("div", { class: "gruppo-pill" },
      h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Settimana prima", onclick: () => sposta(-1) }, icona("sinistra", 16)),
      h("button", { class: "pill", type: "button", onclick: () => { settimanaPiano = aggiungiGiorni(inizioSettimana(new Date()), 7); disegna(); } }, "Prossima"),
      h("button", { class: "icona-tonda piccola", type: "button", "aria-label": "Settimana dopo", onclick: () => sposta(1) }, icona("destra", 16))),
    tavolozza,
    h("div", { class: "griglia-piano" }, colonne));

  // ---------- Obiettivi della settimana ----------
  const obiettivi = (stato.obiettivi[kSettimana] ||= []);
  const testo = h("input", { type: "text", placeholder: "es. Ripassare 2 capitoli di Accounting", required: true, maxlength: 100 });
  const pannelloObiettivi = pannello("", "Obiettivi della settimana", h("span", { class: "pill piccola" }, `${obiettivi.filter((o) => o.fatto).length}/${obiettivi.length}`),
    h("form", { class: "modulo-chip", onsubmit: (ev) => {
      ev.preventDefault();
      obiettivi.push({ id: nuovoId("ob"), testo: testo.value.trim(), fatto: false });
      aggiorna();
    } }, testo, h("button", { class: "icona-tonda piccola", type: "submit", "aria-label": "Aggiungi obiettivo" }, icona("piu", 14))),
    obiettivi.length
      ? h("ul", { class: "lista-promemoria" }, obiettivi.map((o) => h("li", { class: `riga-promemoria${o.fatto ? " fatto" : ""}` },
          h("button", { class: `spunta${o.fatto ? " fatta" : ""}`, type: "button", "aria-label": "Fatto", onclick: () => { o.fatto = !o.fatto; aggiorna(); } }, icona("check", 14)),
          h("span", { class: "promemoria-testo" }, o.testo),
          h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Togli", onclick: () => { stato.obiettivi[kSettimana] = obiettivi.filter((x) => x !== o); aggiorna(); } }, icona("x", 14)))))
      : h("p", { class: "vuoto" }, "Scrivi 2 o 3 cose che vuoi assolutamente fare"));

  // ---------- Scadenze di scuola della settimana ----------
  const scadenze = giorni.flatMap((d) => eventiDelGiorno(d).filter((e) => eScuola(e) && (eScadenza(e) || e.tutto_il_giorno)));
  const pannelloScadenze = pannello("", "Scadenze ed esami", null,
    scadenze.length
      ? h("ul", { class: "lista-semplice" }, scadenze.map((e) => {
          const d = new Date(e.inizio);
          return h("li", {}, h("button", { class: "riga-cliccabile", type: "button", onclick: () => apriModificaEvento(e) },
            h("span", { class: "data-cubo" }, h("small", {}, GIORNI_BREVI[d.getDay()]), h("strong", {}, d.getDate())),
            h("span", { class: "riga-testo" }, h("strong", {}, e.titolo), h("small", {}, e.tutto_il_giorno ? "tutto il giorno" : oraDi(d)))));
        }))
      : h("p", { class: "vuoto" }, "Nessuna scadenza questa settimana"));

  box.append(riga, tabellone, h("div", { class: "griglia-tre" }, pannelloSonno(giorni), pannelloObiettivi, pannelloScadenze));
};

const daMinutiS = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// Mettere un'attività in un giorno: propone il primo spazio libero
function apriPianifica(modello, giorno, giorni) {
  const scelta = h("select", {}, giorni.map((d) => h("option", { value: chiaveGiorno(d), selected: giorno && chiaveGiorno(d) === chiaveGiorno(giorno) }, maiuscola(dataLunga(d)))));
  const ora = h("input", { type: "time", required: true, step: 300 });
  const suggerimento = h("p", { class: "testo-leggero piccolo" });
  const proponi = () => {
    const t = primoSpazioLibero(daChiave(scelta.value), modello.minuti);
    ora.value = daMinutiS(t);
    suggerimento.textContent = `Primo spazio libero per ${durata(modello.minuti)}: ${daMinutiS(t)}–${daMinutiS(t + modello.minuti)}`;
  };
  scelta.addEventListener("change", proponi);
  proponi();

  apriModale(`Pianifica «${modello.nome}»`,
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      const inizio = daChiave(scelta.value);
      const [hh, mm] = ora.value.split(":").map(Number);
      inizio.setHours(hh, mm, 0, 0);
      salvaEvento(nuovoEvento({ titolo: modello.nome, tipo: modello.tipo, inizio: isoLocale(inizio), fine: isoLocale(new Date(inizio.getTime() + modello.minuti * 60000)) }));
      chiudiModale();
      aggiorna();
    } },
      h("div", { class: "due-campi" }, campo("Giorno", scelta), campo("Ora", ora)),
      suggerimento,
      h("button", { class: "bottone-accento largo", type: "submit" }, icona("piu", 16), "Metti in calendario")));
}

// ---------- Sonno: sveglia e ora di dormire ----------
function pannelloSonno(giorni) {
  const sveglia = h("input", { type: "time", value: stato.sonno.sveglia, "aria-label": "Sveglia di solito" });
  const dormire = h("input", { type: "time", value: stato.sonno.dormire, "aria-label": "A letto di solito" });
  const salvaPredefiniti = () => {
    if (!sveglia.value || !dormire.value) return;
    stato.sonno.sveglia = sveglia.value;
    stato.sonno.dormire = dormire.value;
    aggiorna();
  };
  sveglia.addEventListener("change", salvaPredefiniti);
  dormire.addEventListener("change", salvaPredefiniti);

  const notti = giorni.map((d) => minutiSonnoNotte(d));
  const media = notti.reduce((s, x) => s + x, 0) / notti.length;

  return pannello("card-sonno", "Sonno", h("span", { class: `pill piccola${media < 7 * 60 ? " pericolo" : " attiva"}` }, `media ${durata(media)}`),
    h("div", { class: "sonno-predefinito" },
      campo("Sveglia di solito", sveglia),
      campo("A letto di solito", dormire)),
    h("ul", { class: "lista-sonno" }, giorni.map((d, i) => {
      const k = chiaveGiorno(d);
      const o = orariSonno(d);
      return h("li", { class: stato.sonno.giorni[k] ? "cambiato" : "" },
        h("button", { type: "button", onclick: () => apriSonnoGiorno(d) },
          h("span", { class: "sonno-giorno" }, `${GIORNI_BREVI[d.getDay()]} ${d.getDate()}`),
          h("span", { class: "sonno-orari" }, icona("sole", 12), o.sveglia, icona("luna", 12), o.dormire),
          h("span", { class: `sonno-ore${notti[i] < 7 * 60 ? " poche" : ""}` }, `${durata(notti[i])} di sonno`)));
    })),
    h("p", { class: "testo-leggero piccolo" }, "Tocca un giorno per cambiare solo quello. Sotto le 7 ore il numero diventa rosso."));
}

function apriSonnoGiorno(d) {
  const k = chiaveGiorno(d);
  const o = orariSonno(d);
  const sveglia = h("input", { type: "time", value: o.sveglia, required: true });
  const dormire = h("input", { type: "time", value: o.dormire, required: true });
  const tutti = h("input", { type: "checkbox" });
  apriModale(`Sonno · ${maiuscola(dataLunga(d))}`,
    h("form", { class: "modulo", onsubmit: (ev) => {
      ev.preventDefault();
      if (tutti.checked) {
        stato.sonno.sveglia = sveglia.value;
        stato.sonno.dormire = dormire.value;
        stato.sonno.giorni = {};
      } else {
        stato.sonno.giorni[k] = { sveglia: sveglia.value, dormire: dormire.value };
      }
      chiudiModale();
      aggiorna();
    } },
      h("div", { class: "due-campi" }, campo("Sveglia", sveglia), campo("A letto", dormire)),
      h("label", { class: "spunta-riga" }, tutti, "Usa questi orari per tutti i giorni"),
      h("div", { class: "azioni-modale" },
        stato.sonno.giorni[k] && h("button", { class: "bottone-secondario", type: "button", onclick: () => {
          delete stato.sonno.giorni[k];
          chiudiModale();
          aggiorna();
        } }, "Torna agli orari di solito"),
        h("button", { class: "bottone-accento", type: "submit" }, "Salva"))));
}
