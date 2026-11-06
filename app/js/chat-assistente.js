// ===== chat-assistente.js: la chat con l'assistente (stile "foglio che sale dal basso") =====
//
// - Toccando "Chiedi all'assistente…" sale dal basso una finestra (metà schermo sul telefono,
//   in basso a destra sul computer). Con la freccia la porti a tutto schermo.
// - Finestra vuota: logo X al centro, un saluto grande e dei suggerimenti da toccare.
// - I messaggi sono a catena (i tuoi a destra, l'assistente a sinistra).
// - Una chat al giorno: ogni giorno riparte da zero, quelle vecchie si rileggono dal ☰.
// - I messaggi li salva la funzione "assistente" nella tabella chat_assistente (08_chat_assistente.sql).

const Chat = {
  el: null,            // la finestra (creata una volta sola)
  giorno: null,        // il giorno che stai guardando ("2026-11-06")
  messaggi: [],        // [{ ruolo, testo, azioni, errore? }]
  vista: "chat",       // "chat" oppure "storico"
  giorni: [],          // per lo storico: [{ giorno, anteprima }]
  inAttesa: false,
  grande: false,
  ascolto: null,       // riconoscimento vocale in corso
};

const SUGGERIMENTI_CHAT = [
  { testo: "Ho appena pranzato", invia: true },
  { testo: "Cosa mi manca oggi?", invia: true },
  { testo: "Ricordami di ", invia: false },
  { testo: "Cosa ho domani?", invia: true },
];

const RiconoscimentoVoce = window.SpeechRecognition || window.webkitSpeechRecognition || null;

// **grassetto** e "a capo", senza innerHTML (più sicuro)
function testoChat(testo) {
  const box = h("div", { class: "chat-testo" });
  String(testo || "").split(/\*\*(.+?)\*\*/g).forEach((pezzo, i) => box.append(i % 2 ? h("strong", {}, pezzo) : pezzo));
  return box;
}

function etichettaGiorno(k) {
  const oggiK = oggiChiave();
  const ieriK = chiaveGiorno(aggiungiGiorni(new Date(), -1));
  if (k === oggiK) return "Oggi";
  if (k === ieriK) return "Ieri";
  return maiuscola(dataLunga(daChiave(k)));
}

async function caricaChatDelGiorno(k) {
  Chat.giorno = k;
  Chat.messaggi = [];
  if (typeof sb === "undefined" || !sb || !utenteSupabase) return;
  const { data, error } = await sb.from("chat_assistente")
    .select("ruolo, testo, azioni, creato_il").eq("giorno", k).order("creato_il");
  if (!error) Chat.messaggi = (data || []).map((r) => ({ ruolo: r.ruolo, testo: r.testo, azioni: r.azioni || [] }));
}

async function caricaStoricoChat() {
  Chat.giorni = [];
  if (typeof sb === "undefined" || !sb || !utenteSupabase) return;
  const { data } = await sb.from("chat_assistente")
    .select("giorno, ruolo, testo").order("creato_il", { ascending: false }).limit(600);
  const visti = new Map();
  for (const r of data || []) {
    if (!visti.has(r.giorno)) visti.set(r.giorno, { giorno: r.giorno, anteprima: "" });
    if (r.ruolo === "utente") visti.get(r.giorno).anteprima = r.testo; // resta la prima domanda del giorno
  }
  Chat.giorni = [...visti.values()];
}

// ---------- Aprire / chiudere ----------
async function apriAssistente() {
  if (!Chat.el) creaFinestraChat();
  Chat.vista = "chat";
  Chat.el.classList.add("aperta");
  document.body.classList.add("chat-aperta");
  if (Chat.giorno !== oggiChiave() || !Chat.messaggi.length) {
    await caricaChatDelGiorno(oggiChiave());
  }
  disegnaChat();
  setTimeout(() => { const t = Chat.el.querySelector(".chat-input"); if (t && window.innerWidth > 860) t.focus(); }, 250);
}

function chiudiAssistente() {
  if (!Chat.el) return;
  Chat.el.classList.remove("aperta");
  document.body.classList.remove("chat-aperta");
  if (Chat.ascolto) { try { Chat.ascolto.stop(); } catch (e) {} }
}

function creaFinestraChat() {
  Chat.el = h("div", { class: "chat-contenitore" },
    h("div", { class: "chat-velo", onclick: chiudiAssistente }),
    h("section", { class: "chat-foglio", role: "dialog", "aria-label": "Assistente" }));
  document.body.append(Chat.el);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && Chat.el.classList.contains("aperta")) chiudiAssistente(); });
}

