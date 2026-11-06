// ===== Check-up mail: solo quelle importanti, senza AI e senza spendere =====
// Per ora usa mail di esempio. Poi si collega a Gmail (gratis) e le regole qui sotto
// decidono cosa è importante: niente Claude, niente crediti, niente chiavi a pagamento.

function eImportante(mail) {
  const testo = `${mail.oggetto} ${mail.anteprima}`.toLowerCase();
  const daMittente = stato.regoleMail.mittenti.find((m) => mail.email.toLowerCase().includes(m.toLowerCase()) || mail.mittente.toLowerCase().includes(m.toLowerCase()));
  const parola = stato.regoleMail.parole.find((p) => testo.includes(p.toLowerCase()));
  return daMittente ? `mittente «${daMittente}»` : parola ? `parola «${parola}»` : null;
}

Viste.mail = function (box) {
  // Il collegamento a Gmail non c'è ancora: per ora nessuna mail (prima c'erano mail di esempio)
  const elencoMail = [];
  const conMotivo = elencoMail.map((m) => ({ ...m, motivo: eImportante(m) }));
  const importanti = conMotivo.filter((m) => m.motivo);

  const riga = (m) => h("li", { class: `riga-mail${m.motivo ? " importante" : ""}` },
    h("span", { class: "avatar piccolo" }, m.mittente[0]),
    h("div", { class: "riga-testo" },
      h("strong", {}, m.oggetto),
      h("small", {}, `${m.mittente} · ${m.anteprima}`)),
    h("div", { class: "mail-destra" },
      h("small", { class: "testo-leggero" }, dataBreve(new Date(m.data))),
      m.motivo && h("span", { class: "pill piccola urgente", title: `Importante per ${m.motivo}` }, "importante")));

  const elenco = pannello("", "Mail importanti", h("span", { class: "pill" }, `${importanti.length} su ${elencoMail.length}`),
    elencoMail.length
      ? h("ul", { class: "lista-mail" }, importanti.map(riga))
      : h("p", { class: "avviso-esempio" }, "Il collegamento a Gmail arriva presto. Intanto puoi decidere qui a fianco cosa è importante per te: quando sarà collegato, vedrai qui solo quelle mail."));

  // ---------- Regole modificabili ----------
  const gruppoRegole = (titolo, chiave, segnaposto) => {
    const input = h("input", { type: "text", placeholder: segnaposto, maxlength: 40, required: true });
    return h("div", { class: "regole" },
      h("strong", {}, titolo),
      h("div", { class: "chips" }, stato.regoleMail[chiave].map((v) =>
        h("span", { class: "chip" }, v, h("button", { type: "button", "aria-label": `Togli ${v}`, onclick: () => {
          stato.regoleMail[chiave] = stato.regoleMail[chiave].filter((x) => x !== v);
          aggiorna();
        } }, icona("x", 12))))),
      h("form", { class: "modulo-chip", onsubmit: (ev) => {
        ev.preventDefault();
        const v = input.value.trim();
        if (v && !stato.regoleMail[chiave].includes(v)) stato.regoleMail[chiave].push(v);
        aggiorna();
      } }, input, h("button", { class: "icona-tonda piccola", type: "submit", "aria-label": "Aggiungi" }, icona("piu", 14))));
  };

  const regole = pannello("", "Cosa è importante per te", null,
    h("p", { class: "testo-leggero piccolo" }, "Una mail è importante se arriva da uno di questi mittenti o contiene una di queste parole. Prova a cambiarle: la lista a fianco si aggiorna subito."),
    gruppoRegole("Mittenti", "mittenti", "es. palestra"),
    gruppoRegole("Parole chiave", "parole", "es. compiti"));

  const come = pannello("card-luce piccola", null, null,
    h("small", { class: "etichetta-luce" }, "Come funzionerà (gratis)"),
    h("ol", { class: "passi" },
      h("li", {}, "Fai il login con Google (con Supabase)."),
      h("li", {}, "Dai il permesso di sola lettura alle mail (Gmail API: gratis)."),
      h("li", {}, "L'app controlla le mail nuove con queste regole: niente AI, niente crediti.")),
    h("button", { class: "bottone-accento", type: "button", disabled: true }, "Collega Gmail · presto"));

  box.append(h("div", { class: "griglia-due larga-sinistra" }, elenco, h("div", { class: "colonna" }, come, regole)));
};
