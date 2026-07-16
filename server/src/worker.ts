import { appendTurn, replayCommands, type Command } from '@heroes/engine';

/**
 * Worker backend Heroes (doc 07 §5, doc 15) — API HTTP sur Cloudflare Workers +
 * D1. Le levier déterministe (doc 15 §1) rend le serveur mince : il stocke un
 * journal de commandes append-only et VALIDE chaque tour posté en le rejouant
 * (`engine/net appendTurn`) — jamais de confiance au client. Déploiement manuel
 * (`wrangler deploy`) ; hors build client, hors smoke.
 */

// — Types D1 minimaux (déclarés localement : pas de dépendance @cloudflare/*). —
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Env {
  DB: D1Database;
  APP_ORIGIN?: string;
}

const HOUR = 3_600_000;
const now = (): number => Date.now();
const token = (): string => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

// NET-SEC.2 (doc 15 §2/§8) — durcissement : bornage de body, quota de slots.
const MAX_BODY_BYTES = 256 * 1024; // petits corps (auth, matches, moves)
const MAX_SAVE_BYTES = 4 * 1024 * 1024; // état de jeu sérialisé (grandes cartes 256²)
const MAX_SAVE_SLOTS = 20; // slots de sauvegarde cloud par profil

/** Erreur HTTP typée : le `try` externe la traduit en réponse (sinon 500). */
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Lit et parse un corps JSON borné en taille (413 si trop gros, 400 si invalide). */
async function body<T>(request: Request, max = MAX_BODY_BYTES): Promise<T> {
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, 'corps de requête trop volumineux');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'JSON invalide');
  }
}

function cors(origin: string | undefined): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  };
}
function json(body: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env?.APP_ORIGIN) },
  });
}
const fail = (status: number, reason: string, env?: Env): Response => json({ error: reason }, status, env);

/** Profil authentifié depuis le bearer de session (ou null). */
async function authProfile(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!bearer) return null;
  const row = await env.DB.prepare('SELECT profile_id, expires_at FROM sessions WHERE id = ?')
    .bind(bearer)
    .first<{ profile_id: string; expires_at: number }>();
  if (!row || row.expires_at < now()) return null;
  return row.profile_id;
}

// NET-LIFECYCLE : une partie `active` sans activité depuis ce délai est
// considérée abandonnée (expiration paresseuse — pas de cron Worker configuré).
const TURN_TIMEOUT_MS = 14 * 24 * HOUR;

/**
 * Statut EFFECTIF d'une partie (NET-LIFECYCLE) : `active` inactive depuis
 * `TURN_TIMEOUT_MS` ⇒ `abandoned`, persisté paresseusement. Dernière activité =
 * dernier coup posté, sinon la création de la partie. Idempotent.
 */
async function effectiveStatus(env: Env, matchId: string, status: string, createdAt: number): Promise<string> {
  if (status !== 'active') return status;
  const last = await env.DB.prepare('SELECT MAX(created_at) AS t FROM moves WHERE match_id = ?')
    .bind(matchId)
    .first<{ t: number | null }>();
  const idleSince = last?.t ?? createdAt;
  if (now() - idleSince < TURN_TIMEOUT_MS) return status;
  await env.DB.prepare("UPDATE matches SET status = 'abandoned' WHERE id = ? AND status = 'active'")
    .bind(matchId)
    .run();
  return 'abandoned';
}

