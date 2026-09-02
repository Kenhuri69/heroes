import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import schema from '../schema.sql?raw';
import type { Command } from '@heroes/engine';
import { emptyResources } from '../../packages/engine/src/core/state';
import { testConfig, testMap } from '../../packages/engine/test/fixtures';

/**
 * Harnais du Worker (revue 2026-09, R8 — « aucun harnais ⇒ gardes non testées »
 * depuis la revue 2026-08). workerd + D1 locale (Miniflare) ; schéma appliqué
 * depuis `server/schema.sql`. Chaque test parle HTTP au Worker (`SELF.fetch`),
 * exactement comme le client. `DEV_RETURN_VERIFY_LINK=1` et `APP_ORIGIN` sont
 * posés par `vitest.config.ts` (mode dev : le lien est renvoyé dans la réponse).
 */
const ORIGIN = 'https://heroes.test';

beforeAll(async () => {
  for (const stmt of schema.split(';').map((s) => s.trim()).filter((s) => s.length > 0)) {
    await env.DB.prepare(stmt).run();
  }
});

async function post(path: string, body: unknown, session?: string, headers: Record<string, string> = {}): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${path}`, {
    method: path.startsWith('/saves/') ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
}
async function get(path: string, session?: string): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${path}`, { headers: session ? { Authorization: `Bearer ${session}` } : {} });
}

/** Ouvre une session pour `email` via le parcours magic-link complet (mode dev). */
async function login(email: string): Promise<{ session: string; profileId: string }> {
  const req = await post('/auth/request', { email });
  expect(req.status).toBe(200);
  const { verifyLink } = (await req.json()) as { verifyLink: string };
  const token = new URL(verifyLink).searchParams.get('auth')!;
  const ver = await get(`/auth/verify?token=${encodeURIComponent(token)}`);
  expect(ver.status).toBe(200);
  return (await ver.json()) as { session: string; profileId: string };
}

/** `StartGame` minimal à 2 sièges humains (netcode : 1ʳᵉ commande d'un journal). */
function startGame(seed: number): Command {
  return {
    type: 'StartGame',
    seed,
    players: [
      { id: 'p1', startingResources: emptyResources() },
      { id: 'p2', startingResources: emptyResources() },
    ],
    map: testMap(),
    config: testConfig(),
    unitCatalog: {},
    buildingCatalog: {},
    towns: [],
  };
}

