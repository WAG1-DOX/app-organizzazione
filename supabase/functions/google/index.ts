// =====================================================================
//  GOOGLE CALENDAR SEMPRE COLLEGATO — funzione "google" (Supabase Edge Function)
//  Scritta per Edoardo. Si pubblica dal pannello di Supabase (come "assistente" e "banca").
//
//  Il problema: il permesso di Google nel browser dura 1 ora, poi bisognava ripremere "Collega".
//  La soluzione: la prima volta l'app manda qui un "codice" di Google; questa funzione lo scambia
//  con un permesso a lungo termine (refresh token), lo salva CIFRATO nella tabella
//  google_collegamenti e da lì in poi, ogni volta che l'app chiede, le dà un permesso nuovo
//  da 1 ora. L'app continua a parlare con Google Calendar come prima.
//
//  Cosa sa fare (l'app manda { azione: "...", ... }):
//  - config   → il Client ID di Google e se sei già collegato
//  - collega  → { code } dalla finestra di Google: salva il permesso a lungo termine
//  - token    → un permesso nuovo da 1 ora (senza chiedere niente)
//  - scollega → toglie il permesso (anche su Google) e cancella la riga
//
//  Segreti da mettere in Supabase (Edge Functions → Secrets):
//  - GOOGLE_CLIENT_ID     → l'ID client OAuth (finisce con .apps.googleusercontent.com; non è segreto)
//  - GOOGLE_CLIENT_SECRET → il "client secret" dello stesso ID client (SEGRETO: mai nel codice)
//  - BANCA_SEGRETO        → già presente (lo usa anche "banca"): serve a cifrare i permessi
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SCOPE_NECESSARI = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function risposta(corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), { status: stato, headers: { ...cors, "Content-Type": "application/json" } });
}

class ErroreUtente extends Error {
  stato: number;
  constructor(messaggio: string, stato = 400) { super(messaggio); this.stato = stato; }
}

// ---------- Chiavi di Supabase (come in "assistente" e "banca") ----------
function chiavePubblica(): string {
  try {
    const chiavi = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const prima = chiavi.default ?? Object.values(chiavi)[0];
    if (typeof prima === "string" && prima) return prima;
  } catch { /* uso quella vecchia */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}
function chiaveDiServizio(): string {
  try {
    const chiavi = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const prima = chiavi.default ?? Object.values(chiavi)[0];
    if (typeof prima === "string" && prima) return prima;
  } catch { /* uso quella vecchia */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

// ---------- Cifrare il permesso (AES-GCM con BANCA_SEGRETO, come in "banca") ----------
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const daB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function chiaveAes(): Promise<CryptoKey> {
  const segreto = Deno.env.get("BANCA_SEGRETO") ?? "";
  if (segreto.length < 20) throw new ErroreUtente("Manca il segreto BANCA_SEGRETO su Supabase.", 500);
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segreto));
  return crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function cifra(testo: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dati = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chiaveAes(), new TextEncoder().encode(testo)));
  return `${b64(iv)}.${b64(dati)}`;
}
async function decifra(cifrato: string): Promise<string> {
  const [iv, dati] = cifrato.split(".");
  const chiaro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: daB64(iv) }, await chiaveAes(), daB64(dati));
  return new TextDecoder().decode(chiaro);
}

// ---------- Parlare con Google ----------
function clientGoogle() {
  const id = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const segreto = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  if (!id || !segreto) throw new ErroreUtente("Google non è ancora configurato su Supabase (mancano GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).", 500);
  return { id, segreto };
}

// Chiede un token a Google. Nei log NON scriviamo mai la risposta intera (contiene i permessi).
async function tokenDaGoogle(parametri: Record<string, string>) {
  const { id, segreto } = clientGoogle();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: segreto, ...parametri }),
  });
  const dati = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new ErroreUtente(dati.error === "invalid_grant"
      ? "Il permesso di Google non è più valido: ricollega Google."
      : `Google ha rifiutato (${dati.error || r.status}).`, dati.error === "invalid_grant" ? 409 : 502);
    (err as any).codiceGoogle = dati.error || String(r.status);
    throw err;
  }
  return dati as { access_token: string; expires_in: number; refresh_token?: string; scope?: string };
}