// ---------- Disegnare ----------
function disegnaChat() {
  const foglio = Chat.el.querySelector(".chat-foglio");
  foglio.classList.toggle("grande", Chat.grande);
  const eOggi = Chat.giorno === oggiChiave();

  const testa = h("header", { class: "chat-testa" },
    h("button", { class: "chat-tondo", type: "button", "aria-label": Chat.vista === "storico" ? "Torna alla chat" : "Chat dei giorni prima",
      onclick: async () => {
        if (Chat.vista === "storico") { Chat.vista = "chat"; disegnaChat(); return; }
        Chat.vista = "storico"; disegnaChat(); await caricaStoricoChat(); disegnaChat();
      } }, Chat.vista === "storico" ? icona("sinistra", 18) : iconaMenuChat()),
    h("div", { class: "chat-titolo" },
      h("strong", {}, Chat.vista === "storico" ? "Chat precedenti" : "Assistente"),
      Chat.vista === "chat" && h("small", {}, eOggi ? "Oggi" : etichettaGiorno(Chat.giorno))),
    h("button", { class: "chat-tondo solo-telefono", type: "button", "aria-label": Chat.grande ? "Rimpicciolisci" : "Tutto schermo",
      onclick: () => { Chat.grande = !Chat.grande; disegnaChat(); } }, icona(Chat.grande ? "frecciaGiu" : "frecciaSu", 18)),
    h("button", { class: "chat-tondo", type: "button", "aria-label": "Chiudi", onclick: chiudiAssistente }, icona("x", 18)));

  const corpo = h("div", { class: "chat-corpo" });
  if (Chat.vista === "storico") corpo.append(disegnaStorico());
  else if (!Chat.messaggi.length && eOggi) corpo.append(disegnaBenvenuto());
  else corpo.append(disegnaMessaggi());

  const piede = Chat.vista === "storico" ? null
    : eOggi ? disegnaBarra()
    : h("div", { class: "chat-piede-vecchio" },
        h("button", { class: "bottone-accento", type: "button", onclick: async () => { await caricaChatDelGiorno(oggiChiave()); disegnaChat(); } }, "Torna alla chat di oggi"));

  foglio.replaceChildren(h("div", { class: "chat-alone" }), testa, corpo, piede);
  corpo.scrollTop = corpo.scrollHeight;
}

function iconaMenuChat() {
  const s = h("span", { class: "icona", "aria-hidden": "true" });
  s.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>';
  return s;
}

function disegnaBenvenuto() {
  const nome = (utenteAttuale && utenteAttuale.nome) || "";
  return h("div", { class: "chat-benvenuto" },
    h("img", { class: "chat-logo", src: "img/logo.svg", alt: "" }),
    h("h2", {}, nome ? `Cosa facciamo oggi, ${nome}?` : "Cosa facciamo oggi?"),
    h("p", {}, "Dimmi cosa hai fatto e spunto le caselle, oppure chiedimi di ricordarti qualcosa."),
    h("div", { class: "chat-suggerimenti" }, SUGGERIMENTI_CHAT.map((s) =>
      h("button", { class: "chat-chip", type: "button", onclick: () => {
        if (s.invia) return inviaMessaggioChat(s.testo);
        const t = Chat.el.querySelector(".chat-input");
        t.value = s.testo; t.focus(); adattaAltezza(t);
      } }, s.testo))));
}

function disegnaMessaggi() {
  const lista = h("div", { class: "chat-lista" });
  for (const m of Chat.messaggi) {
    if (m.ruolo === "utente") {
      lista.append(h("div", { class: "chat-msg utente" }, testoChat(m.testo)));
    } else {
      lista.append(h("div", { class: `chat-msg assistente${m.errore ? " errore" : ""}` },
        h("img", { class: "chat-mini-logo", src: "img/logo.svg", alt: "" }),
        h("div", { class: "chat-msg-contenuto" },
          testoChat(m.testo),
          (m.azioni || []).length > 0 && h("ul", { class: "assistente-azioni" }, m.azioni.map((a) => h("li", {}, a))))));
    }
  }
  if (Chat.inAttesa) {
    lista.append(h("div", { class: "chat-msg assistente" },
      h("img", { class: "chat-mini-logo pulsa", src: "img/logo.svg", alt: "" }),
      h("div", { class: "chat-puntini", "aria-label": "Sto pensando" }, h("i"), h("i"), h("i"))));
  }
  return lista;
}