/** Reconstitue le journal de base d'une partie : StartGame + tous les lots postés. */
async function baseLog(env: Env, matchId: string): Promise<{ setup: Command; commands: Command[] } | null> {
  const match = await env.DB.prepare('SELECT setup FROM matches WHERE id = ?')
    .bind(matchId)
    .first<{ setup: string }>();
  if (!match) return null;
  const moves = await env.DB.prepare('SELECT commands FROM moves WHERE match_id = ? ORDER BY seq')
    .bind(matchId)
    .all<{ commands: string }>();
  const setup = JSON.parse(match.setup) as Command;
  const commands = moves.results.flatMap((m) => JSON.parse(m.commands) as Command[]);
  return { setup, commands };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env.APP_ORIGIN) });
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      // — Auth magic-link —
      if (path === '/auth/request' && request.method === 'POST') {
        const { email } = await body<{ email?: string }>(request);
        if (!email) return fail(400, 'email requis', env);
        const t = token();
        await env.DB.prepare('INSERT INTO auth_tokens (token, email, expires_at, used) VALUES (?, ?, ?, 0)')
          .bind(t, email, now() + HOUR)
          .run();
        // E-mail PLUGGABLE (doc 15 §5.1) : ici on renvoie le lien plutôt que de
        // l'envoyer (brancher Resend/MailChannels au déploiement).
        const link = `${url.origin}/auth/verify?token=${t}`;
        return json({ ok: true, verifyLink: link }, 200, env);
      }
      if (path === '/auth/verify' && request.method === 'GET') {
        const t = url.searchParams.get('token');
        if (!t) return fail(400, 'token requis', env);
        const row = await env.DB.prepare('SELECT email, expires_at, used FROM auth_tokens WHERE token = ?')
          .bind(t)
          .first<{ email: string; expires_at: number; used: number }>();
        if (!row || row.used || row.expires_at < now()) return fail(401, 'jeton invalide ou expiré', env);
        await env.DB.prepare('UPDATE auth_tokens SET used = 1 WHERE token = ?').bind(t).run();
        // NET-SEC.2 : purge opportuniste des sessions/jetons expirés (au login,
        // faible fréquence — empêche la croissance sans fin des tables).
        await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()).run();
        await env.DB.prepare('DELETE FROM auth_tokens WHERE expires_at < ?').bind(now()).run();
        // Crée le profil au premier login (handle = partie locale de l'e-mail).
        let profile = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?')
          .bind(row.email)
          .first<{ id: string }>();
        if (!profile) {
          const id = crypto.randomUUID();
          // NET-SEC.1 : `handle` est UNIQUE — deux e-mails de même partie locale
          // (`a@x.com`/`a@y.com`) violaient la contrainte (500). Désambiguïse sur
          // collision par un suffixe tiré de l'uuid (unicité pratique).
          const base = (row.email.split('@')[0] || id).slice(0, 40);
          const clash = await env.DB.prepare('SELECT 1 FROM profiles WHERE handle = ?').bind(base).first();
          const handle = clash ? `${base}-${id.slice(0, 6)}` : base;
          await env.DB.prepare('INSERT INTO profiles (id, handle, email, created_at) VALUES (?, ?, ?, ?)')
            .bind(id, handle, row.email, now())
            .run();
          profile = { id };
        }
        const session = token();
        await env.DB.prepare('INSERT INTO sessions (id, profile_id, expires_at) VALUES (?, ?, ?)')
          .bind(session, profile.id, now() + 30 * 24 * HOUR)
          .run();
        return json({ session, profileId: profile.id }, 200, env);
      }

      const profileId = await authProfile(request, env);
      if (!profileId) return fail(401, 'authentification requise', env);

      // NET-SEC.1 : révocation de session serveur (déconnexion). Le client
      // n'invalidait la session que localement ; elle restait valide au serveur.
      // On ne révoque que SA propre session (bearer courant). Idempotent.
      if (path === '/session' && request.method === 'DELETE') {
        const bearer = request.headers.get('Authorization')?.slice(7) ?? '';
        await env.DB.prepare('DELETE FROM sessions WHERE id = ? AND profile_id = ?')
          .bind(bearer, profileId)
          .run();
        return json({ ok: true }, 200, env);
      }

      // — Cloud saves —
      // Liste des slots du profil (NET-CLOUDSAVES.2, doc 15 §5.2) : slot + version
      // de forme + horodatage, SANS le blob `state` (requête légère pour l'UI).
      if (path === '/saves' && request.method === 'GET') {
        const rows = await env.DB.prepare(
          'SELECT slot, save_version, updated_at FROM saves WHERE profile_id = ? ORDER BY updated_at DESC',
        )
          .bind(profileId)
          .all<{ slot: string; save_version: number; updated_at: number }>();
        return json({ saves: rows.results }, 200, env);
      }
      const saveMatch = path.match(/^\/saves\/([\w-]+)$/);
      if (saveMatch) {
        const slot = saveMatch[1]!;
        if (request.method === 'PUT') {
          const { state, save_version } = await body<{ state?: string; save_version?: number }>(request, MAX_SAVE_BYTES);
          if (typeof state !== 'string' || typeof save_version !== 'number') return fail(400, 'state/save_version requis', env);
          // NET-SRVGUARD (doc 15 §5.2, doc 07 §4) : garde de version ANTI-DOWNGRADE.
          // Un client d'une version obsolète ne peut pas écraser une sauvegarde plus
          // récente : rejet si `save_version` < version déjà stockée pour ce slot.
          // Même version (autosave) ou supérieure (client à niveau) ⇒ upsert. Le
          // serveur reste version-agnostique (pas de constante moteur dupliquée) ;
          // il n'impose que la monotonie (« le plus récent gagne »).
          const existing = await env.DB.prepare('SELECT save_version FROM saves WHERE profile_id = ? AND slot = ?')
            .bind(profileId, slot)
            .first<{ save_version: number }>();
          if (existing && save_version < existing.save_version)
            return fail(409, 'version de sauvegarde obsolète', env);
          // NET-SEC.2 : quota de slots. Un slot NOUVEAU (pas de ligne existante)
          // est refusé si le profil est déjà au plafond. La mise à jour d'un slot
          // existant reste toujours permise.
          if (!existing) {
            const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM saves WHERE profile_id = ?')
              .bind(profileId)
              .first<{ n: number }>();
            if ((count?.n ?? 0) >= MAX_SAVE_SLOTS) return fail(409, 'quota de sauvegardes atteint', env);
          }
          await env.DB.prepare(
            'INSERT INTO saves (profile_id, slot, save_version, state, updated_at) VALUES (?, ?, ?, ?, ?) ' +
              'ON CONFLICT(profile_id, slot) DO UPDATE SET save_version=excluded.save_version, state=excluded.state, updated_at=excluded.updated_at',
          )
            .bind(profileId, slot, save_version, state, now())
            .run();
          return json({ ok: true }, 200, env);
        }
        if (request.method === 'GET') {
          const row = await env.DB.prepare('SELECT save_version, state, updated_at FROM saves WHERE profile_id = ? AND slot = ?')
            .bind(profileId, slot)
            .first<{ save_version: number; state: string; updated_at: number }>();
          return row ? json(row, 200, env) : fail(404, 'aucune sauvegarde', env);
        }
      }

      // — Parties asynchrones —
      if (path === '/matches' && request.method === 'GET') {
        // Parties ouvertes à rejoindre + celles où je suis inscrit.
        const rows = await env.DB.prepare(
          'SELECT DISTINCT m.id, m.status, m.created_at FROM matches m ' +
            'LEFT JOIN match_players p ON p.match_id = m.id ' +
            "WHERE m.status = 'open' OR p.profile_id = ? ORDER BY m.created_at DESC LIMIT 50",
        )
          .bind(profileId)
          .all<{ id: string; status: string; created_at: number }>();
        return json({ matches: rows.results }, 200, env);
      }
      if (path === '/matches' && request.method === 'POST') {
        const { seed, setup } = await body<{ seed?: number; setup?: { players?: { id: string }[] } }>(request);
        if (typeof seed !== 'number' || !setup?.players?.length) return fail(400, 'seed/setup requis', env);
        const id = crypto.randomUUID();
        await env.DB.prepare('INSERT INTO matches (id, seed, setup, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(id, seed, JSON.stringify(setup), 'open', profileId, now())
          .run();
        // Sièges = joueurs du setup (ordre de tour). Le créateur prend le siège 0.
        for (const [seat, player] of setup.players.entries()) {
          await env.DB.prepare('INSERT INTO match_players (match_id, seat, profile_id, player_id) VALUES (?, ?, ?, ?)')
            .bind(id, seat, seat === 0 ? profileId : null, player.id)
            .run();
        }
        return json({ id }, 200, env);
      }

      // Détail d'une partie (doc 15 §5.3, NET-MATCHDETAIL) : le client rejoue
      // `base (seed/setup) + batch (moves)` — cet endpoint fournit de quoi
      // reconstruire l'état. Info ouverte (décision NET-FOG, async v1) : pas de
      // filtre par participant, seule l'authentification est requise.
      const detailMatch = path.match(/^\/matches\/([\w-]+)$/);
      if (detailMatch && request.method === 'GET') {
        const matchId = detailMatch[1]!;
        const m = await env.DB.prepare('SELECT seed, setup, status, created_at FROM matches WHERE id = ?')
          .bind(matchId)
          .first<{ seed: number; setup: string; status: string; created_at: number }>();
        if (!m) return fail(404, 'partie inconnue', env);
        // NET-LIFECYCLE : expiration paresseuse (une partie inactive devient
        // `abandoned` à la consultation).
        const status = await effectiveStatus(env, matchId, m.status, m.created_at);
        const players = await env.DB.prepare(
          'SELECT seat, player_id, profile_id FROM match_players WHERE match_id = ? ORDER BY seat',
        )
          .bind(matchId)
          .all<{ seat: number; player_id: string; profile_id: string | null }>();
        const seqRow = await env.DB.prepare('SELECT MAX(seq) AS seq FROM moves WHERE match_id = ?')
          .bind(matchId)
          .first<{ seq: number | null }>();
        return json(
          {
            id: matchId,
            seed: m.seed,
            setup: JSON.parse(m.setup) as unknown,
            status,
            createdAt: m.created_at,
            players: players.results,
            seq: seqRow?.seq ?? -1,
          },
          200,
          env,
        );
      }

      const joinMatch = path.match(/^\/matches\/([\w-]+)\/join$/);
      if (joinMatch && request.method === 'POST') {
        const matchId = joinMatch[1]!;
        const free = await env.DB.prepare('SELECT seat FROM match_players WHERE match_id = ? AND profile_id IS NULL ORDER BY seat LIMIT 1')
          .bind(matchId)
          .first<{ seat: number }>();
        if (!free) return fail(409, 'aucun siège libre', env);
        await env.DB.prepare('UPDATE match_players SET profile_id = ? WHERE match_id = ? AND seat = ?')
          .bind(profileId, matchId, free.seat)
          .run();
        await env.DB.prepare("UPDATE matches SET status = 'active' WHERE id = ?").bind(matchId).run();
        return json({ ok: true, seat: free.seat }, 200, env);
      }

      // NET-LIFECYCLE : abandon volontaire. Un participant renonce ⇒ la partie
      // passe `abandoned` (borné sur open/active pour rester idempotent). Le
      // vainqueur n'est pas stocké : dans une partie async à 2, l'adversaire
      // infère sa victoire en voyant `abandoned` (info ouverte, décision NET-FOG).
      const forfeitMatch = path.match(/^\/matches\/([\w-]+)\/forfeit$/);
      if (forfeitMatch && request.method === 'POST') {
        const matchId = forfeitMatch[1]!;
        const seat = await env.DB.prepare('SELECT seat FROM match_players WHERE match_id = ? AND profile_id = ?')
          .bind(matchId, profileId)
          .first<{ seat: number }>();
        if (!seat) return fail(403, 'vous ne participez pas à cette partie', env);
        await env.DB.prepare("UPDATE matches SET status = 'abandoned' WHERE id = ? AND status IN ('open', 'active')")
          .bind(matchId)
          .run();
        return json({ ok: true }, 200, env);
      }

      const movesMatch = path.match(/^\/matches\/([\w-]+)\/moves$/);
      if (movesMatch) {
        const matchId = movesMatch[1]!;
        if (request.method === 'GET') {
          const since = Number(url.searchParams.get('since') ?? '-1');
          const rows = await env.DB.prepare('SELECT seq, commands FROM moves WHERE match_id = ? AND seq > ? ORDER BY seq')
            .bind(matchId, since)
            .all<{ seq: number; commands: string }>();
          return json({ moves: rows.results.map((r) => ({ seq: r.seq, commands: JSON.parse(r.commands) })) }, 200, env);
        }
        if (request.method === 'POST') {
          const { seq, commands } = await body<{ seq?: number; commands?: Command[] }>(request);
          if (typeof seq !== 'number' || !Array.isArray(commands)) return fail(400, 'seq/commands requis', env);
          const seat = await env.DB.prepare('SELECT player_id FROM match_players WHERE match_id = ? AND profile_id = ?')
            .bind(matchId, profileId)
            .first<{ player_id: string }>();
          if (!seat) return fail(403, 'vous ne participez pas à cette partie', env);
          // NET-LIFECYCLE : on ne poste plus dans une partie terminée/abandonnée
          // (ni dans une partie `active` expirée par inactivité — marquée ici).
          const mrow = await env.DB.prepare('SELECT status, created_at FROM matches WHERE id = ?')
            .bind(matchId)
            .first<{ status: string; created_at: number }>();
          if (!mrow) return fail(404, 'partie inconnue', env);
          const status = await effectiveStatus(env, matchId, mrow.status, mrow.created_at);
          if (status !== 'active' && status !== 'open')
            return fail(409, 'partie terminée ou abandonnée', env);
          const base = await baseLog(env, matchId);
          if (!base) return fail(404, 'partie inconnue', env);
          const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM moves WHERE match_id = ?')
            .bind(matchId)
            .first<{ n: number }>();
          if (seq !== (count?.n ?? 0)) return fail(409, `seq attendu ${count?.n ?? 0}`, env);
          // VALIDATION par re-simulation : bon joueur + commandes légales.
          const result = appendTurn([base.setup, ...base.commands], seat.player_id, commands);
          if (!result.ok) return fail(422, result.reason, env);
          await env.DB.prepare('INSERT INTO moves (match_id, seq, profile_id, commands, created_at) VALUES (?, ?, ?, ?, ?)')
            .bind(matchId, seq, profileId, JSON.stringify(commands), now())
            .run();
          // Fin de partie détectée au rejeu → statut.
          if (replayCommands(result.commands).outcome) {
            await env.DB.prepare("UPDATE matches SET status = 'finished' WHERE id = ?").bind(matchId).run();
          }
          return json({ ok: true, seq }, 200, env);
        }
      }

      return fail(404, 'route inconnue', env);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message, env);
      return fail(500, (e as Error).message, env);
    }
  },
};
