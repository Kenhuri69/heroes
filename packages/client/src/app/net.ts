import type { Command } from '@heroes/engine';

/**
 * SDK client du backend Heroes (doc 15, Live 7.3) — parle au Worker Cloudflare
 * (7.2). ENTIÈREMENT conditionné par `VITE_BACKEND_URL` : sans cette variable
 * (build hors-ligne, smoke), le SDK est INERTE et aucune UI en ligne n'apparaît.
 * Le jeu reste 100 % hors-ligne par défaut ; le réseau n'entre jamais dans le smoke.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const SESSION_KEY = 'heroes.session';

/** Le backend est-il configuré ? (flag de build). */
export function isOnline(): boolean {
  return typeof BACKEND_URL === 'string' && BACKEND_URL.length > 0;
}

function session(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** Une session (magic-link vérifié) est-elle active ? */
export function isLoggedIn(): boolean {
  return !!session();
}

/** Termine la session (déconnexion). */
export function logout(): void {
  // NET-SEC.1 : révoque la session CÔTÉ SERVEUR (best-effort) avant de purger
  // l'état local — `api` capture le bearer de façon synchrone à l'appel, donc le
  // retrait local qui suit n'affecte pas la requête. Un échec réseau ne bloque
  // pas la déconnexion locale.
  if (BACKEND_URL && session()) {
    void api('/session', { method: 'DELETE' }).catch(() => {
      /* révocation best-effort : la session expirera de toute façon */
    });
  }
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible */
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BACKEND_URL) throw new Error('backend hors-ligne (VITE_BACKEND_URL absente)');
  const s = session();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(s ? { Authorization: `Bearer ${s}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
  return body as T;
}

// — Auth magic-link —

/** Demande un lien magic-link. `verifyLink` est renvoyé tant que l'e-mail n'est pas branché. */
export function requestMagicLink(email: string): Promise<{ ok: true; verifyLink: string }> {
  return api('/auth/request', { method: 'POST', body: JSON.stringify({ email }) });
}

/** Vérifie un token magic-link et ouvre la session (bearer persisté). */
export async function verifyMagicLink(token: string): Promise<void> {
  const r = await api<{ session: string }>(`/auth/verify?token=${encodeURIComponent(token)}`, { method: 'GET' });
  try {
    localStorage.setItem(SESSION_KEY, r.session);
  } catch {
    /* stockage indisponible : session non persistée */
  }
}

// — Cloud saves —

/**
 * Envoie une sauvegarde cloud. Le serveur applique une **garde anti-downgrade**
 * (NET-SRVGUARD) : un `saveVersion` antérieur à la version déjà stockée pour ce
 * slot est rejeté (**409**) — `api` lève alors, l'appelant doit gérer l'échec.
 * Un **409** est aussi levé si le quota de slots est atteint (NET-SEC.2, slot
 * nouveau) ; un **413** si l'état sérialisé dépasse la borne de taille serveur.
 */
export function putSave(slot: string, state: string, saveVersion: number): Promise<{ ok: true }> {
  return api(`/saves/${slot}`, { method: 'PUT', body: JSON.stringify({ state, save_version: saveVersion }) });
}
export function getSave(slot: string): Promise<{ save_version: number; state: string; updated_at: number }> {
  return api(`/saves/${slot}`, { method: 'GET' });
}
/**
 * Liste les slots de sauvegarde cloud du profil (NET-CLOUDSAVES.2) : slot +
 * version de forme + horodatage, sans le blob d'état (requête légère pour l'UI).
 */
export function listSaves(): Promise<{ saves: { slot: string; save_version: number; updated_at: number }[] }> {
  return api('/saves', { method: 'GET' });
}

// — Parties asynchrones —

export interface MatchSummary {
  id: string;
  status: string;
  created_at: number;
}
export function listMatches(): Promise<{ matches: MatchSummary[] }> {
  return api('/matches', { method: 'GET' });
}
export function createMatch(seed: number, setup: Command): Promise<{ id: string }> {
  return api('/matches', { method: 'POST', body: JSON.stringify({ seed, setup }) });
}
/** Siège d'une partie async : ordre de tour + occupation (NET-MATCHDETAIL). */
export interface MatchSeat {
  seat: number;
  player_id: string;
  profile_id: string | null;
}
/**
 * Détail d'une partie (doc 15 §5.3) — de quoi RECONSTRUIRE l'état côté client :
 * `seed`/`setup` (base à rejouer) + `seq` (dernier coup connu) + sièges. `setup`
 * est le `StartGame` (Command) sérialisé du créateur. `status` peut valoir
 * `abandoned` (NET-LIFECYCLE : forfait volontaire ou expiration d'inactivité) —
 * dans une partie à 2, l'adversaire non-forfaiteur en déduit sa victoire.
 */
export interface MatchDetail {
  id: string;
  seed: number;
  setup: Command;
  status: string;
  createdAt: number;
  players: MatchSeat[];
  seq: number;
}
export function getMatch(id: string): Promise<MatchDetail> {
  return api(`/matches/${id}`, { method: 'GET' });
}
export function joinMatch(id: string): Promise<{ ok: true; seat: number }> {
  return api(`/matches/${id}/join`, { method: 'POST' });
}
/** Abandon volontaire (NET-LIFECYCLE) : la partie passe `abandoned`. */
export function forfeitMatch(id: string): Promise<{ ok: true }> {
  return api(`/matches/${id}/forfeit`, { method: 'POST' });
}
export function getMoves(id: string, since = -1): Promise<{ moves: { seq: number; commands: Command[] }[] }> {
  return api(`/matches/${id}/moves?since=${since}`, { method: 'GET' });
}
export function postMove(id: string, seq: number, commands: Command[]): Promise<{ ok: true; seq: number }> {
  return api(`/matches/${id}/moves`, { method: 'POST', body: JSON.stringify({ seq, commands }) });
}
