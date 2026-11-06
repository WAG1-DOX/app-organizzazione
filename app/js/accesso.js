// ===== accesso.js: login, registrazione e uscita con Supabase =====
//
// - Registrazione: nome, email e password. Supabase manda una mail con un link
//   di conferma (l'ha attivato Edoardo). Il profilo nel database si crea da solo.
// - Accesso: email e password. La sessione resta salvata nel browser.
// - Password dimenticata: arriva una mail con un link per sceglierne una nuova.

let sb = null; // il "client" di Supabase: serve per parlare con il database
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA);
} catch (e) {
  sb = null; // libreria non caricata (es. niente internet)
}

let utenteSupabase = null;

// Mette i dati dell'account vero al posto di quelli finti
async function impostaUtente(user) {
  utenteSupabase = user;
  utenteAttuale.id = user.id;
  utenteAttuale.email = user.email;
  utenteAttuale.nome = (user.user_metadata && user.user_metadata.nome) || user.email.split("@")[0];
  try {
    const { data } = await sb.from("profili").select("nome, avatar_url").eq("id", user.id).single();
    if (data && data.nome) utenteAttuale.nome = data.nome;
    if (data) utenteAttuale.avatar_url = data.avatar_url;
  } catch (e) { /* se il profilo non si legge, teniamo il nome della registrazione */ }
  aggiornaProfiloInAlto();
}

function aggiornaProfiloInAlto() {
  document.getElementById("avatar").textContent = (utenteAttuale.nome || "?")[0].toUpperCase();
  document.getElementById("nome-profilo").textContent = utenteAttuale.nome;
  document.getElementById("email-profilo").textContent = utenteAttuale.email || "Senza account";
}

// ---------- Avvio: c'è già una sessione? ----------
async function avviaAccesso(quandoDentro) {
  if (!sb) {
    mostraAccesso("Non riesco a collegarmi a Supabase (sei connesso a internet?).", quandoDentro);
    return;
  }
  let entrato = false;
  const entra = async (user) => {
    await impostaUtente(user);
    document.body.classList.remove("fuori");
    nascondiAccesso();
    if (!entrato) { entrato = true; quandoDentro(); } else disegna();
  };

  sb.auth.onAuthStateChange((evento, sessione) => {
    if (evento === "PASSWORD_RECOVERY") { mostraNuovaPassword(); return; }
    if (evento === "SIGNED_OUT") { utenteSupabase = null; mostraAccesso(); return; }
    if (sessione && sessione.user && (evento === "SIGNED_IN" || evento === "USER_UPDATED")) {
      // fuori dalla callback, come consiglia Supabase
      setTimeout(() => entra(sessione.user), 0);
    }
  });

  const { data } = await sb.auth.getSession();
  if (data.session) await entra(data.session.user);
  else mostraAccesso(null, quandoDentro);
}

async function esci() {
  if (!confirm("Vuoi uscire dal tuo account?")) return;
  if (sb) await sb.auth.signOut();
  location.hash = "";
  location.reload();
}

// ---------- La schermata di accesso ----------
let modoAccesso = "accedi"; // "accedi" | "registrati" | "recupero"

function nascondiAccesso() {
  const s = document.getElementById("accesso");
  if (s) s.remove();
}

