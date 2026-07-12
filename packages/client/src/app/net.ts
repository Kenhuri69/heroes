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

/** Termine la session locale (déconnexion). */
export function logout(): void {
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
 */
export function putSave(slot: string, state: string, saveVersion: number): Promise<{ ok: true }> {
  return api(`/saves/${slot}`, { method: 'PUT', body: JSON.stringify({ state, save_version: saveVersion }) });
}
export function getSave(slot: string): Promise<{ save_version: number; state: string; updated_at: number }> {
  return api(`/saves/${slot}`, { method: 'GET' });
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
 * est le `StartGame` (Command) sérialisé du créateur.
 */
export interface MatchDetail {
  id: string;
  seed: number;
  setup: Command;
  status: string;
  players: MatchSeat[];
  seq: number;
}
export function getMatch(id: string): Promise<MatchDetail> {
  return api(`/matches/${id}`, { method: 'GET' });
}
export function joinMatch(id: string): Promise<{ ok: true; seat: number }> {
  return api(`/matches/${id}/join`, { method: 'POST' });
}
export function getMoves(id: string, since = -1): Promise<{ moves: { seq: number; commands: Command[] }[] }> {
  return api(`/matches/${id}/moves?since=${since}`, { method: 'GET' });
}
export function postMove(id: string, seq: number, commands: Command[]): Promise<{ ok: true; seq: number }> {
  return api(`/matches/${id}/moves`, { method: 'POST', body: JSON.stringify({ seq, commands }) });
}
