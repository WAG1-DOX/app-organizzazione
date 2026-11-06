// =====================================================================
//  LE BANCHE — funzione "banca" (Supabase Edge Function)
//  Scritta dal Claude di Luca. La pubblica Edoardo (come "assistente").
//
//  Parla con Enable Banking (https://api.enablebanking.com) al posto dell'app,
//  perché per farlo serve la chiave privata di ognuno, che NON deve stare nell'app.
//
//  Cosa sa fare (l'app manda { azione: "...", ... }):
//  - stato          → hai già la chiave? quali banche hai collegato?
//  - salva_chiave   → salva (cifrate) la tua Application ID e chiave privata .pem
//  - elimina_chiave → toglie chiave e collegamenti
//  - banche         → elenco delle banche di un paese
//  - collega        → inizia il collegamento: restituisce il link del sito della banca
//  - completa       → al ritorno dalla banca (code + state) salva il collegamento
//  - movimenti      → legge i movimenti nuovi di tutte le tue banche
//  - scollega       → chiude un collegamento
//
//  Segreto da mettere in Supabase (Edge Functions → Secrets):
//  - BANCA_SEGRETO: una frase lunga e casuale. Serve a cifrare le chiavi private.
//    Se la cambi, le chiavi salvate non si leggono più (vanno ricaricate dall'app).
//  Facoltativo:
//  - BANCA_RITORNO: indirizzo dove la banca riporta (default https://xecute-app.vercel.app/).
//    Deve essere uguale a quello scritto nell'applicazione su Enable Banking.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://api.enablebanking.com";
const RITORNO = Deno.env.get("BANCA_RITORNO") ?? "https://xecute-app.vercel.app/";
const MAX_GIORNI_CONSENSO = 180;
const GIORNI_PRIMA_LETTURA = 90;   // la prima volta leggiamo gli ultimi 90 giorni
const MAX_PAGINE = 30;             // per non girare all'infinito

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

// ---------- Chiavi di Supabase (come in "assistente") ----------
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

// ---------- Utilità ----------
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const daB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const testoB64url = (s: string) => b64url(new TextEncoder().encode(s));
async function sha256(testo: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Cifrare le chiavi private (AES-GCM con BANCA_SEGRETO) ----------
async function chiaveAes(): Promise<CryptoKey> {
  const segreto = Deno.env.get("BANCA_SEGRETO") ?? "";
  if (segreto.length < 20) throw new ErroreUtente("Manca il segreto BANCA_SEGRETO su Supabase (chiedi a Edoardo).", 500);
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

// ---------- Chiave privata .pem → firma del "biglietto" (JWT) per Enable Banking ----------
// Accetta sia "BEGIN PRIVATE KEY" (PKCS8) sia "BEGIN RSA PRIVATE KEY" (PKCS1, la convertiamo).
function lunghezzaDer(n: number): number[] {
  if (n < 0x80) return [n];
  const byte: number[] = [];
  while (n > 0) { byte.unshift(n & 0xff); n >>= 8; }
  return [0x80 | byte.length, ...byte];
}
function pkcs1VersoPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algoritmo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const ottetti = [0x04, ...lunghezzaDer(pkcs1.length), ...pkcs1];
  const corpo = [0x02, 0x01, 0x00, ...algoritmo, ...ottetti];
  return new Uint8Array([0x30, ...lunghezzaDer(corpo.length), ...corpo]);
}
async function importaChiave(pem: string): Promise<CryptoKey> {
  const pkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const base = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  let der = daB64(base);
  if (pkcs1) der = pkcs1VersoPkcs8(der);
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
async function creaJwt(applicationId: string, pem: string): Promise<string> {
  const adesso = Math.floor(Date.now() / 1000);
  const testa = testoB64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: applicationId }));
  const dati = testoB64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: adesso, exp: adesso + 3600 }));
  const firma = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importaChiave(pem), new TextEncoder().encode(`${testa}.${dati}`)));
  return `${testa}.${dati}.${b64url(firma)}`;
}

