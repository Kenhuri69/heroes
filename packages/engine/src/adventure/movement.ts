import { beginGuardianCombat, beginHeroCombat } from '../combat/setup';
import type { GameEvent } from '../core/events';
import { areAllies, type GameState, type HeroState, type PlayerState, type ResourceId } from '../core/state';
import { heroVisionRadius } from '../hero/skills';
import { learnGuildSpellsAtTown } from '../town/mage-guild';
import { revealAround } from './fog';
import { revealStructure } from './vision';
import { samePos, type GridPos } from './map';
import { stepCost } from './path';
import { fireVisitTrigger } from './triggers';
import { recruitDwelling, visitBonus } from './visitable';

/** Le propriétaire (id ou null) d'une structure de carte est-il un ALLIÉ du joueur ? (B26) */
function isAllyOwner(draft: GameState, player: PlayerState, ownerId: string | null): boolean {
  if (!ownerId) return false;
  const owner = draft.players.find((p) => p.id === ownerId);
  return !!owner && areAllies(player, owner);
}

export interface AdvanceOptions {
  /**
   * Appelé après l'ouverture d'un combat d'interception (gardien OU héros ennemi,
   * H-VS-H). Le handler humain (`MoveHero`) le laisse indéfini : le combat reste
   * interactif (l'état conserve `draft.combat`). L'IA d'aventure y résout le
   * combat immédiatement (`runAutoCombat`) — déterministe.
   */
  onCombatEngaged?: () => void;
  /**
   * Appelé quand un trésor vient d'être foulé (`pendingTreasure` posé). Le
   * handler humain le laisse indéfini : le choix or/XP reste interactif. L'IA
   * d'aventure y résout le choix immédiatement (déterministe).
   */
  onTreasureFound?: () => void;
  /**
   * Coop PvE (doc 18 E4) : héros allié invité à rejoindre un combat de GARDIEN
   * déclenché par ce déplacement. Passé tel quel à `beginGuardianCombat`, qui
   * revalide (allié/adjacent/armée) et ignore une invite caduque.
   */
  allyHeroId?: string | undefined;
}

/**
 * Avance `hero` le long de `path`, pas à pas — logique unique partagée par le
 * handler `MoveHero` (joueur humain) et l'IA d'aventure (`runAiTurn`) :
 * décompte des PM (arrêt quand les points du jour ne suffisent plus,
 * doc 02 §1.5), interception de gardien (le héros paie le pas d'engagement
 * mais n'entre pas sur la tuile, décision plan phase-2.4), ramassage en
 * passant de ressource/artefact (le héros ne s'arrête pas — fidélité HoMM,
 * D6 ; seul un trésor à choix or/XP interrompt), révélation du brouillard.
 *
 * Seule divergence humain/IA : la résolution du combat de gardien, injectée
 * via `options.onCombatEngaged` (cf. `AdvanceOptions`).
 */
