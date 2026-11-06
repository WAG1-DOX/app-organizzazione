// ===== Chat e gruppi =====
//
// - Gruppi: ne crei uno (es. "Classe"), ti dà un codice di 6 caratteri, lo mandi agli
//   amici e loro entrano scrivendolo qui. Gli eventi messi "nel gruppo" li vedono tutti.
// - Chat: scrivi a chi è in un gruppo con te. I messaggi arrivano subito grazie a
//   Supabase Realtime (non serve ricaricare la pagina).
// Tabelle usate: gruppi, membri_gruppo, profili, messaggi (vedi CLAUDE.md).

const Social = {
  caricato: false,
  errore: "",
  gruppi: [],             // { id, nome, codice, creato_da }
  membri: [],             // { gruppo_id, utente_id, ruolo }
  profili: new Map(),     // id → { id, nome, avatar_url }
  messaggi: [],           // dal più vecchio al più nuovo
  conChi: null,           // id della persona con cui stai chattando
  bozza: "",              // quello che stai scrivendo (non si perde se arriva un messaggio)
  canale: null,
};

// I gruppi da mostrare nel calendario: quelli veri se hai l'account, altrimenti quelli finti
function gruppiDisponibili() {
  return utenteSupabase ? Social.gruppi : gruppiFinti;
}

const nomeDi = (id) => (Social.profili.get(id) || {}).nome || "Qualcuno";

// Le persone con cui puoi chattare: chi è in almeno un gruppo con te
function contatti() {
  const io = utenteSupabase && utenteSupabase.id;
  const ids = new Set(Social.membri.map((m) => m.utente_id).filter((id) => id !== io));
  // anche chi ti ha scritto (magari è uscito dal gruppo): la conversazione resta
  for (const m of Social.messaggi) ids.add(m.mittente_id === io ? m.destinatario_id : m.mittente_id);
  ids.delete(io);
  const ultimo = (id) => {
    const lista = conversazione(id);
    return lista.length ? lista[lista.length - 1].creato_il : "";
  };
  return [...ids].sort((a, b) => ultimo(b).localeCompare(ultimo(a)) || nomeDi(a).localeCompare(nomeDi(b)));
}

function conversazione(id) {
  const io = utenteSupabase.id;
  return Social.messaggi.filter((m) =>
    (m.mittente_id === io && m.destinatario_id === id) || (m.mittente_id === id && m.destinatario_id === io));
}

const nonLettiDa = (id) => Social.messaggi.filter((m) => m.mittente_id === id && m.destinatario_id === utenteSupabase.id && !m.letto).length;
const nonLettiTotali = () => utenteSupabase ? Social.messaggi.filter((m) => m.destinatario_id === utenteSupabase.id && !m.letto).length : 0;

// ---------- Scaricare gruppi, persone e messaggi ----------
async function caricaSocial() {
  if (!sb || !utenteSupabase) return;
  try {
    const [g, m, p, msg] = await Promise.all([
      sb.from("gruppi").select("*").order("creato_il"),
      sb.from("membri_gruppo").select("gruppo_id, utente_id, ruolo"),
      sb.from("profili").select("id, nome, avatar_url"),
      sb.from("messaggi").select("*").order("creato_il", { ascending: false }).limit(1000),
    ]);
    for (const r of [g, m, p, msg]) if (r.error) throw r.error;
    Social.gruppi = g.data;
    Social.membri = m.data;
    Social.profili = new Map(p.data.map((x) => [x.id, x]));
    Social.messaggi = msg.data.reverse();
    Social.errore = "";
  } catch (e) {
    console.warn("Chat: dati non scaricati", e && e.message);
    Social.errore = "Non riesco a scaricare chat e gruppi. Controlla internet e riprova.";
  }
  Social.caricato = true;
  ascoltaMessaggi();
  aggiornaBadgeChat();
}

// ---------- Tempo reale: i messaggi nuovi arrivano da soli ----------
function ascoltaMessaggi() {
  if (Social.canale || !sb) return;
  Social.canale = sb.channel("messaggi-miei")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messaggi" }, ({ new: m }) => {
      if (Social.messaggi.some((x) => x.id === m.id)) return; // già aggiunto (l'ho mandato io)
      Social.messaggi.push(m);
      if (!Social.profili.has(m.mittente_id)) caricaSocial().then(ridisegnaChat);
      ridisegnaChat();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messaggi" }, ({ new: m }) => {
      const i = Social.messaggi.findIndex((x) => x.id === m.id);
      if (i >= 0) { Social.messaggi[i] = m; ridisegnaChat(); }
    })
    .subscribe();
}

// Ridisegna la chat senza perdere quello che stai scrivendo
function ridisegnaChat() {
  aggiornaBadgeChat();
  if (sezioneAttuale().id !== "chat") return;
  if (document.getElementById("modale").classList.contains("aperta")) return;
  const scrivevi = document.activeElement && document.activeElement.id === "chat-input";
  const scroll = window.scrollY;
  disegna();
  window.scrollTo(0, scroll);
  if (scrivevi) document.getElementById("chat-input").focus();
}