// ---------- Chiamare Enable Banking ----------
async function chiamaEB(jwt: string, metodo: string, percorso: string, corpo?: unknown, psu?: Record<string, string>) {
  const r = await fetch(`${API}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...(psu ?? {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const testo = await r.text();
  let dati: any = null;
  try { dati = testo ? JSON.parse(testo) : null; } catch { dati = { testo }; }
  if (!r.ok) {
    const msg = dati?.message || dati?.error || dati?.detail || `errore ${r.status}`;
    const err = new ErroreUtente(`Enable Banking: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`, 502);
    (err as any).codice = r.status;
    (err as any).dettaglio = dati;
    throw err;
  }
  return dati;
}

// Le "intestazioni PSU": dicono alla banca che sei tu, adesso, a chiedere
// (così non contano nel limite di letture automatiche al giorno)
function intestazioniPsu(req: Request): Record<string, string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const h: Record<string, string> = {};
  if (ip) h["Psu-Ip-Address"] = ip;
  const ua = req.headers.get("user-agent");
  if (ua) h["Psu-User-Agent"] = ua.slice(0, 300);
  return h;
}

// ---------- Movimento di Enable Banking → movimento dell'app ----------
function nomeControparte(t: any): string {
  const dbit = t.credit_debit_indicator === "DBIT";
  return ((dbit ? t.creditor?.name : t.debtor?.name) ?? "").trim();
}
async function convertiMovimento(t: any, conto: any, ibanMiei: Set<string>) {
  const importo = Math.abs(Number(t.transaction_amount?.amount ?? 0));
  const data = t.booking_date || t.value_date || t.transaction_date || "";
  const remittance = Array.isArray(t.remittance_information) ? t.remittance_information.join(" ").trim() : String(t.remittance_information ?? "").trim();
  const controparte = nomeControparte(t);
  const ibanAltro = (t.credit_debit_indicator === "DBIT" ? t.creditor_account?.iban : t.debtor_account?.iban) ?? "";
  const riferimento = t.entry_reference || t.transaction_id || `${data}|${importo}|${remittance}|${controparte}`;
  return {
    id: `eb-${(await sha256(`${conto.uid}|${riferimento}`)).slice(0, 24)}`,
    tipo: t.credit_debit_indicator === "CRDT" ? "entrata" : "uscita",
    importo: Math.round(importo * 100) / 100,
    valuta: t.transaction_amount?.currency ?? "EUR",
    data: String(data).slice(0, 10),
    descrizione: (controparte || remittance || t.bank_transaction_code?.description || "Movimento bancario").slice(0, 80),
    dettagli: remittance.slice(0, 200),
    mcc: t.merchant_category_code ?? null,
    conto: conto.nome,
    // giroconto = soldi spostati tra due tuoi conti collegati: non è né una spesa né un'entrata vera
    giroconto: !!ibanAltro && ibanMiei.has(String(ibanAltro).replace(/\s/g, "").toUpperCase()),
  };
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

  // la chiave di servizio serve per le tabelle che l'app non può toccare (chiavi, attese)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chiaveDiServizio());

  let corpo: any = {};
  try { corpo = await req.json(); } catch { return risposta({ errore: "Richiesta non valida." }, 400); }
  const azione = String(corpo?.azione ?? "");

  // la chiave di questo utente, già pronta per firmare
  const miaChiave = async () => {
    const { data } = await admin.from("banca_chiavi").select("application_id, chiave_cifrata").eq("utente_id", user.id).maybeSingle();
    if (!data) throw new ErroreUtente("Prima configura Enable Banking (Application ID e chiave).");
    const pem = await decifra(data.chiave_cifrata);
    return { applicationId: data.application_id as string, jwt: await creaJwt(data.application_id, pem) };
  };

  try {
    switch (azione) {
      // ---------------------------------------------------------------
      case "stato": {
        const { data: chiave } = await admin.from("banca_chiavi").select("application_id").eq("utente_id", user.id).maybeSingle();
        const { data: collegamenti } = await admin.from("banca_collegamenti")
          .select("id, banca, paese, conti, valido_fino, ultimo_aggiornamento, creato_il").eq("utente_id", user.id).order("creato_il");
        return risposta({
          chiave: !!chiave,
          application_id: chiave?.application_id ?? null,
          collegamenti: (collegamenti ?? []).map((c) => ({
            ...c, conti: (c.conti ?? []).map((x: any) => ({ nome: x.nome, iban_finale: x.iban ? String(x.iban).slice(-4) : "", valuta: x.valuta })),
          })),
        });
      }

      // ---------------------------------------------------------------
      case "salva_chiave": {
        const applicationId = String(corpo.application_id ?? "").trim();
        const pem = String(corpo.chiave_pem ?? "").trim();
        if (!/^[0-9a-f-]{36}$/i.test(applicationId)) throw new ErroreUtente("L'Application ID non sembra giusto (es. 16834810-0401-…).");
        if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(pem) || pem.length > 10000) throw new ErroreUtente("Il file non sembra una chiave privata .pem.");
        // proviamo subito: firma + una chiamata a Enable Banking
        let jwt = "";
        try { jwt = await creaJwt(applicationId, pem); } catch { throw new ErroreUtente("Non riesco a leggere la chiave: è il file .pem giusto?"); }
        await chiamaEB(jwt, "GET", "/aspsps?country=IT&psu_type=personal&service=AIS");
        const { error } = await admin.from("banca_chiavi").upsert({
          utente_id: user.id, application_id: applicationId, chiave_cifrata: await cifra(pem), aggiornato_il: new Date().toISOString(),
        });
        if (error) throw new ErroreUtente("Non riesco a salvare la chiave.", 500);
        return risposta({ ok: true });
      }

      // ---------------------------------------------------------------
      case "elimina_chiave": {
        const { data: coll } = await admin.from("banca_collegamenti").select("session_id").eq("utente_id", user.id);
        try {
          const { jwt } = await miaChiave();
          for (const c of coll ?? []) { try { await chiamaEB(jwt, "DELETE", `/sessions/${c.session_id}`); } catch { /* già chiusa */ } }
        } catch { /* niente chiave */ }
        await admin.from("banca_collegamenti").delete().eq("utente_id", user.id);
        await admin.from("banca_chiavi").delete().eq("utente_id", user.id);
        return risposta({ ok: true });
      }

      // ---------------------------------------------------------------
      case "banche": {
        const paese = String(corpo.paese ?? "IT").toUpperCase().slice(0, 2);
        const { jwt } = await miaChiave();
        const dati = await chiamaEB(jwt, "GET", `/aspsps?country=${paese}&psu_type=personal&service=AIS`);
        const banche = (dati?.aspsps ?? []).map((a: any) => ({ nome: a.name, paese: a.country, logo: a.logo ?? null, beta: !!a.beta }))
          .sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        return risposta({ banche });
      }

      // ---------------------------------------------------------------
      case "collega": {
        const banca = String(corpo.banca ?? "").trim();
        const paese = String(corpo.paese ?? "").toUpperCase().slice(0, 2);
        if (!banca || !paese) throw new ErroreUtente("Scegli paese e banca.");
        const { jwt } = await miaChiave();
        // quanto può durare al massimo il permesso per questa banca
        const elenco = await chiamaEB(jwt, "GET", `/aspsps?country=${paese}&psu_type=personal&service=AIS`);
        const info = (elenco?.aspsps ?? []).find((a: any) => a.name === banca);
        if (!info) throw new ErroreUtente("Banca non trovata in questo paese.");
        const maxSecondi = Math.min(Number(info.maximum_consent_validity ?? 0) || 90 * 86400, MAX_GIORNI_CONSENSO * 86400);
        const validoFino = new Date(Date.now() + (maxSecondi - 3600) * 1000).toISOString();
        const state = crypto.randomUUID();
        await admin.from("banca_attese").delete().lt("creato_il", new Date(Date.now() - 86400000).toISOString()); // pulizia
        await admin.from("banca_attese").insert({ state, utente_id: user.id, banca, paese });
        const auth = await chiamaEB(jwt, "POST", "/auth", {
          access: { valid_until: validoFino },
          aspsp: { name: banca, country: paese },
          state, redirect_url: RITORNO, psu_type: "personal", language: "it",
        }, intestazioniPsu(req));
        return risposta({ url: auth.url });
      }

      // ---------------------------------------------------------------
      case "completa": {
        const state = String(corpo.state ?? "");
        const code = String(corpo.code ?? "");
        const { data: attesa } = await admin.from("banca_attese").select("*").eq("state", state).eq("utente_id", user.id).maybeSingle();
        if (!attesa) throw new ErroreUtente("Collegamento non riconosciuto (forse è già stato completato).");
        await admin.from("banca_attese").delete().eq("state", state);
        const { jwt } = await miaChiave();
        const sessione = await chiamaEB(jwt, "POST", "/sessions", { code }, intestazioniPsu(req));
        const conti = (sessione.accounts ?? []).map((a: any) => ({
          uid: a.uid,
          nome: a.name || a.product || a.details || attesa.banca,
          iban: a.account_id?.iban ?? null,
          valuta: a.currency ?? "EUR",
        }));
        const { data: nuovo, error } = await admin.from("banca_collegamenti").insert({
          utente_id: user.id, session_id: sessione.session_id, banca: attesa.banca, paese: attesa.paese,
          conti, valido_fino: sessione.access?.valid_until ?? null,
        }).select("id").single();
        if (error) throw new ErroreUtente("Non riesco a salvare il collegamento.", 500);
        return risposta({ ok: true, id: nuovo.id, banca: attesa.banca, conti: conti.length });
      }

      // ---------------------------------------------------------------
      case "movimenti": {
        const { jwt } = await miaChiave();
        const { data: collegamenti } = await admin.from("banca_collegamenti").select("*").eq("utente_id", user.id);
        const ibanMiei = new Set<string>();
        for (const c of collegamenti ?? []) for (const x of c.conti ?? []) if (x.iban) ibanMiei.add(String(x.iban).replace(/\s/g, "").toUpperCase());

        const movimenti: any[] = [];
        const avvisi: string[] = [];
        const psu = intestazioniPsu(req);
        for (const c of collegamenti ?? []) {
          if (c.valido_fino && new Date(c.valido_fino) < new Date()) { avvisi.push(`${c.banca}: il permesso è scaduto, ricollega la banca.`); continue; }
          // dalla lettura precedente (con 5 giorni di margine) oppure gli ultimi 90 giorni
          const da = c.ultimo_aggiornamento
            ? new Date(new Date(c.ultimo_aggiornamento).getTime() - 5 * 86400000)
            : new Date(Date.now() - GIORNI_PRIMA_LETTURA * 86400000);
          const dateFrom = da.toISOString().slice(0, 10);
          let tuttoBene = true;
          for (const conto of c.conti ?? []) {
            try {
              let chiave: string | null = null;
              for (let pagina = 0; pagina < MAX_PAGINE; pagina++) {
                const q = new URLSearchParams({ date_from: dateFrom });
                if (chiave) q.set("continuation_key", chiave);
                const dati = await chiamaEB(jwt, "GET", `/accounts/${conto.uid}/transactions?${q}`, undefined, psu);
                for (const t of dati?.transactions ?? []) {
                  if (t.status && t.status !== "BOOK") continue; // solo quelli contabilizzati (i "in attesa" cambiano)
                  movimenti.push(await convertiMovimento(t, conto, ibanMiei));
                }
                chiave = dati?.continuation_key ?? null;
                if (!chiave) break;
              }
            } catch (e) {
              tuttoBene = false;
              avvisi.push(`${c.banca} (${conto.nome}): ${(e as Error).message}`);
            }
          }
          if (tuttoBene) await admin.from("banca_collegamenti").update({ ultimo_aggiornamento: new Date().toISOString() }).eq("id", c.id);
        }
        return risposta({ movimenti, avvisi });
      }

      // ---------------------------------------------------------------
      case "scollega": {
        const id = String(corpo.id ?? "");
        const { data: c } = await admin.from("banca_collegamenti").select("session_id").eq("id", id).eq("utente_id", user.id).maybeSingle();
        if (!c) throw new ErroreUtente("Collegamento non trovato.");
        try { const { jwt } = await miaChiave(); await chiamaEB(jwt, "DELETE", `/sessions/${c.session_id}`); } catch { /* già chiusa */ }
        await admin.from("banca_collegamenti").delete().eq("id", id).eq("utente_id", user.id);
        return risposta({ ok: true });
      }

      default:
        return risposta({ errore: "Azione sconosciuta." }, 400);
    }
  } catch (e) {
    const stato = e instanceof ErroreUtente ? e.stato : 500;
    console.error("banca:", azione, (e as Error).message, (e as any).dettaglio ?? "");
    return risposta({ errore: e instanceof ErroreUtente ? e.message : "Qualcosa è andato storto, riprova." }, stato);
  }
});