export function advanceHeroAlongPath(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  path: readonly GridPos[],
  events: GameEvent[],
  options: AdvanceOptions = {},
): void {
  const map = draft.map;
  const config = draft.config;
  if (!map || !config) return;
  // F5 (revue 2026-07) : index par tuile construits UNE fois par commande —
  // chaque pas faisait ~6 balayages linéaires de `map.objects` (+ héros +
  // villes), soit O(pas × objets) sous proxys immer sur des cartes ≤ 256² à
  // ~milliers d'objets, pour le joueur humain COMME pour chaque héros IA. Les
  // buckets préservent l'ordre du tableau ⇒ mêmes départages que les `find`
  // historiques. Tenu à jour au ramassage (`removeObject`).
  type MapObj = NonNullable<GameState['map']>['objects'][number];
  const tileKey = (p: GridPos): number => p.y * map.width + p.x;
  const objectsAt = new Map<number, MapObj[]>();
  for (const o of map.objects) {
    const k = tileKey(o.pos);
    const bucket = objectsAt.get(k);
    if (bucket) bucket.push(o);
    else objectsAt.set(k, [o]);
  }
  const objectIds = new Set(map.objects.map((o) => o.id));
  const heroesAt = new Map<number, HeroState[]>();
  for (const h of draft.heroes) {
    const k = tileKey(h.pos);
    const bucket = heroesAt.get(k);
    if (bucket) bucket.push(h);
    else heroesAt.set(k, [h]);
  }
  const townsAt = new Map<number, GameState['towns'][number]>();
  for (const t of draft.towns) townsAt.set(tileKey(t.pos), t);
  const removeObject = (o: MapObj): void => {
    const idx = map.objects.indexOf(o);
    if (idx !== -1) map.objects.splice(idx, 1);
    const bucket = objectsAt.get(tileKey(o.pos));
    const bi = bucket ? bucket.indexOf(o) : -1;
    if (bucket && bi !== -1) bucket.splice(bi, 1);
    objectIds.delete(o.id);
  };
  for (const step of path) {
    // Domaine du héros (A3) : coût terrestre ou naval selon `hero.naval`.
    const cost = stepCost(config, map, hero.pos, step, hero.naval);
    if (cost > hero.movementPoints) break;
    const guardian = objectsAt.get(tileKey(step))?.find((o) => o.type === 'guardian');
    if (guardian) {
      hero.movementPoints -= cost;
      beginGuardianCombat(draft, hero.id, guardian.id, events, options.allyHeroId);
      options.onCombatEngaged?.();
      return;
    }
    // Héros ENNEMI sur la tuile (H-VS-H, doc 02 §1.5/§5) : combat d'interception —
    // le héros paie le pas d'engagement mais n'entre pas sur la tuile (comme un
    // gardien). Allié/soi ne sont jamais sur le chemin (bloqués par `validatePath`).
    const enemyHero = heroesAt.get(tileKey(step))?.find((h) => {
      if (h.id === hero.id) return false;
      const occPlayer = draft.players.find((p) => p.id === h.playerId);
      return h.playerId !== player.id && !(occPlayer && areAllies(player, occPlayer));
    });
    if (enemyHero) {
      hero.movementPoints -= cost;
      beginHeroCombat(draft, hero.id, enemyHero.id, events);
      options.onCombatEngaged?.();
      return;
    }
    const from = { ...hero.pos };
    hero.movementPoints -= cost;
    hero.pos = { ...step };
    revealAround(
      player.explored,
      map,
      hero.pos,
      heroVisionRadius(hero, config.visionRadius, draft.skillCatalog, draft.artifactCatalog),
    );
    events.push({
      type: 'MoveStepped',
      heroId: hero.id,
      from,
      to: { ...step },
      movementPointsLeft: hero.movementPoints,
    });
    // Monolithe apparié (M-NAV a, doc 02 §2.1) : fouler l'un téléporte vers son
    // jumeau et INTERROMPT le déplacement (le reste du chemin part de l'entrée,
    // devenu invalide). Le héros arrive sur la tuile de sortie sans re-téléporter
    // (il n'y « entre » pas au sens d'un pas) — pas de boucle.
    const monolith = objectsAt.get(tileKey(hero.pos))?.find((o) => o.type === 'monolith');
    if (monolith && monolith.type === 'monolith') {
      const exit = map.objects.find(
        (o) => o.type === 'monolith' && o.pairId === monolith.pairId && o.id !== monolith.id,
      );
      if (exit) {
        // B9 (revue 2026-07) : la tuile de sortie peut être OCCUPÉE — jamais
        // deux héros superposés (invariant « un héros par tuile » : occupant =
        // premier `find`, ciblage H-VS-H, rendu). Ennemi ⇒ combat
        // d'interception à travers le monolithe (comme un pas normal) ;
        // allié/soi ⇒ passage bloqué, le déplacement s'arrête sur l'entrée.
        const occupant = draft.heroes.find((h) => h.id !== hero.id && samePos(h.pos, exit.pos));
        if (occupant) {
          const occPlayer = draft.players.find((p) => p.id === occupant.playerId);
          const hostile =
            occupant.playerId !== player.id && !(occPlayer && areAllies(player, occPlayer));
          if (hostile) {
            beginHeroCombat(draft, hero.id, occupant.id, events);
            options.onCombatEngaged?.();
            return;
          }
          break;
        }
        const fromPos = { ...hero.pos };
        hero.pos = { ...exit.pos };
        revealAround(
          player.explored,
          map,
          hero.pos,
          heroVisionRadius(hero, config.visionRadius, draft.skillCatalog, draft.artifactCatalog),
        );
        events.push({ type: 'HeroTeleported', heroId: hero.id, from: fromPos, to: { ...exit.pos } });
        break;
      }
    }
    // Trigger de visite (doc 02 §2.1) — la tuile foulée peut porter un effet.
    // Une embuscade (doc 18 A5) ouvre un combat : le chemin s'interrompt LÀ (le
    // héros est déjà SUR la tuile piégée, à la différence de l'interception).
    if (fireVisitTrigger(draft, player, hero, hero.pos, events)) {
      options.onCombatEngaged?.();
      return;
    }
    // Guilde des mages (G2) : fouler une de ses villes fait apprendre les sorts
    // du pool que le héros peut apprendre (cercle ≤ Sagesse).
    const townHere = townsAt.get(tileKey(hero.pos));
    if (townHere && townHere.ownerPlayerId === player.id)
      learnGuildSpellsAtTown(draft, hero, townHere, events);
    // Lieu de bonus / habitation (doc 02 §2.2) : visite en passant, comme la mine.
    for (const obj of objectsAt.get(tileKey(hero.pos)) ?? []) {
      if (obj.type === 'visitable') visitBonus(draft, hero, player, obj, events);
      else if (obj.type === 'obelisk') {
        // Obélisque (T-GRAIL, doc 02 §2.2) : compte une visite par joueur (dédup).
        // Quand le joueur les a TOUS visités, la tuile du Graal lui est révélée.
        const visited = player.obelisksVisited ?? (player.obelisksVisited = []);
        if (!visited.includes(obj.id)) {
          visited.push(obj.id);
          const total = map.objects.reduce((n, o) => n + (o.type === 'obelisk' ? 1 : 0), 0);
          const revealed = total > 0 && visited.length >= total && map.grailPos != null;
          events.push({
            type: 'ObeliskVisited',
            playerId: player.id,
            objectId: obj.id,
            visited: visited.length,
            total,
            grailRevealed: revealed,
          });
        }
      } else if (obj.type === 'dwelling') {
        // Habitation de carte capturable (M-DWELLOWN, doc 02 §2.2) : la fouler la
        // fait passer au joueur (drapeau + vision), qui touchera son réassort hebdo
        // (`applyWeeklyGrowth`). Recapturable par un ADVERSAIRE — comme une mine ;
        // le propriétaire ALLIÉ est traité comme soi (B26, revue 2026-07 : les
        // villes respectaient déjà `areAllies`, pas les structures de carte —
        // un allié détournait le réassort de son coéquipier en passant).
        if (obj.ownerId !== player.id && !isAllyOwner(draft, player, obj.ownerId)) {
          obj.ownerId = player.id;
          revealStructure(draft, player.id, obj.pos);
        }
        recruitDwelling(draft, hero, player, obj, events);
      }
    }
    // Mine (doc 02 §2.2) : capture en passant — le héros ne s'arrête pas, et
    // une mine adverse est recapturée par le même geste.
    const mine = objectsAt.get(tileKey(hero.pos))?.find((o) => o.type === 'mine');
    if (mine && mine.type === 'mine' && mine.ownerId !== player.id && !isAllyOwner(draft, player, mine.ownerId)) {
      mine.ownerId = player.id;
      revealStructure(draft, player.id, mine.pos); // F1 : mine capturée = vision de son voisinage
      events.push({
        type: 'MineCaptured',
        playerId: player.id,
        objectId: mine.id,
        resource: mine.resource,
        amount: mine.amount,
        pos: { ...hero.pos },
      });
    }
    const obj = objectsAt
      .get(tileKey(hero.pos))
      ?.find((o) => o.type === 'resource' || o.type === 'treasure' || o.type === 'artifact');
    if (obj) {
      // M-GUARDLINK (doc 02 §2.2) : un objet gardé reste inerte tant que sa
      // sentinelle existe — impossible de contourner le gardien pour rafler le
      // butin. La sentinelle défaite est retirée de `map.objects` ⇒ objet libéré.
      const guarded = 'guardedBy' in obj && obj.guardedBy !== undefined && objectIds.has(obj.guardedBy);
      if (guarded) continue;
      if (obj.type === 'resource') {
        player.resources[obj.resource as ResourceId] += obj.amount;
        removeObject(obj);
        events.push({
          type: 'ResourcePicked',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          resource: obj.resource,
          amount: obj.amount,
          pos: { ...hero.pos },
        });
        // Ramassage en passant (doc 02 §2.2, fidélité HoMM, D6) : le héros ne
        // s'arrête pas — comme la mine, il poursuit son chemin.
        continue;
      }
      // Trésor (doc 02 §2.2) : arrêt et choix or/XP en attente — l'objet n'est
      // retiré qu'à la résolution (`ResolveTreasure`).
      if (obj && obj.type === 'treasure') {
        draft.pendingTreasure = {
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          gold: obj.gold,
          xp: obj.xp,
        };
        events.push({
          type: 'TreasureFound',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          gold: obj.gold,
          xp: obj.xp,
          pos: { ...hero.pos },
        });
        options.onTreasureFound?.();
        break;
      }
      // Artefact au sol (doc 02 §2.2) : ramassé vers le 1er slot équipé libre ;
      // s'il n'y en a aucun, il tombe dans le SAC (H-ARTEQUIP — plus rien de
      // perdu au sol). Ramassé en passant (D6) : le héros ne s'arrête pas.
      if (obj && obj.type === 'artifact') {
        const slot = hero.artifacts.indexOf(null);
        if (slot !== -1) hero.artifacts[slot] = obj.artifactId;
        else (hero.backpack ??= []).push(obj.artifactId);
        removeObject(obj);
        events.push({
          type: 'ArtifactPicked',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          artifactId: obj.artifactId,
          pos: { ...hero.pos },
        });
      }
    }
  }
}