// Pallino con il numero di messaggi non letti sulla voce "Chat" del menu
function aggiornaBadgeChat() {
  const voce = document.querySelector('#menu .menu-voce[data-id="chat"]');
  if (!voce) return;
  const vecchio = voce.querySelector(".pallino-avviso");
  if (vecchio) vecchio.remove();
  const n = nonLettiTotali();
  if (n) voce.append(h("span", { class: "pallino-avviso pallino-menu" }, n > 99 ? "99+" : n));
}

// ---------- Azioni ----------
async function mandaMessaggio(testo) {
  const { data, error } = await sb.from("messaggi")
    .insert({ destinatario_id: Social.conChi, testo }).select().single();
  if (error) throw error;
  if (!Social.messaggi.some((x) => x.id === data.id)) Social.messaggi.push(data);
}

async function segnaComeLetti(id) {
  const daSegnare = Social.messaggi.filter((m) => m.mittente_id === id && m.destinatario_id === utenteSupabase.id && !m.letto);
  if (!daSegnare.length) return;
  for (const m of daSegnare) m.letto = true;
  aggiornaBadgeChat();
  await sb.from("messaggi").update({ letto: true }).in("id", daSegnare.map((m) => m.id));
}

async function creaGruppo(nome) {
  const { error } = await sb.from("gruppi").insert({ nome });
  if (error) throw error;
  await caricaSocial();
}

async function entraConCodice(codice) {
  const { error } = await sb.rpc("entra_nel_gruppo", { codice_invito: codice });
  if (error) throw new Error(/codice sbagliato/i.test(error.message) ? "Codice sbagliato: controlla le lettere." : error.message);
  await caricaSocial();
}

async function esciDalGruppo(g) {
  if (!confirm(`Vuoi uscire dal gruppo «${g.nome}»? Non vedrai più i suoi eventi.`)) return;
  const { error } = await sb.from("membri_gruppo").delete().eq("gruppo_id", g.id).eq("utente_id", utenteSupabase.id);
  if (error) { alert("Non sono riuscito a farti uscire. Riprova."); return; }
  await caricaSocial();
  disegna();
}

async function eliminaGruppo(g) {
  if (!confirm(`Eliminare il gruppo «${g.nome}» per tutti? Spariscono anche gli eventi del gruppo.`)) return;
  const { error } = await sb.from("gruppi").delete().eq("id", g.id);
  if (error) { alert("Non sono riuscito a eliminarlo. Riprova."); return; }
  await caricaSocial();
  disegna();
}

// ---------- La pagina ----------
Viste.chat = function (box) {
  if (!sb || !utenteSupabase) {
    box.append(pannello("", "Chat e gruppi", null, h("p", { class: "vuoto" }, "Per chattare e creare gruppi devi accedere con il tuo account.")));
    return;
  }
  if (!Social.caricato) {
    box.append(pannello("", "Chat e gruppi", null, h("p", { class: "vuoto" }, "Carico chat e gruppi…")));
    caricaSocial().then(ridisegnaChat);
    return;
  }

  const persone = contatti();
  if (!Social.conChi || !persone.includes(Social.conChi)) Social.conChi = persone[0] || null;

  box.append(h("div", { class: "griglia-due larga-sinistra" },
    pannelloConversazione(),
    h("div", { class: "colonna" }, pannelloContatti(persone), pannelloGruppi())));

  if (Social.conChi) {
    segnaComeLetti(Social.conChi);
    const lista = box.querySelector(".chat-messaggi");
    if (lista) lista.scrollTop = lista.scrollHeight;
  }
};

function pannelloConversazione() {
  if (Social.errore) return pannello("", "Chat", null, h("p", { class: "vuoto" }, Social.errore));
  if (!Social.conChi) {
    return pannello("", "Chat", null,
      h("p", { class: "vuoto" }, "Qui chatti con chi è in un gruppo con te. Crea un gruppo o entra con un codice nel riquadro «I tuoi gruppi», poi torna qui."));
  }
  const io = utenteSupabase.id;
  const lista = conversazione(Social.conChi);
  let giornoPrima = "";

  const messaggi = h("div", { class: "chat-messaggi" },
    lista.length ? lista.map((m) => {
      const d = new Date(m.creato_il);
      const k = chiaveGiorno(d);
      const separatore = k !== giornoPrima ? h("div", { class: "chat-giorno" }, k === oggiChiave() ? "Oggi" : maiuscola(dataBreve(d))) : null;
      giornoPrima = k;
      const mio = m.mittente_id === io;
      return [separatore, h("div", { class: `chat-fumetto${mio ? " mio" : ""}` },
        h("span", { class: "chat-testo" }, m.testo),
        h("small", {}, oraDi(d), mio && m.letto ? " · letto" : ""))];
    }) : h("p", { class: "vuoto" }, `Scrivi il primo messaggio a ${nomeDi(Social.conChi)}!`));

  const input = h("input", { type: "text", id: "chat-input", placeholder: "Scrivi un messaggio…", maxlength: 2000, autocomplete: "off", value: Social.bozza,
    oninput: (e) => { Social.bozza = e.target.value; } });
  const errore = h("p", { class: "chat-errore" });
  const modulo = h("form", { class: "chat-scrivi", onsubmit: async (ev) => {
    ev.preventDefault();
    const testo = input.value.trim();
    if (!testo) return;
    input.disabled = true;
    try {
      await mandaMessaggio(testo);
      Social.bozza = "";
      input.value = "";
      errore.textContent = "";
    } catch (e) {
      errore.textContent = "Messaggio non mandato: controlla internet e riprova.";
    }
    input.disabled = false;
    ridisegnaChat();
    const di = document.getElementById("chat-input");
    if (di) di.focus();
  } }, input, h("button", { class: "bottone-accento", type: "submit", "aria-label": "Manda" }, icona("freccia", 18)));

  return pannello("chat-pannello", nomeDi(Social.conChi), null, messaggi, modulo, errore);
}

