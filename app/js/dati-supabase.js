// ===== dati-supabase.js: salvare i dati nel database (INNESTO PRONTO MA SPENTO) =====
//
// Si accende con SUPABASE_DATI_ATTIVI = true in config.js, ma SOLO dopo che Edoardo
// ha eseguito il codice SQL di app/tabelle-nuove.md (tabella dati_personali + campi nuovi di eventi).
// ⚠️ Scritto ma non ancora provato con il database vero: la prima volta va provato insieme.
//
// Come funziona:
// - Eventi: quelli creati nell'app vanno nella tabella "eventi" (con la sicurezza di Edoardo,
//   e in tempo reale: se Edoardo crea un evento in un gruppo comune, compare subito anche qui).
//   Quelli che arrivano da Google restano gestiti da google.js.
// - Tutto il resto (spese, giornata, obiettivi, sonno…) va in "dati_personali": una riga per sezione.
// - Al login: si scarica dal database. Se il database è ancora vuoto, ci si carica sopra quello
//   che c'è nel browser (così non perdi niente di quello che hai già fatto).
// - Dopo ogni modifica: si manda al database solo quello che è cambiato (dopo 1,5 secondi di calma).

// nome nell'app → "chiave" nella tabella dati_personali (le stesse di tabelle-nuove.md)
const CHIAVI_DATABASE = {
  materie: "materie", orario: "orario", quotidiane: "quotidiane", registro: "registro",
  modelliExtra: "modelli_extra", promemoria: "promemoria", movimenti: "movimenti", budget: "budget",
  scontrini: "scontrini", listaSpesa: "lista_spesa", acqua: "acqua", pasti: "pasti",
  regoleMail: "regole_mail", microModelli: "micro_modelli", routineBase: "routine_base",
  giornate: "giornate", obiettivi: "obiettivi_settimana", sonno: "sonno",
  categorieObiettivi: "categorie_obiettivi", obiettiviLungo: "obiettivi_lungo",
};

const Database = { attivo: false, firme: {}, timer: null, errore: "", canale: null };

const firma = (v) => JSON.stringify(v);
const eUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));

// ---------- Eventi: app ↔ tabella "eventi" ----------
function eventoVersoDatabase(e) {
  return {
    ...(eUuid(e.db_id) ? { id: e.db_id } : {}),
    titolo: e.titolo,
    descrizione: e.descrizione || "",
    tipo: e.tipo,
    inizio: e.inizio,
    fine: e.fine,
    tutto_il_giorno: !!e.tutto_il_giorno,
    gruppo_id: eUuid(e.gruppo_id) ? e.gruppo_id : null,   // i gruppi finti ("g-classe") non esistono nel database
    completato: !!e.completato,
    luogo: e.luogo || "",
    colore: e.colore_scelto || null,
    google_id: e.google_id || null,
    google_calendario: e.google_cal || null,
  };
}

function eventoDalDatabase(r, esistente) {
  return {
    ...(esistente || {}),
    id: esistente ? esistente.id : `db-${r.id}`,
    db_id: r.id,
    titolo: r.titolo, descrizione: r.descrizione || "", tipo: r.tipo,
    inizio: r.inizio, fine: r.fine, tutto_il_giorno: r.tutto_il_giorno,
    proprietario_id: r.proprietario_id, gruppo_id: r.gruppo_id, completato: r.completato,
    creato_il: r.creato_il, luogo: r.luogo || "", colore_scelto: r.colore || null,
    google_id: r.google_id || (esistente && esistente.google_id) || undefined,
    google_cal: r.google_calendario || (esistente && esistente.google_cal) || undefined,
  };
}

// Gli eventi "nostri" (non quelli arrivati da Google e non quelli finti di esempio)
const eventoDaSalvare = (e) => !String(e.id).startsWith("g-") && !/^e\d+$/.test(String(e.id));

async function scaricaEventi() {
  const { data, error } = await sb.from("eventi").select("*").order("inizio");
  if (error) throw error;
  for (const r of data) {
    const esistente = stato.eventi.find((e) => e.db_id === r.id);
    if (esistente) Object.assign(esistente, eventoDalDatabase(r, esistente));
    else stato.eventi.push(eventoDalDatabase(r));
  }
  // eventi che erano nel database ma ora non ci sono più (eliminati da un altro dispositivo)
  const ids = new Set(data.map((r) => r.id));
  stato.eventi = stato.eventi.filter((e) => !e.db_id || ids.has(e.db_id));
}

