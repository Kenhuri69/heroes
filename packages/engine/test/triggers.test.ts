import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { Command, PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { AdventureMapDef, MapTriggerDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Triggers de carte (doc 02 §2.1, comblement MVP) : effets déclaratifs
 * génériques déclenchés à la visite d'une tuile ou à un jour donné, one-shot.
 * Lot 2.4 (doc 18 A5) : effets liés au héros visiteur — don d'artefact/armée,
 * embuscade (combat scripté qui interrompt le chemin).
 */
function startWith(triggers: MapTriggerDef[], players: PlayerSetup[]): GameState {
  const map: AdventureMapDef = { ...testMap(), triggers };
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 1,
    players,
    map,
    config: testConfig(),
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

const P1: PlayerSetup = { id: 'p1', startingResources: emptyResources() };
const P2: PlayerSetup = { id: 'p2', startingResources: emptyResources() };

describe('triggers de visite', () => {
  it('octroie la ressource au joueur qui visite, une seule fois (one-shot)', () => {
    const state = startWith(
      [
        {
          id: 't-visit',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'grantResource', resource: 'gold', amount: 100 },
          fired: false,
        },
      ],
      [P1],
    );
    const gold0 = state.players[0]!.resources.gold;
    const r1 = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    expect(
      r1.events.some((e) => e.type === 'TriggerFired' && e.triggerId === 't-visit'),
    ).toBe(true);
    expect(r1.state.players[0]!.resources.gold).toBe(gold0 + 100);
    expect(r1.state.map!.triggers[0]!.fired).toBe(true);

    // Repasser (tour suivant pour restaurer les PM) ne re-déclenche pas.
    const day2 = apply(r1.state, { type: 'EndTurn', playerId: 'p1' });
    const back = apply(day2.state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 0, y: 0 }] });
    const again = apply(back.state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [{ x: 1, y: 0 }],
    });
    expect(again.events.some((e) => e.type === 'TriggerFired')).toBe(false);
    expect(again.state.players[0]!.resources.gold).toBe(gold0 + 100);
  });
});

describe('triggers de jour', () => {
  it('émet un message global au bon jour, une seule fois', () => {
    const state = startWith(
      [
        {
          id: 't-day',
          on: { kind: 'day', day: 2 },
          effect: { kind: 'message', textKey: 'hello' },
          fired: false,
        },
      ],
      [P1],
    );
    const r = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(r.state.calendar.day).toBe(2);
    const fired = r.events.filter((e) => e.type === 'TriggerFired' && e.triggerId === 't-day');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ playerId: null, effect: { kind: 'message', textKey: 'hello' } });

    const r2 = apply(r.state, { type: 'EndTurn', playerId: 'p1' });
    expect(r2.events.some((e) => e.type === 'TriggerFired')).toBe(false);
  });

  it('A11 — un trigger `onDay` du jour 1 se déclenche dès StartGame', () => {
    const state = startWith(
      [
        {
          id: 't-day1',
          on: { kind: 'day', day: 1 },
          effect: { kind: 'grantResource', resource: 'gold', amount: 50 },
          fired: false,
        },
      ],
      [P1],
    );
    // Auparavant `fireDayTriggers` n'était appelé qu'aux bascules de jour ⇒ un
    // trigger day 1 restait mort. Il doit avoir été tiré pendant StartGame.
    expect(state.players[0]!.resources.gold).toBe(emptyResources().gold + 50);
    expect(state.map!.triggers[0]!.fired).toBe(true);
  });

  it('octroie une ressource symétriquement à tous les joueurs actifs', () => {
    const state = startWith(
      [
        {
          id: 't-day-res',
          on: { kind: 'day', day: 2 },
          effect: { kind: 'grantResource', resource: 'wood', amount: 5 },
          fired: false,
        },
      ],
      [P1, P2],
    );
    // Un jour bascule quand tous les joueurs ont fini leur tour.
    const a = apply(state, { type: 'EndTurn', playerId: 'p1' });
    const b = apply(a.state, { type: 'EndTurn', playerId: 'p2' });
    expect(b.state.calendar.day).toBe(2);
    expect(b.state.players[0]!.resources.wood).toBe(5);
    expect(b.state.players[1]!.resources.wood).toBe(5);
  });
});