function pannelloContatti(persone) {
  return pannello("", "Persone", h("span", { class: "pill" }, `${persone.length}`),
    persone.length
      ? h("ul", { class: "chat-contatti" }, persone.map((id) => {
        const n = nonLettiDa(id);
        const lista = conversazione(id);
        const ultimo = lista[lista.length - 1];
        return h("li", {}, h("button", { type: "button", class: `chat-contatto${id === Social.conChi ? " attivo" : ""}`,
          onclick: () => { Social.conChi = id; Social.bozza = ""; disegna(); } },
          h("span", { class: "avatar piccolo" }, nomeDi(id)[0].toUpperCase()),
          h("span", { class: "chat-contatto-testo" }, h("strong", {}, nomeDi(id)),
            h("small", {}, ultimo ? ultimo.testo.slice(0, 40) : "Nessun messaggio")),
          n ? h("span", { class: "pallino-avviso chat-non-letti" }, n) : null));
      }))
      : h("p", { class: "vuoto" }, "Ancora nessuno: invita qualcuno in un gruppo."));
}

function pannelloGruppi() {
  const io = utenteSupabase.id;
  const messaggio = h("p", { class: "chat-errore" });

  const nome = h("input", { type: "text", placeholder: "Es. Classe 4B", maxlength: 40, required: true });
  const creaModulo = h("form", { class: "modulo-riga", onsubmit: async (ev) => {
    ev.preventDefault();
    try { await creaGruppo(nome.value.trim()); disegna(); }
    catch (e) { messaggio.textContent = "Non sono riuscito a creare il gruppo. Riprova."; }
  } }, campo("Nuovo gruppo", nome), h("button", { class: "bottone-accento", type: "submit" }, icona("piu", 16), "Crea"));

  const codice = h("input", { type: "text", placeholder: "Es. A3F09B", maxlength: 6, required: true, style: "text-transform:uppercase" });
  const entraModulo = h("form", { class: "modulo-riga", onsubmit: async (ev) => {
    ev.preventDefault();
    try { await entraConCodice(codice.value.trim()); disegna(); }
    catch (e) { messaggio.textContent = e.message; }
  } }, campo("Entra con un codice", codice), h("button", { class: "bottone-secondario", type: "submit" }, "Entra"));

  const riga = (g) => {
    const membri = Social.membri.filter((m) => m.gruppo_id === g.id);
    const admin = membri.some((m) => m.utente_id === io && m.ruolo === "admin");
    return h("li", { class: "chat-gruppo" },
      h("div", { class: "chat-gruppo-testa" },
        h("strong", {}, g.nome),
        admin
          ? h("button", { class: "icona-tonda piccola fantasma", type: "button", "aria-label": "Elimina il gruppo", title: "Elimina il gruppo", onclick: () => eliminaGruppo(g) }, icona("cestino", 14))
          : h("button", { class: "link-sottile", type: "button", onclick: () => esciDalGruppo(g) }, "Esci")),
      h("small", { class: "testo-leggero" }, membri.map((m) => (m.utente_id === io ? "tu" : nomeDi(m.utente_id))).join(", ")),
      g.codice && h("div", { class: "chat-codice" },
        h("span", {}, "Codice: ", h("strong", {}, g.codice)),
        h("button", { class: "link-sottile", type: "button", onclick: async (ev) => {
          try { await navigator.clipboard.writeText(g.codice); ev.target.textContent = "Copiato!"; }
          catch (e) { ev.target.textContent = "Copialo a mano"; }
        } }, "Copia")));
  };

  return pannello("", "I tuoi gruppi", h("span", { class: "pill" }, `${Social.gruppi.length}`),
    Social.gruppi.length ? h("ul", { class: "chat-gruppi" }, Social.gruppi.map(riga)) : h("p", { class: "testo-leggero" }, "Non sei ancora in nessun gruppo."),
    h("p", { class: "testo-leggero piccolo" }, "Mandi il codice agli amici (es. su WhatsApp) e loro lo scrivono qui per entrare."),
    creaModulo, entraModulo, messaggio);
}