// =====================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return risposta({ errore: "Usa POST." }, 405);

  // 1. Chi sta chiedendo? (deve aver fatto il login)
  const auth = req.headers.get("Authorization");
  if (!auth) return risposta({ errore: "Devi fare il login." }, 401);
  const utente = createClient(Deno.env.get("SUPABASE_URL")!, chiavePubblica(), { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await utente.auth.getUser();
  if (!user) return risposta({ errore: "Devi fare il login." }, 401);

  // la chiave di servizio serve per la tabella che l'app non può toccare
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chiaveDiServizio());

  let corpo: any = {};
  try { corpo = await req.json(); } catch { return risposta({ errore: "Richiesta non valida." }, 400); }
  const azione = String(corpo?.azione ?? "");

  const miaRiga = async () => {
    const { data } = await admin.from("google_collegamenti").select("refresh_cifrato, email").eq("utente_id", user.id).maybeSingle();
    return data;
  };

  try {
    switch (azione) {
      // ---------------------------------------------------------------
      case "config": {
        const id = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
        const pronto = !!id && !!Deno.env.get("GOOGLE_CLIENT_SECRET");
        const riga = pronto ? await miaRiga() : null;
        return risposta({ client_id: pronto ? id : null, collegato: !!riga, email: riga?.email ?? null });
      }

      // ---------------------------------------------------------------
      case "collega": {
        const code = String(corpo.code ?? "");
        if (!code || code.length > 2000) throw new ErroreUtente("Codice di Google mancante.");
        // "postmessage" = il codice arriva dalla finestrella di Google aperta dall'app
        const t = await tokenDaGoogle({ code, grant_type: "authorization_code", redirect_uri: "postmessage" });
        const concessi = (t.scope ?? "").split(" ");
        if (!SCOPE_NECESSARI.every((s) => concessi.includes(s))) {
          throw new ErroreUtente("Nella finestra di Google devi spuntare tutti i permessi del calendario.");
        }
        // il refresh token arriva solo se nella finestra hai confermato il consenso
        let refresh = t.refresh_token ?? "";
        if (!refresh) {
          const vecchia = await miaRiga();
          if (!vecchia) throw new ErroreUtente("Google non ha dato il permesso a lungo termine: riprova e conferma tutto nella finestra.");
          refresh = await decifra(vecchia.refresh_cifrato);
        }
        // l'email dell'account = id del calendario principale
        let email: string | null = null;
        try {
          const r = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary", { headers: { Authorization: `Bearer ${t.access_token}` } });
          if (r.ok) email = (await r.json()).id ?? null;
        } catch { /* non importa */ }
        const { error } = await admin.from("google_collegamenti").upsert({
          utente_id: user.id, refresh_cifrato: await cifra(refresh), email, aggiornato_il: new Date().toISOString(),
        });
        if (error) throw new ErroreUtente("Non riesco a salvare il collegamento.", 500);
        return risposta({ access_token: t.access_token, expires_in: t.expires_in, email });
      }

      // ---------------------------------------------------------------
      case "token": {
        const riga = await miaRiga();
        if (!riga) throw new ErroreUtente("Google non è collegato.", 409);
        try {
          const t = await tokenDaGoogle({ refresh_token: await decifra(riga.refresh_cifrato), grant_type: "refresh_token" });
          return risposta({ access_token: t.access_token, expires_in: t.expires_in, email: riga.email });
        } catch (e) {
          // permesso revocato o scaduto su Google: togliamo la riga, così l'app chiede di ricollegare
          if ((e as any).codiceGoogle === "invalid_grant") await admin.from("google_collegamenti").delete().eq("utente_id", user.id);
          throw e;
        }
      }

      // ---------------------------------------------------------------
      case "scollega": {
        const riga = await miaRiga();
        if (riga) {
          try {
            const refresh = await decifra(riga.refresh_cifrato);
            await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
              method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
          } catch { /* già revocato */ }
          await admin.from("google_collegamenti").delete().eq("utente_id", user.id);
        }
        return risposta({ ok: true });
      }

      default:
        return risposta({ errore: "Azione sconosciuta." }, 400);
    }
  } catch (e) {
    const stato = e instanceof ErroreUtente ? e.stato : 500;
    // solo il tipo di errore, mai token o risposte di Google
    console.error("google:", azione, (e as any).codiceGoogle ?? (e as Error).name);
    return risposta({ errore: e instanceof ErroreUtente ? e.message : "Qualcosa è andato storto, riprova." }, stato);
  }
});