describe('lot 2.4 (doc 18 A5) — effets liés au héros visiteur', () => {
  const ARMED: PlayerSetup = {
    id: 'p1',
    startingResources: emptyResources(),
    startingArmy: [{ unitId: 'red-grunt', count: 10 }],
  };

  it('grantArtifact : le héros visiteur reçoit l’artefact (slot libre), one-shot', () => {
    const state = startWith(
      [
        {
          id: 't-art',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'grantArtifact', artifactId: 'amulette-test' },
          fired: false,
        },
      ],
      [ARMED],
    );
    const r = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    const hero = r.state.heroes[0]!;
    const carried = [...hero.artifacts, ...(hero.backpack ?? [])];
    expect(carried).toContain('amulette-test');
    expect(r.state.map!.triggers[0]!.fired).toBe(true);
  });

  it('grantArmy : fusion avec une pile existante, sinon nouveau slot', () => {
    const state = startWith(
      [
        {
          id: 't-merge',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'grantArmy', unitId: 'red-grunt', count: 3 },
          fired: false,
        },
        {
          id: 't-new',
          on: { kind: 'visit', pos: { x: 2, y: 0 } },
          effect: { kind: 'grantArmy', unitId: 'blue-wolf', count: 2 },
          fired: false,
        },
      ],
      [ARMED],
    );
    const r1 = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    expect(r1.state.heroes[0]!.army).toEqual([{ unitId: 'red-grunt', count: 13 }]);
    const r2 = apply(r1.state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 2, y: 0 }] });
    expect(r2.state.heroes[0]!.army).toEqual([
      { unitId: 'red-grunt', count: 13 },
      { unitId: 'blue-wolf', count: 2 },
    ]);
  });

  it('grantArmy : cap 7 piles — le don est perdu mais le trigger consommé', () => {
    // 7 piles distinctes : StartGame valide chaque unitId contre le catalogue.
    const units = ['u-a', 'u-b', 'u-c', 'u-d', 'u-e', 'u-f', 'u-g'];
    const catalog = { ...testCatalog() };
    for (const u of units) catalog[u] = { ...testCatalog()['red-grunt']!, id: u };
    const full: PlayerSetup = {
      ...ARMED,
      startingArmy: units.map((u) => ({ unitId: u, count: 1 })),
    };
    const map: AdventureMapDef = {
      ...testMap(),
      triggers: [
        {
          id: 't-full',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'grantArmy', unitId: 'blue-wolf', count: 2 },
          fired: false,
        },
      ],
    };
    const state = apply(createEmptyState(), {
      type: 'StartGame',
      seed: 1,
      players: [full],
      map,
      config: testConfig(),
      unitCatalog: catalog,
      buildingCatalog: {},
      towns: [],
    }).state;
    const r = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    expect(r.state.heroes[0]!.army).toHaveLength(7);
    expect(r.state.heroes[0]!.army.some((s) => s.unitId === 'blue-wolf')).toBe(false);
    expect(r.state.map!.triggers[0]!.fired).toBe(true);
  });

  it('ambush : ouvre un combat scripté SUR la tuile et interrompt le chemin ; one-shot après victoire', () => {
    const state = startWith(
      [
        {
          id: 't-ambush',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'ambush', army: [{ unitId: 'blue-wolf', count: 1 }] },
          fired: false,
        },
      ],
      [ARMED],
    );
    const r = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
    // Le héros est SUR la tuile piégée (à la différence de l'interception de
    // gardien) et le reste du chemin est abandonné.
    expect(r.state.heroes[0]!.pos).toEqual({ x: 1, y: 0 });
    expect(r.state.combat).not.toBeNull();
    expect(r.state.combat!.guardianObjectId).toBeNull();
    expect(
      r.state.combat!.stacks.filter((s) => s.side === 'defender').map((s) => s.unitId),
    ).toEqual(['blue-wolf']);
    expect(r.state.map!.triggers[0]!.fired).toBe(true);

    // Victoire (10 grunts vs 1 loup) ⇒ retour carte ; repasser ne re-piège pas.
    const won = apply(r.state, { type: 'AutoCombat' });
    expect(won.state.combat).toBeNull();
    expect(won.state.heroes[0]).toBeDefined();
    const again = apply(won.state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 2, y: 0 }] });
    expect(again.state.combat).toBeNull();
    expect(again.state.heroes[0]!.pos).toEqual({ x: 2, y: 0 });
  });

  it('ambush : un héros sans armée ne déclenche rien et ne consomme PAS le piège', () => {
    const unarmed: PlayerSetup = { id: 'p1', startingResources: emptyResources() };
    const state = startWith(
      [
        {
          id: 't-ambush',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'ambush', army: [{ unitId: 'blue-wolf', count: 1 }] },
          fired: false,
        },
      ],
      [unarmed],
    );
    const r = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    expect(r.state.combat).toBeNull();
    expect(r.state.map!.triggers[0]!.fired).toBe(false);
  });

  it('teleport : déplace le héros visiteur en `to`, interrompt le chemin, révèle la vision, one-shot', () => {
    const dest = { x: 7, y: 6 };
    const state = startWith(
      [
        {
          id: 't-tp',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'teleport', to: dest },
          fired: false,
        },
      ],
      [ARMED],
    );
    // La destination n'est pas explorée au départ (le héros voit autour de (0,0)).
    expect(state.players[0]!.explored[dest.y * state.map!.width + dest.x]).toBeFalsy();
    const r = apply(state, {
      type: 'MoveHero',
      heroId: 'hero-p1',
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
    // Téléporté en `to` (SUR la tuile piège, le reste du chemin est abandonné), aucun combat.
    expect(r.state.heroes[0]!.pos).toEqual(dest);
    expect(r.state.combat).toBeNull();
    expect(r.events.some((e) => e.type === 'HeroTeleported')).toBe(true);
    expect(r.state.map!.triggers[0]!.fired).toBe(true);
    // Vision révélée autour de la destination.
    expect(r.state.players[0]!.explored[dest.y * r.state.map!.width + dest.x]).toBe(1);
  });

  it('teleport : cible hors carte ⇒ garde-fou (héros immobile, trigger NON consommé)', () => {
    const state = startWith(
      [
        {
          id: 't-tp-oob',
          on: { kind: 'visit', pos: { x: 1, y: 0 } },
          effect: { kind: 'teleport', to: { x: 999, y: 999 } },
          fired: false,
        },
      ],
      [ARMED],
    );
    const r = apply(state, { type: 'MoveHero', heroId: 'hero-p1', path: [{ x: 1, y: 0 }] });
    // Cible hors bornes : aucun déplacement de téléport, trigger pas consommé.
    expect(r.state.heroes[0]!.pos).toEqual({ x: 1, y: 0 });
    expect(r.events.some((e) => e.type === 'HeroTeleported')).toBe(false);
    expect(r.state.map!.triggers[0]!.fired).toBe(false);
  });

  it('trigger de jour à effet héros (grantArtifact) : no-op tracé (fired + événement, aucun octroi)', () => {
    const state = startWith(
      [
        {
          id: 't-day-art',
          on: { kind: 'day', day: 2 },
          effect: { kind: 'grantArtifact', artifactId: 'amulette-test' },
          fired: false,
        },
      ],
      [ARMED],
    );
    const r = apply(state, { type: 'EndTurn', playerId: 'p1' });
    expect(r.events.some((e) => e.type === 'TriggerFired' && e.triggerId === 't-day-art')).toBe(true);
    expect(r.state.map!.triggers[0]!.fired).toBe(true);
    const hero = r.state.heroes[0]!;
    expect([...hero.artifacts, ...(hero.backpack ?? [])]).not.toContain('amulette-test');
  });
});

