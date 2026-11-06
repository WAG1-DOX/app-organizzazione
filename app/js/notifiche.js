// ===== notifiche.js: avvisi sul Mac mentre l'app è aperta (INNESTO PRONTO MA SPENTO) =====
//
// Si accende con NOTIFICHE_ATTIVE = true in config.js. Il browser chiede il permesso la prima volta.
// Funziona finché la scheda dell'app è aperta in Chrome (anche se stai usando un'altra finestra).
// Per le notifiche sul telefono ad app chiusa servirà Supabase (vedi REVISIONE.md).
//
// Cosa avvisa (gli anticipi si cambiano qui sotto):
const ANTICIPI_NOTIFICHE = {
  eventi: 10,        // minuti prima di lezioni ed eventi
  micro: 0,          // all'inizio di ogni micro-evento della Giornata (es. integratori)
  dormire: 30,       // minuti prima dell'ora di andare a letto
  promemoria: "09:00", // a quest'ora, i promemoria che scadono oggi
};

const NotificheGia = new Set(); // per non mandare due volte la stessa
let timerNotifiche = null;

function manda(chiave, titolo, testo) {
  if (NotificheGia.has(chiave)) return;
  NotificheGia.add(chiave);
  try {
    const n = new Notification(titolo, { body: testo, tag: chiave, silent: false });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) { /* alcuni browser non le supportano */ }
}

function controllaNotifiche() {
  const adesso = new Date();
  const min = adesso.getHours() * 60 + adesso.getMinutes();
  const k = chiaveGiorno(adesso);

  // lezioni ed eventi del calendario
  const tra = (d) => Math.round((d - adesso) / 60000);
  for (const e of eventiDelGiorno(adesso)) {
    if (e.tutto_il_giorno) continue;
    const mancano = tra(new Date(e.inizio));
    if (mancano >= 0 && mancano <= ANTICIPI_NOTIFICHE.eventi) {
      manda(`ev-${e.id}-${e.inizio}`, mancano === 0 ? `Adesso: ${e.titolo}` : `Tra ${mancano} min: ${e.titolo}`,
        [oraDi(new Date(e.inizio)), e.luogo].filter(Boolean).join(" · "));
    }
  }
  for (const l of lezioniDelGiorno(adesso)) {
    const mancano = minutiDa(l.inizio) - min;
    if (mancano >= 0 && mancano <= ANTICIPI_NOTIFICHE.eventi) manda(`lez-${k}-${l.id}`, `Tra ${mancano} min: ${l.materia}`, [l.inizio, l.aula].filter(Boolean).join(" · "));
  }

  // micro-eventi della Giornata
  for (const m of (stato.giornate[k] || [])) {
    if (m.fatto) continue;
    const mancano = minutiDa(m.inizio) - min;
    if (mancano >= 0 && mancano <= ANTICIPI_NOTIFICHE.micro) manda(`mi-${k}-${m.id}`, `${m.inizio} · ${m.nome}`, m.note || durata(m.minuti));
  }

  // ora di andare a letto
  const dormire = minutiDa(orariSonno(adesso).dormire);
  const mancanoLetto = (dormire < minutiDa(orariSonno(adesso).sveglia) ? dormire + 24 * 60 : dormire) - min;
  if (mancanoLetto >= 0 && mancanoLetto <= ANTICIPI_NOTIFICHE.dormire) {
    manda(`letto-${k}`, `Tra ${mancanoLetto} min si va a letto 🌙`, `Ora prevista: ${orariSonno(adesso).dormire}. Prepara lo zaino e spegni gli schermi.`);
  }

  // promemoria con un'ora precisa: avviso a quell'ora
  for (const p of stato.promemoria) {
    if (p.fatto || p.scadenza !== k || !p.ora) continue;
    const mancano = minutiDa(p.ora) - min;
    if (mancano >= 0 && mancano <= 1) manda(`promo-${p.id}-${k}`, `Promemoria · ${p.ora}`, p.testo);
  }

  // promemoria che scadono oggi senza ora (una volta al giorno, all'ora scelta)
  if (min >= minutiDa(ANTICIPI_NOTIFICHE.promemoria)) {
    const oggi = stato.promemoria.filter((p) => !p.fatto && p.scadenza === k && !p.ora);
    if (oggi.length) manda(`prom-${k}`, `${oggi.length} promemoria per oggi`, oggi.map((p) => `• ${p.testo}`).join("\n"));
  }
}

async function avviaNotifiche() {
  if (typeof NOTIFICHE_ATTIVE === "undefined" || !NOTIFICHE_ATTIVE || !("Notification" in window) || timerNotifiche) return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (e) { return; }
  }
  if (Notification.permission !== "granted") return;
  controllaNotifiche();
  timerNotifiche = setInterval(controllaNotifiche, 30 * 1000);
}
