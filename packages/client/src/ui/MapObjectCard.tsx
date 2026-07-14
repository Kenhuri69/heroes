import { useEffect } from 'preact/hooks';
import type { MapObjectDef, VisitableEffect } from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { humanId } from '../app/game';
import { t, resolveArtifactName, resolveUnitName, resolveSpellName, resolveSkillName } from '../app/i18n';

/**
 * Fiche d'objet de carte (doc 08 §2.1 « appui long = fiche », lot M2 C6) :
 * dialogue léger alimenté par `mapCard` (posé par l'appui long de la scène).
 * La force d'un gardien reste une FOURCHETTE (doc 02 §2.2) — mêmes
 * `strengthBands` que le hint de la barre de statut, jamais l'effectif exact.
 */
export function MapObjectCard() {
  useApp((s) => s.locale);
  const object = useApp((s) => s.mapCard);
  const bands = useApp((s) => s.strengthBands);
  const human = useApp((s) => humanId(s.game));
  const close = (): void => appStore.setState({ mapCard: null });
  useEffect(() => {
    if (!object) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [object]);
  if (!object) return null;

  return (
    <div class="map-card-backdrop" onClick={close}>
      <section
        class="map-card"
        data-testid="map-card"
        role="dialog"
        aria-label={cardTitle(object)}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="map-card-header">
          <h3>{cardTitle(object)}</h3>
          <button
            type="button"
            class="map-card-close"
            data-testid="map-card-close"
            aria-label={t('mapCard.close')}
            onClick={close}
          >
            ×
          </button>
        </header>
        {cardLines(object, bands, human).map((line, i) => (
          <p key={i} class="map-card-line">
            {line}
          </p>
        ))}
      </section>
    </div>
  );
}

function cardTitle(object: MapObjectDef): string {
  switch (object.type) {
    case 'resource':
      return t(`resource.${object.resource}`);
    case 'mine':
      return t('mapCard.mineTitle', { name: t(`resource.${object.resource}`) });
    case 'guardian':
      return t('mapCard.guardianTitle');
    case 'treasure':
      return t('mapCard.treasureTitle');
    case 'artifact':
      return resolveArtifactName(object.artifactId);
    case 'visitable':
      return t('mapCard.visitableTitle');
    case 'dwelling':
      return t('mapCard.dwellingTitle');
    case 'monolith':
      return t('mapCard.monolithTitle');
  }
}

function cardLines(
  object: MapObjectDef,
  bands: { max: number | null; key: string }[],
  human: string,
): string[] {
  switch (object.type) {
    case 'resource':
      return [t('mapCard.resourceLine', { amount: object.amount, name: t(`resource.${object.resource}`) })];
    case 'mine': {
      const income = t('mapCard.mineIncome', { amount: object.amount, name: t(`resource.${object.resource}`) });
      const owner =
        object.ownerId === null
          ? t('mapCard.mineNeutral')
          : object.ownerId === human
            ? t('mapCard.mineYours')
            : t('mapCard.mineEnemy');
      return [income, owner];
    }
    case 'guardian': {
      // Même fourchette que le hint (doc 02 §2.2 — jamais l'effectif exact).
      const band = bands.find((b) => b.max === null || object.count <= b.max);
      return [
        `${band ? t(`guardianBand.${band.key}`) : ''} — ${resolveUnitName(object.unitId)}`,
        t('mapCard.guardianFight'),
      ];
    }
    case 'treasure':
      return [t('mapCard.treasureLine', { gold: object.gold, xp: object.xp })];
    case 'artifact':
      return [t('mapCard.artifactLine')];
    case 'visitable':
      return [
        visitableEffectLine(object.effect),
        t(object.frequency === 'oncePerHero' ? 'mapCard.oncePerHero' : 'mapCard.oncePerHeroPerWeek'),
      ];
    case 'dwelling':
      return [t('mapCard.dwellingLine', { name: resolveUnitName(object.unitId), stock: object.stock })];
    case 'monolith':
      return [t('mapCard.monolithLine')];
  }
}

function visitableEffectLine(effect: VisitableEffect): string {
  switch (effect.kind) {
    case 'luck':
      return t('mapCard.effectLuck', { amount: effect.amount });
    case 'movement':
      return t('mapCard.effectMovement', { amount: effect.amount });
    case 'levelXp':
      return t('mapCard.effectLevelXp');
    case 'resource':
      return t('mapCard.effectResource', { amount: effect.amount, name: t(`resource.${effect.resource}`) });
    case 'vision':
      return t('mapCard.effectVision', { amount: effect.amount });
    case 'permanentStat':
      return t('mapCard.effectPermanentStat', {
        attribute: t(`attribute.${effect.attribute}`),
        amount: effect.amount,
      });
    case 'learnSpell':
      return t('mapCard.effectLearnSpell', { spell: resolveSpellName(effect.spellId) });
    case 'grantSkill':
      return t('mapCard.effectGrantSkill', { skill: resolveSkillName(effect.skillId) });
    case 'grantWarMachine':
      return t('mapCard.effectGrantWarMachine', { machine: resolveUnitName(effect.machineId) });
    case 'restoreMana':
      return t('mapCard.effectRestoreMana');
  }
}