describe('auth magic-link', () => {
  it('sans session : 401 sur une route protégée (avant le 404 de routage)', async () => {
    expect((await get('/saves')).status).toBe(401);
    expect((await get('/nope')).status).toBe(401);
  });

  it('S3 : le lien renvoyé pointe vers l’APP (`?auth=`), et la session s’ouvre', async () => {
    const req = await post('/auth/request', { email: 'Alice@Example.org' });
    const { verifyLink } = (await req.json()) as { verifyLink: string };
    expect(verifyLink.startsWith('https://app.test/heroes/?auth=')).toBe(true);
    const { session } = await login('alice2@example.org');
    expect((await get('/saves', session)).status).toBe(200);
  });

  it('S10 : un jeton est à usage unique (2ᵉ verify ⇒ 401)', async () => {
    const req = await post('/auth/request', { email: 'once@example.org' });
    const { verifyLink } = (await req.json()) as { verifyLink: string };
    const token = new URL(verifyLink).searchParams.get('auth')!;
    expect((await get(`/auth/verify?token=${token}`)).status).toBe(200);
    expect((await get(`/auth/verify?token=${token}`)).status).toBe(401);
  });

  it('S11 : l’e-mail est normalisé (casse) — un seul profil ; forme invalide ⇒ 400', async () => {
    const a = await login('Case@Example.org');
    const b = await login('case@example.org');
    expect(a.profileId).toBe(b.profileId);
    expect((await post('/auth/request', { email: 'pas-un-email' })).status).toBe(400);
    expect((await post('/auth/request', { email: 42 })).status).toBe(400);
  });

  it('en-têtes : no-store / nosniff sur les réponses JSON', async () => {
    const res = await get('/nope');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

describe('cloud saves', () => {
  it('aller-retour PUT/GET + copie N-1 transactionnelle', async () => {
    const { session } = await login('saver@example.org');
    expect((await post('/saves/manual', { state: '{"v":1}', save_version: 3 }, session)).status).toBe(200);
    expect((await post('/saves/manual', { state: '{"v":2}', save_version: 3 }, session)).status).toBe(200);
    const got = (await (await get('/saves/manual', session)).json()) as { state: string };
    expect(got.state).toBe('{"v":2}');
    const backup = await env.DB.prepare('SELECT state FROM save_backups WHERE slot = ?').bind('manual').first<{ state: string }>();
    expect(backup?.state).toBe('{"v":1}');
  });

  it('S7 : un corps annoncé trop gros est refusé (413) sans être lu', async () => {
    const { session } = await login('big@example.org');
    const res = await post('/saves/manual', { state: 'x', save_version: 1 }, session, { 'Content-Length': String(100 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe('parties asynchrones', () => {
  it('S13 : un setup invalide (seed incohérente, siège IA, StartGame illégal) est refusé 400', async () => {
    const { session } = await login('host@example.org');
    const setup = startGame(7);
    expect((await post('/matches', { seed: 8, setup }, session)).status).toBe(400);
    const ai = { ...setup, players: [...(setup as { players: object[] }).players.slice(0, 1), { id: 'p2', startingResources: emptyResources(), controller: 'ai' }] };
    expect((await post('/matches', { seed: 7, setup: ai }, session)).status).toBe(400);
    expect((await post('/matches', { seed: 7, setup: { type: 'StartGame', seed: 7, players: [{ id: 'a' }, { id: 'b' }] } }, session)).status).toBe(400);
    expect((await post('/matches', { seed: 7, setup }, session)).status).toBe(200);
  });

  it('S5/S1 : siège pris une seule fois ; un lot qui franchit EndTurn est refusé 422 ; le coup légal passe', async () => {
    const host = await login('h2@example.org');
    const guest = await login('g2@example.org');
    const third = await login('t2@example.org');
    const setup = startGame(11);
    const { id } = (await (await post('/matches', { seed: 11, setup }, host.session)).json()) as { id: string };
    expect((await post(`/matches/${id}/join`, {}, guest.session)).status).toBe(200);
    expect((await post(`/matches/${id}/join`, {}, third.session)).status).toBe(409); // plus de siège
    expect((await post(`/matches/${id}/join`, {}, guest.session)).status).toBe(409); // déjà assis
    // p1 (hôte) poste un lot qui joue AUSSI le tour de p2 ⇒ refusé (S1).
    const cheat = await post(
      `/matches/${id}/moves`,
      { seq: 0, commands: [{ type: 'EndTurn', playerId: 'p1' }, { type: 'EndTurn', playerId: 'p2' }] },
      host.session,
    );
    expect(cheat.status).toBe(422);
    // Lot borné à son tour ⇒ accepté ; le même seq rejoué ⇒ 409 (pas 500).
    expect((await post(`/matches/${id}/moves`, { seq: 0, commands: [{ type: 'EndTurn', playerId: 'p1' }] }, host.session)).status).toBe(200);
    expect((await post(`/matches/${id}/moves`, { seq: 0, commands: [{ type: 'EndTurn', playerId: 'p1' }] }, host.session)).status).toBe(409);
    // Ce n'est plus le tour de p1.
    expect((await post(`/matches/${id}/moves`, { seq: 1, commands: [{ type: 'EndTurn', playerId: 'p1' }] }, host.session)).status).toBe(422);
    expect((await post(`/matches/${id}/moves`, { seq: 1, commands: [{ type: 'EndTurn', playerId: 'p2' }] }, guest.session)).status).toBe(200);
  });

  it('S9 : un lobby `open` périmé n’est plus proposé au matchmaking ni listé', async () => {
    const host = await login('old@example.org');
    const seeker = await login('seek@example.org');
    const { id } = (await (await post('/matches', { seed: 5, setup: startGame(5) }, host.session)).json()) as { id: string };
    // Vieillit artificiellement le lobby au-delà du délai d'inactivité (14 j).
    await env.DB.prepare('UPDATE matches SET created_at = ? WHERE id = ?').bind(Date.now() - 20 * 24 * 3_600_000, id).run();
    const mm = (await (await post('/matchmaking', {}, seeker.session)).json()) as { matched: boolean; id?: string };
    expect(mm.id).not.toBe(id);
    const list = (await (await get('/matches', seeker.session)).json()) as { matches: { id: string }[] };
    expect(list.matches.some((m) => m.id === id)).toBe(false);
  });
});
