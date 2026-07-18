import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState, HeroState, PlayerState, ResourceId } from '../core/state';

/**
 * Joueurs co-participants d'un butin coop (E4.3) : le lead d'abord, puis les
 * joueurs DISTINCTS des héros propriétaires survivants (`coopHeroIds`). Hors coop
 * (`coopHeroIds` vide/absent) ⇒ le seul lead ⇒ split trivial bit-identique.
 */
function rewardPlayers(
  draft: GameState,
  lead: HeroState,
  coopHeroIds: readonly string[] | undefined,
): PlayerState[] {
  const leadPlayer = draft.players.find((p) => p.id === lead.playerId);
  if (!leadPlayer) return [];
  const result: PlayerState[] = [leadPlayer];
  const seen = new Set<string>([leadPlayer.id]);
  for (const heroId of coopHeroIds ?? []) {
    const ally = draft.heroes.find((h) => h.id === heroId);
    if (!ally || seen.has(ally.playerId)) continue;
    const player = draft.players.find((p) => p.id === ally.playerId);
    if (player) {
      result.push(player);
      seen.add(player.id);
    }
  }
  return result;
}

/**
 * Partage égal d'un montant divisible (or/ressource) entre les joueurs
 * participants — reste au **lead** (index 0), somme exacte préservée,
 * déterministe. n=1 ⇒ le lead reçoit tout (bit-identique).
 */
function distributeEqually(
  players: PlayerState[],
  total: number,
  credit: (p: PlayerState, amount: number) => void,
): void {
  const n = players.length;
  if (n === 0 || total <= 0) return;
  const share = Math.floor(total / n);
  players.forEach((p, i) => {
    const amount = i === 0 ? total - share * (n - 1) : share;
    if (amount > 0) credit(p, amount);
  });
}

/**
 * Butin de gardien (doc 02 §2.2) — crédité à la **victoire** d'un combat de
 * gardien, avant le retrait de l'objet de la carte (appelé depuis
 * `applyConsequences`, à côté de `rewardHuntContract`).
 *
 * **Générique & déterministe** : tous les tirages passent par `draft.rng`
 * (ordre fixe : or → ressource → artefact) ; le moteur ne lit que des ids de
 * ressource/artefact **opaques** issus de `config.guardianReward`, jamais un
 * nom de faction (README §1). Piloté par la config — absente ⇒ **no-op** (aucun
 * tirage RNG ⇒ fixtures/golden épargnés).
 *
 * La force du gardien = ses **PV totaux** (`hp × count`) grade le butin : de
 * l'or toujours, une ressource au-delà d'un seuil, une chance d'artefact au-delà
 * d'un seuil plus haut (« artefact au niveau élevé »).
 */
export function rewardGuardianDefeat(
  draft: GameState,
  hero: HeroState,
  guardianObjectId: string,
  events: GameEvent[],
  /**
   * Coop (E4.3) : héros co-participants (survivants) dont le butin DIVISIBLE
   * (or/ressource) se partage également entre leurs joueurs ; l'artefact
   * (indivisible) reste au lead. Absent/solo ⇒ tout au lead (bit-identique).
   */
  coopHeroIds?: readonly string[],
): void {
  const reward = draft.config?.guardianReward;
  if (!reward) return;
  const guardian = draft.map?.objects.find((o) => o.id === guardianObjectId);
  if (!guardian || guardian.type !== 'guardian') return;
  const player = draft.players.find((p) => p.id === hero.playerId);
  if (!player) return;
  const players = rewardPlayers(draft, hero, coopHeroIds);
  const unitDef = draft.unitCatalog[guardian.unitId];
  const strength = (unitDef?.stats.hp ?? 0) * guardian.count;
  if (strength <= 0) return;

  // Or : base × PV totaux, modulé par une variance seedée ±variancePercent.
  const varRoll = rollRange(draft.rng, -reward.variancePercent, reward.variancePercent);
  draft.rng = varRoll.state;
  const gold = Math.max(0, Math.round(strength * reward.goldPerHp * (1 + varRoll.value / 100)));
  // Coop (E4.3) : or partagé également entre les joueurs participants (reste au
  // lead) ; solo ⇒ tout au lead (bit-identique).
  distributeEqually(players, gold, (p, amount) => {
    p.resources.gold += amount;
  });

  // Ressource : au-delà du seuil, une ressource non-or tirée dans la liste.
  let resource: string | null = null;
  let resourceAmount = 0;
  if (strength >= reward.resourceThresholdHp && reward.resources.length > 0) {
    const pick = rollRange(draft.rng, 0, reward.resources.length - 1);
    draft.rng = pick.state;
    resource = reward.resources[pick.value] ?? null;
    const amt = rollRange(draft.rng, reward.resourceAmount.min, reward.resourceAmount.max);
    draft.rng = amt.state;
    resourceAmount = amt.value;
    // Coop (E4.3) : ressource partagée comme l'or (reste au lead).
    if (resource) {
      const rid = resource as ResourceId;
      distributeEqually(players, resourceAmount, (p, amount) => {
        p.resources[rid] += amount;
      });
    }
  }

  // Artefact : au-delà d'un seuil plus haut, une chance de tomber un artefact du
  // catalogue (« sur niveau élevé »). Clés triées ⇒ tirage déterministe.
  let artifactId: string | null = null;
  if (strength >= reward.artifactThresholdHp) {
    const chance = rollRange(draft.rng, 0, 99);
    draft.rng = chance.state;
    const catalogIds = Object.keys(draft.artifactCatalog).sort();
    if (chance.value < reward.artifactChancePercent && catalogIds.length > 0) {
      const pick = rollRange(draft.rng, 0, catalogIds.length - 1);
      draft.rng = pick.state;
      artifactId = catalogIds[pick.value] ?? null;
      if (artifactId) {
        // Comme le ramassage d'artefact au sol (movement.ts) : 1er slot équipé
        // libre, sinon le SAC (rien de perdu).
        const slot = hero.artifacts.indexOf(null);
        if (slot !== -1) hero.artifacts[slot] = artifactId;
        else (hero.backpack ??= []).push(artifactId);
      }
    }
  }

  events.push({
    type: 'GuardianVanquished',
    heroId: hero.id,
    playerId: player.id,
    objectId: guardianObjectId,
    gold,
    resource,
    resourceAmount,
    artifactId,
  });
}