function mostraAccesso(errore, quandoDentro) {
  nascondiAccesso();
  document.body.classList.add("fuori");

  const messaggio = h("p", { class: "accesso-messaggio", role: "status" }, errore || "");
  const scrivi = (testo, tipo = "") => { messaggio.textContent = testo; messaggio.className = `accesso-messaggio ${tipo}`; };

  const nome = h("input", { type: "text", placeholder: "Come ti chiami?", autocomplete: "given-name", maxlength: 40 });
  const email = h("input", { type: "email", placeholder: "nome@esempio.com", autocomplete: "email", required: true });
  const password = h("input", { type: "password", placeholder: "Almeno 6 caratteri", minlength: 6, required: true,
    autocomplete: modoAccesso === "registrati" ? "new-password" : "current-password" });
  const bottone = h("button", { class: "bottone-accento largo", type: "submit" },
    modoAccesso === "accedi" ? "Accedi" : modoAccesso === "registrati" ? "Crea l'account" : "Mandami il link");

  const cambiaModo = (m) => { modoAccesso = m; mostraAccesso(null, quandoDentro); };

  const modulo = h("form", { class: "modulo", onsubmit: async (ev) => {
    ev.preventDefault();
    if (!sb) return;
    bottone.disabled = true;
    scrivi("Un attimo…");
    try {
      if (modoAccesso === "accedi") {
        const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        if (error) throw error;
        scrivi("");
      } else if (modoAccesso === "registrati") {
        if (!nome.value.trim()) { scrivi("Scrivi il tuo nome.", "errore"); bottone.disabled = false; return; }
        const { data, error } = await sb.auth.signUp({
          email: email.value.trim(), password: password.value,
          options: { data: { nome: nome.value.trim() }, emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw error;
        if (data.session) scrivi("");
        else scrivi("Fatto! Ti ho mandato una mail: apri il link di conferma, poi torna qui e accedi.", "ok");
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        scrivi("Se l'email è giusta, ti è arrivato un link per scegliere una nuova password.", "ok");
      }
    } catch (e) {
      scrivi(traduciErrore(e), "errore");
    }
    bottone.disabled = false;
  } },
    modoAccesso === "registrati" && campo("Nome", nome),
    campo("Email", email),
    modoAccesso !== "recupero" && campo("Password", password),
    bottone,
    messaggio);

  const schermata = h("div", { class: "accesso", id: "accesso" },
    h("div", { class: "accesso-box" },
      h("img", { class: "accesso-copertina", src: "img/logo-grande.jpg", alt: "XECUTE" }),
      h("h2", {}, modoAccesso === "accedi" ? "Bentornato" : modoAccesso === "registrati" ? "Crea il tuo account" : "Password dimenticata"),
      h("p", { class: "testo-leggero" }, modoAccesso === "recupero"
        ? "Scrivi la tua email: ti mandiamo un link per scegliere una nuova password."
        : "Ognuno ha il suo account: vedi solo le tue cose e quelle dei tuoi gruppi."),
      modoAccesso !== "recupero" && h("div", { class: "segmenti accesso-schede" },
        h("button", { type: "button", class: modoAccesso === "accedi" ? "attivo" : "", onclick: () => cambiaModo("accedi") }, "Accedi"),
        h("button", { type: "button", class: modoAccesso === "registrati" ? "attivo" : "", onclick: () => cambiaModo("registrati") }, "Registrati")),
      modulo,
      modoAccesso === "accedi" && h("button", { class: "link-sottile accesso-link", type: "button", onclick: () => cambiaModo("recupero") }, "Password dimenticata?"),
      modoAccesso === "recupero" && h("button", { class: "link-sottile accesso-link", type: "button", onclick: () => cambiaModo("accedi") }, "← Torna all'accesso"),
      !sb && quandoDentro && h("button", { class: "bottone-secondario largo", type: "button", onclick: () => {
        document.body.classList.remove("fuori");
        nascondiAccesso();
        quandoDentro();
      } }, "Continua senza account (dati solo su questo computer)")));

  document.body.append(schermata);
  (modoAccesso === "registrati" ? nome : email).focus();
}

// Dopo aver cliccato il link "password dimenticata" nella mail
function mostraNuovaPassword() {
  const password = h("input", { type: "password", placeholder: "Almeno 6 caratteri", minlength: 6, required: true, autocomplete: "new-password" });
  const messaggio = h("p", { class: "accesso-messaggio" });
  apriModale("Scegli una nuova password",
    h("form", { class: "modulo", onsubmit: async (ev) => {
      ev.preventDefault();
      const { error } = await sb.auth.updateUser({ password: password.value });
      if (error) { messaggio.textContent = traduciErrore(error); messaggio.className = "accesso-messaggio errore"; return; }
      chiudiModale();
    } }, campo("Nuova password", password), h("button", { class: "bottone-accento largo", type: "submit" }, "Salva"), messaggio));
}

// Gli errori di Supabase sono in inglese: li traduciamo
function traduciErrore(e) {
  const m = (e && e.message) || String(e);
  if (/invalid login credentials/i.test(m)) return "Email o password sbagliate.";
  if (/email not confirmed/i.test(m)) return "Devi ancora confermare l'email: apri il link che ti è arrivato.";
  if (/already registered|already been registered/i.test(m)) return "Esiste già un account con questa email: prova ad accedere.";
  if (/password should be at least/i.test(m)) return "La password deve avere almeno 6 caratteri.";
  if (/rate limit|too many/i.test(m)) return "Troppi tentativi: aspetta qualche minuto e riprova.";
  if (/failed to fetch|network/i.test(m)) return "Non riesco a collegarmi a Supabase: controlla internet.";
  if (/invalid email|unable to validate email/i.test(m)) return "L'email non sembra giusta.";
  return `Qualcosa è andato storto: ${m}`;
}