function disegnaStorico() {
  if (!Chat.giorni.length) return h("p", { class: "chat-vuoto" }, "Qui trovi le chat dei giorni prima. Per ora non ce ne sono.");
  return h("ul", { class: "chat-storico" }, Chat.giorni.map((g) =>
    h("li", {}, h("button", { type: "button", onclick: async () => {
      Chat.vista = "chat"; await caricaChatDelGiorno(g.giorno); disegnaChat();
    } },
      h("strong", {}, etichettaGiorno(g.giorno)),
      h("small", {}, g.anteprima || "…")))));
}

function adattaAltezza(t) {
  t.style.height = "auto";
  t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
}

function disegnaBarra() {
  const input = h("textarea", { class: "chat-input", rows: 1, maxlength: 2000, placeholder: "Chiedi all'assistente",
    oninput: (e) => adattaAltezza(e.target) });
  input.addEventListener("keydown", (e) => {
    // Invio = manda, Maiusc+Invio = va a capo (sul telefono Invio va a capo)
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 860) { e.preventDefault(); invia(); }
  });
  const invia = () => { const testo = input.value.trim(); if (testo && !Chat.inAttesa) inviaMessaggioChat(testo); };

  const microfono = RiconoscimentoVoce && h("button", { class: "chat-mic", type: "button", "aria-label": "Detta a voce",
    onclick: (e) => dettaAVoce(input, e.currentTarget) }, iconaMicrofono());

  return h("form", { class: "chat-barra", onsubmit: (e) => { e.preventDefault(); invia(); } },
    h("div", { class: "chat-pillola" },
      input,
      microfono,
      h("button", { class: "chat-invia", type: "submit", "aria-label": "Invia", disabled: Chat.inAttesa }, icona("frecciaSu", 20))));
}

function iconaMicrofono() {
  const s = h("span", { class: "icona", "aria-hidden": "true" });
  s.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  return s;
}

// Dettatura con il riconoscimento vocale del browser (Chrome, Safari): il testo finisce nella barra
function dettaAVoce(input, bottone) {
  if (Chat.ascolto) { try { Chat.ascolto.stop(); } catch (e) {} return; }
  const r = new RiconoscimentoVoce();
  r.lang = "it-IT";
  r.interimResults = true;
  const inizio = input.value ? `${input.value.trim()} ` : "";
  r.onresult = (ev) => {
    let testo = "";
    for (const ris of ev.results) testo += ris[0].transcript;
    input.value = inizio + testo;
    adattaAltezza(input);
  };
  r.onend = () => { Chat.ascolto = null; bottone.classList.remove("ascolto"); };
  r.onerror = () => { Chat.ascolto = null; bottone.classList.remove("ascolto"); };
  Chat.ascolto = r;
  bottone.classList.add("ascolto");
  r.start();
}

// ---------- Mandare un messaggio ----------
async function inviaMessaggioChat(testo) {
  if (Chat.inAttesa) return;
  if (typeof sb === "undefined" || !sb || !utenteSupabase) {
    Chat.messaggi.push({ ruolo: "assistente", testo: "Per usare l'assistente devi accedere con il tuo account.", errore: true });
    disegnaChat();
    return;
  }
  Chat.messaggi.push({ ruolo: "utente", testo });
  Chat.inAttesa = true;
  disegnaChat();
  try {
    // prima mandiamo al database le ultime modifiche, così l'assistente vede tutto aggiornato
    if (typeof inviaAlCloud === "function") await inviaAlCloud();
    const { data, error } = await sb.functions.invoke("assistente", { body: { domanda: testo } });
    if (error) {
      let msg = "L'assistente non risponde, riprova tra poco.";
      try { const corpo = await error.context.json(); if (corpo && corpo.errore) msg = corpo.errore; } catch (e) {}
      throw new Error(msg);
    }
    Chat.messaggi.push({ ruolo: "assistente", testo: data.risposta || "", azioni: data.azioni || [] });
    // ha spuntato caselle o creato promemoria: ricarichiamo i dati e ridisegniamo la pagina sotto
    if (Array.isArray(data.cambiati) && data.cambiati.length && typeof scaricaDalCloud === "function") {
      try {
        await applicaDalCloud(await scaricaDalCloud());
        disegna();
        if (typeof inviaPromemoriaAGoogle === "function") {
          for (const p of stato.promemoria.filter((x) => x.da_inviare)) inviaPromemoriaAGoogle(p);
        }
      } catch (e) { /* li vedrai al prossimo aggiornamento */ }
    }
  } catch (e) {
    Chat.messaggi.push({ ruolo: "assistente", testo: e.message || "L'assistente non risponde, riprova tra poco.", errore: true });
  }
  Chat.inAttesa = false;
  disegnaChat();
}