async function salvaEventoNelDatabase(evento) {
  if (!Database.attivo || !eventoDaSalvare(evento)) return;
  if (evento.proprietario_id && evento.proprietario_id !== utenteAttuale.id && evento.db_id) return; // eventi di altri: non si toccano
  const riga = eventoVersoDatabase(evento);
  const { data, error } = evento.db_id
    ? await sb.from("eventi").update(riga).eq("id", evento.db_id).select().single()
    : await sb.from("eventi").insert(riga).select().single();
  if (error) { Database.errore = error.message; console.warn("Evento non salvato nel database:", error.message); return; }
  const e = stato.eventi.find((x) => x.id === evento.id);
  if (e) { e.db_id = data.id; e.proprietario_id = data.proprietario_id; salva(); }
}

async function eliminaEventoDalDatabase(evento) {
  if (!Database.attivo || !evento.db_id) return;
  const { error } = await sb.from("eventi").delete().eq("id", evento.db_id);
  if (error) console.warn("Evento non eliminato dal database:", error.message);
}

// Tempo reale: le modifiche fatte da un altro dispositivo (o da Edoardo in un gruppo) arrivano subito
function ascoltaEventi() {
  if (Database.canale) return;
  Database.canale = sb.channel("eventi-app")
    .on("postgres_changes", { event: "*", schema: "public", table: "eventi" }, (p) => {
      if (p.eventType === "DELETE") {
        stato.eventi = stato.eventi.filter((e) => e.db_id !== p.old.id);
      } else {
        const esistente = stato.eventi.find((e) => e.db_id === p.new.id);
        if (esistente) Object.assign(esistente, eventoDalDatabase(p.new, esistente));
        else stato.eventi.push(eventoDalDatabase(p.new));
      }
      salva();
      if (typeof ridisegnaSeServe === "function") { Google.daRidisegnare = true; ridisegnaSeServe(); }
    })
    .subscribe();
}

// ---------- Tutto il resto: tabella "dati_personali" ----------
async function scaricaDatiPersonali() {
  const { data, error } = await sb.from("dati_personali").select("chiave, valore");
  if (error) throw error;
  const dalDatabase = Object.fromEntries(data.map((r) => [r.chiave, r.valore]));
  for (const [nomeApp, chiave] of Object.entries(CHIAVI_DATABASE)) {
    if (chiave in dalDatabase) stato[nomeApp] = dalDatabase[chiave];
    Database.firme[chiave] = chiave in dalDatabase ? firma(dalDatabase[chiave]) : null;
  }
  return data.length;
}

async function inviaDatiPersonali() {
  const righe = [];
  for (const [nomeApp, chiave] of Object.entries(CHIAVI_DATABASE)) {
    if (stato[nomeApp] === undefined) continue;
    const f = firma(stato[nomeApp]);
    if (f !== Database.firme[chiave]) righe.push({ utente_id: utenteAttuale.id, chiave, valore: stato[nomeApp], aggiornato_il: new Date().toISOString() });
  }
  if (!righe.length) return;
  const { error } = await sb.from("dati_personali").upsert(righe, { onConflict: "utente_id,chiave" });
  if (error) { Database.errore = error.message; console.warn("Dati non salvati nel database:", error.message); return; }
  for (const r of righe) Database.firme[r.chiave] = firma(r.valore);
  Database.errore = "";
}

// Dopo ogni modifica aspettiamo 1,5 secondi di "calma" e poi mandiamo tutto insieme
function programmaInvio() {
  if (!Database.attivo) return;
  clearTimeout(Database.timer);
  Database.timer = setTimeout(() => inviaDatiPersonali().catch((e) => console.warn(e)), 1500);
}

// ---------- Avvio (chiamato dopo il login) ----------
async function avviaDatabase() {
  // (typeof: se il browser ha ancora in memoria un config.js vecchio, non si rompe niente)
  if (typeof SUPABASE_DATI_ATTIVI === "undefined" || !SUPABASE_DATI_ATTIVI || !sb || Database.attivo) return;
  try {
    const quante = await scaricaDatiPersonali();
    await scaricaEventi();
    Database.attivo = true;
    if (quante === 0) {
      // database ancora vuoto: ci carichiamo sopra quello che c'è nel browser
      await inviaDatiPersonali();
      for (const e of stato.eventi.filter((x) => eventoDaSalvare(x) && !x.db_id)) await salvaEventoNelDatabase(e);
    }
    ascoltaEventi();
    salva();
  } catch (e) {
    Database.errore = e.message;
    console.warn("Database non disponibile, continuo con i dati del browser:", e.message);
  }
}
