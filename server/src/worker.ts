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

function cors(origin: string | undefined): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
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
        const { email } = (await request.json()) as { email?: string };
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
        // Crée le profil au premier login (handle = partie locale de l'e-mail).
        let profile = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?')
          .bind(row.email)
          .first<{ id: string }>();
        if (!profile) {
          const id = crypto.randomUUID();
          await env.DB.prepare('INSERT INTO profiles (id, handle, email, created_at) VALUES (?, ?, ?, ?)')
            .bind(id, row.email.split('@')[0] ?? id, row.email, now())
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

      // — Cloud saves —
      const saveMatch = path.match(/^\/saves\/([\w-]+)$/);
      if (saveMatch) {
        const slot = saveMatch[1]!;
        if (request.method === 'PUT') {
          const { state, save_version } = (await request.json()) as { state?: string; save_version?: number };
          if (typeof state !== 'string' || typeof save_version !== 'number') return fail(400, 'state/save_version requis', env);
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
        const { seed, setup } = (await request.json()) as { seed?: number; setup?: { players?: { id: string }[] } };
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
        const m = await env.DB.prepare('SELECT seed, setup, status FROM matches WHERE id = ?')
          .bind(matchId)
          .first<{ seed: number; setup: string; status: string }>();
        if (!m) return fail(404, 'partie inconnue', env);
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
            status: m.status,
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
          const { seq, commands } = (await request.json()) as { seq?: number; commands?: Command[] };
          if (typeof seq !== 'number' || !Array.isArray(commands)) return fail(400, 'seq/commands requis', env);
          const seat = await env.DB.prepare('SELECT player_id FROM match_players WHERE match_id = ? AND profile_id = ?')
            .bind(matchId, profileId)
            .first<{ player_id: string }>();
          if (!seat) return fail(403, 'vous ne participez pas à cette partie', env);
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
      return fail(500, (e as Error).message, env);
    }
  },
};