describe('immutabilité de la commande StartGame (format de replay, doc 07 §3)', () => {
  it('ne mute pas cmd.map (trigger jour 1) et ne le gèle pas — rejouable à l’identique', () => {
    const map: AdventureMapDef = {
      ...testMap(),
      triggers: [
        {
          id: 't-day1',
          on: { kind: 'day', day: 1 },
          effect: { kind: 'grantResource', resource: 'gold', amount: 100 },
          fired: false,
        },
      ],
    };
    const cmd: Command = {
      type: 'StartGame',
      seed: 1,
      players: [P1],
      map,
      config: testConfig(),
      unitCatalog: {},
      buildingCatalog: {},
      towns: [],
    };
    const r1 = apply(createEmptyState(), cmd);
    // Le trigger a bien tiré dans L'ÉTAT, pas dans la commande de l'appelant.
    expect(r1.state.map!.triggers[0]!.fired).toBe(true);
    expect(map.triggers[0]!.fired).toBe(false);
    expect(Object.isFrozen(map)).toBe(false);
    expect(Object.isFrozen(map.triggers[0])).toBe(false);
    // Re-simulation du même journal : résultat identique (l'or du trigger est re-crédité).
    const r2 = apply(createEmptyState(), cmd);
    expect(r2.state.players[0]!.resources.gold).toBe(r1.state.players[0]!.resources.gold);
    expect(r2.state.map!.triggers[0]!.fired).toBe(true);
  });
});
