// Prova di funzionamento: mostra gli eventi finti in una lista.
// Da qui in poi è tutto tuo, Luca: cambialo come vuoi.

const lista = document.getElementById("lista-eventi");

for (const evento of eventiFinti) {
  const riga = document.createElement("li");
  riga.textContent = `${evento.data} ${evento.ora} — ${evento.titolo} (${evento.tipo})`;
  lista.appendChild(riga);
}
