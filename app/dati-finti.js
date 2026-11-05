// DATI FINTI — servono solo finché il database Supabase non è pronto.
// I nomi dei campi sono gli stessi delle tabelle del database (vedi CLAUDE.md).
// Quando colleghiamo Supabase, questo file si cancella.

const profiliFinti = [
  { id: "u-luca", nome: "Luca", avatar_url: null, creato_il: "2026-11-05T17:00:00+01:00" },
  { id: "u-edoardo", nome: "Edoardo", avatar_url: null, creato_il: "2026-11-05T17:00:00+01:00" },
];

const gruppiFinti = [
  { id: "g-classe", nome: "Classe 4B", creato_da: "u-edoardo", creato_il: "2026-11-05T17:00:00+01:00" },
];

const membriGruppoFinti = [
  { gruppo_id: "g-classe", utente_id: "u-edoardo", ruolo: "admin" },
  { gruppo_id: "g-classe", utente_id: "u-luca", ruolo: "membro" },
];

const eventiFinti = [
  {
    id: "e1", titolo: "Verifica di matematica", descrizione: "Capitoli 4 e 5", tipo: "scuola",
    inizio: "2026-11-12T08:00:00+01:00", fine: "2026-11-12T09:00:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-edoardo", gruppo_id: "g-classe", completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e2", titolo: "Allenamento calcio", descrizione: "", tipo: "allenamento",
    inizio: "2026-11-10T17:30:00+01:00", fine: "2026-11-10T19:00:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-luca", gruppo_id: null, completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e3", titolo: "Dentista", descrizione: "Portare la tessera sanitaria", tipo: "impegno",
    inizio: "2026-11-11T15:00:00+01:00", fine: "2026-11-11T16:00:00+01:00", tutto_il_giorno: false,
    proprietario_id: "u-luca", gruppo_id: null, completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
  {
    id: "e4", titolo: "Gita a Firenze", descrizione: "", tipo: "scuola",
    inizio: "2026-11-14T00:00:00+01:00", fine: "2026-11-14T23:59:00+01:00", tutto_il_giorno: true,
    proprietario_id: "u-edoardo", gruppo_id: "g-classe", completato: false, creato_il: "2026-11-05T17:00:00+01:00",
  },
];

const messaggiFinti = [
  { id: "m1", mittente_id: "u-edoardo", destinatario_id: "u-luca", testo: "Hai finito la pagina?", evento_id: null, letto: true, creato_il: "2026-11-05T17:02:00+01:00" },
  { id: "m2", mittente_id: "u-luca", destinatario_id: "u-edoardo", testo: "Quasi! Ti ricordi la verifica?", evento_id: "e1", letto: false, creato_il: "2026-11-05T17:03:00+01:00" },
];
