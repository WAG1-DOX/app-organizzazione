// Prova di funzionamento: mostra gli eventi finti in una lista, in ordine di data.
// Da qui in poi è tutto tuo, Luca: cambialo come vuoi.

const lista = document.getElementById("lista-eventi");

const eventiOrdinati = [...eventiFinti].sort((a, b) => a.inizio.localeCompare(b.inizio));

for (const evento of eventiOrdinati) {
  const inizio = new Date(evento.inizio);
  const giorno = inizio.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
  const ora = evento.tutto_il_giorno
    ? "tutto il giorno"
    : inizio.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const riga = document.createElement("li");
  riga.textContent = `${giorno} ${ora} — ${evento.titolo} (${evento.tipo})`;
  lista.appendChild(riga);
}
