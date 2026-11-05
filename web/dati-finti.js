// DATI FINTI — servono solo finché il database Supabase non è pronto.
// I nomi dei campi sono gli stessi delle tabelle del database (vedi CLAUDE.md).
// Quando colleghiamo Supabase, questo file si cancella.

const profiliFinti = [
  { id: "u-luca", nome: "Luca", foto: null },
  { id: "u-edoardo", nome: "Edoardo", foto: null },
];

const gruppiFinti = [
  { id: "g-classe", nome: "Classe 4B" },
];

const eventiFinti = [
  { id: 1, titolo: "Verifica di matematica", data: "2026-11-10", ora: "09:00", tipo: "scuola", proprietario: "u-luca", gruppo: "g-classe" },
  { id: 2, titolo: "Allenamento calcio", data: "2026-11-10", ora: "17:30", tipo: "allenamento", proprietario: "u-luca", gruppo: null },
  { id: 3, titolo: "Dentista", data: "2026-11-11", ora: "15:00", tipo: "altro", proprietario: "u-luca", gruppo: null },
  { id: 4, titolo: "Interrogazione di storia", data: "2026-11-12", ora: "10:00", tipo: "scuola", proprietario: "u-edoardo", gruppo: "g-classe" },
];

const messaggiFinti = [
  { id: 1, mittente: "u-edoardo", destinatario: "u-luca", testo: "Hai finito la pagina?", ora: "2026-11-05T17:02:00" },
  { id: 2, mittente: "u-luca", destinatario: "u-edoardo", testo: "Quasi! Tu il database?", ora: "2026-11-05T17:03:00" },
];
