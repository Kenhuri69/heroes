import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState, HeroState, ResourceId } from '../core/state';

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
): void {
  const reward = draft.config?.guardianReward;
  if (!reward) return;
  const guardian = draft.map?.objects.find((o) => o.id === guardianObjectId);
  if (!guardian || guardian.type !== 'guardian') return;
  const player = draft.players.find((p) => p.id === hero.playerId);
  if (!player) return;
  const unitDef = draft.unitCatalog[guardian.unitId];
  const strength = (unitDef?.stats.hp ?? 0) * guardian.count;
  if (strength <= 0) return;

  // Or : base × PV totaux, modulé par une variance seedée ±variancePercent.
  const varRoll = rollRange(draft.rng, -reward.variancePercent, reward.variancePercent);
  draft.rng = varRoll.state;
  const gold = Math.max(0, Math.round(strength * reward.goldPerHp * (1 + varRoll.value / 100)));
  player.resources.gold += gold;

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
    if (resource) player.resources[resource as ResourceId] += resourceAmount;
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
