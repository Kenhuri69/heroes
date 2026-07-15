import { useEffect, useState } from 'preact/hooks';
import {
  effectiveManaCost,
  estimateSpell,
  heroKnownSpellIds,
  isSpellImmune,
  spellAffectedStacks,
  spellTargetsEnemy,
  type ArtifactDef,
  type CombatState,
  type CombatStack,
  type HeroSkillDef,
  type HeroState,
  type SpellDef,
  type SpellEstimate,
  type SpellSchool,
} from '@heroes/engine';
import { useApp, appStore } from '../app/store';
import { dispatch } from '../app/dispatch';
import { t, resolveUnitName, resolveSpellName, resolveSpellLore, commandErrorMessage } from '../app/i18n';
import { pushToast } from './toasts';
import './SpellBook.css';

/**
 * Ordre d'affichage des écoles : les 5 écoles universelles d'abord, puis toute
 * école supplémentaire (école de faction, ex. `traque`) après — dérivé du
 * catalogue (C1), plus jamais d'école omise du grimoire.
 */
const BASE_SCHOOL_ORDER: SpellSchool[] = ['fire', 'water', 'earth', 'air', 'neutral'];
function schoolRank(school: SpellSchool): number {
  const i = BASE_SCHOOL_ORDER.indexOf(school);
  return i === -1 ? BASE_SCHOOL_ORDER.length : i;
}
function orderedSchools(schools: SpellSchool[]): SpellSchool[] {
  return Array.from(new Set(schools)).sort((a, b) => schoolRank(a) - schoolRank(b) || (a < b ? -1 : 1));
}

/**
 * Livre de sorts en combat (doc 08 §2.3/§2.4) : sélection d'un sort connu →
 * choix de la cible → prévisualisation OBLIGATOIRE (`estimateSpell`, sans
 * RNG) → confirmation (`CastSpell`). `estimateSpell`/`CastSpell` sont des
 * stubs tant que le lot K (moteur) n'a pas livré : tout appel est encapsulé
 * en try/catch, jamais de crash côté UI.
 */
export function SpellBook({ hero, onClose }: { hero: HeroState; onClose: () => void }) {
  useApp((s) => s.locale); // réactivité i18n
  const combat = useApp((s) => s.game.combat);
  const spellCatalog = useApp((s) => s.game.spellCatalog);
  const skillCatalog = useApp((s) => s.game.skillCatalog);
  const artifactCatalog = useApp((s) => s.game.artifactCatalog);
  const [spellId, setSpellId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<SpellEstimate | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  // C-SPELLUI.3 : à la fermeture du livre (démontage), purge la prévisualisation
  // de zone sur la grille — filet de sécurité quel que soit le chemin de sortie
  // (cast, croix, tap hors modale, fin de combat).
  useEffect(() => () => appStore.setState({ combatSpellZone: null }), []);

  if (!combat) return null;
  const def = spellId ? spellCatalog[spellId] : undefined;

  const selectSpell = (id: string): void => {
    setSpellId(id);
    setTargetId(null);
    setPreview(null);
    setPreviewFailed(false);
    appStore.setState({ combatSpellZone: null });
  };

  const backToList = (): void => {
    setSpellId(null);
    setTargetId(null);
    setPreview(null);
    setPreviewFailed(false);
    appStore.setState({ combatSpellZone: null });
  };

  const selectTarget = (stackId: string, selectedSpellId: string): void => {
    setTargetId(stackId);
    try {
      setPreview(estimateSpell(appStore.getState().game, selectedSpellId, stackId));
      setPreviewFailed(false);
    } catch {
      // Prévisualisation indisponible pour cette cible (dégradation d'affichage,
      // pas une action) — on l'indique dans l'UI sans lever d'exception.
      setPreview(null);
      setPreviewFailed(true);
    }
    // C-SPELLUI.3 : surligne la zone d'effet sur la grille (sauf téléportation,
    // qui a son propre flux de ciblage d'hex `combatSpellTarget`).
    appStore.setState({
      combatSpellZone:
        spellCatalog[selectedSpellId]?.kind === 'teleport' ? null : { spellId: selectedSpellId, targetStackId: stackId },
    });
  };

  const cast = (selectedSpellId: string, selectedTargetId: string): void => {
    // F-SCHOOLS.8 (Pas de Brume) : un sort de téléportation exige une DESTINATION
    // sur la grille. On n'a que la pile alliée ici — on entre en mode ciblage
    // d'hex (le tap sur le plateau dispatchera `CastSpell{…, targetHex}`).
    if (spellCatalog[selectedSpellId]?.kind === 'teleport') {
      appStore.setState({ combatSpellTarget: { spellId: selectedSpellId, targetStackId: selectedTargetId } });
      onClose();
      return;
    }
    dispatch({ type: 'CastSpell', spellId: selectedSpellId, targetStackId: selectedTargetId })
      .then(() => onClose())
      .catch((err: unknown) => {
        // Remédiation CL3 : le sort a été REJETÉ (mana, cible, déjà lancé…) — on
        // surface l'erreur et on GARDE le livre ouvert (avant : fermé comme si le
        // sort était parti, perte silencieuse de l'action du joueur).
        pushToast(commandErrorMessage(err), 'error');
      });
  };

  // C-SPELLUI.3 : sur l'écran de ciblage, la modale se dock en bas (fond
  // transparent) pour révéler le plateau où la zone d'effet est surlignée.
  const targeting = def && def.kind !== 'teleport';

  return (
    <div class={`modal-backdrop${targeting ? ' spellbook-targeting' : ''}`} onClick={onClose}>
      <div
        class={`modal spellbook${targeting ? ' targeting' : ''}`}
        data-testid="spellbook-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('spellbook.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('spellbook.title')}</h2>
          <button
            class="modal-close"
            data-testid="spellbook-close"
            aria-label={t('options.close')}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <p class="spellbook-mana">{t('hero.mana', { mana: hero.mana, manaMax: hero.manaMax })}</p>

        {!def ? (
          <SpellList hero={hero} spellCatalog={spellCatalog} skillCatalog={skillCatalog} artifactCatalog={artifactCatalog} onSelect={selectSpell} />
        ) : (
          <div class="spellbook-targets">
            <button class="spellbook-back" onClick={backToList}>
              {t('spellbook.back')}
            </button>
            <h3>{resolveSpellName(def.id)}</h3>
            {resolveSpellLore(def.id) && (
              <p class="content-lore" data-testid="spell-lore">
                {resolveSpellLore(def.id)}
              </p>
            )}
            <TargetList
              def={def}
              combat={combat}
              targetId={targetId}
              onSelect={(stackId) => selectTarget(stackId, def.id)}
            />
            <div class="spell-preview" data-testid="spell-preview">
              {targetId
                ? def.kind === 'teleport'
                  ? t('spellbook.chooseDestination')
                  : formatPreview(preview, previewFailed)
                : t('spellbook.chooseTarget')}
            </div>
            {/* C-SPELLUI.2 : un sort de zone (splash/all/chaîne) touche plusieurs
                piles — on liste lesquelles (source moteur pure `spellAffectedStacks`)
                pour que le joueur voie l'étendue avant de confirmer. */}
            {targetId && (def.area || def.chain) && <SpellZone spellId={def.id} targetId={targetId} />}
            <button
              class="spellbook-cast"
              data-testid="spell-cast"
              disabled={!targetId}
              onClick={() => targetId && cast(def.id, targetId)}
            >
              {def.kind === 'teleport' ? t('spellbook.pickHex') : t('spellbook.cast')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Liste des sorts connus, groupés par école puis par cercle (doc 08 §2.3). */
function SpellList({
  hero,
  spellCatalog,
  skillCatalog,
  artifactCatalog,
  onSelect,
}: {
  hero: HeroState;
  spellCatalog: Record<string, SpellDef>;
  skillCatalog: Record<string, HeroSkillDef>;
  artifactCatalog: Record<string, ArtifactDef>;
  onSelect: (spellId: string) => void;
}) {
  // C-SPELLUI.1 : école affichée (feuilletage par onglets, doc 08 §2.3). `useState`
  // AVANT tout retour anticipé (règle des hooks) ; le défaut se résout au rendu.
  const [activeSchool, setActiveSchool] = useState<SpellSchool | null>(null);

  // H-ARTEQUIP.2 : le grimoire liste aussi les sorts enseignés par les artefacts.
  const known = heroKnownSpellIds(hero, artifactCatalog)
    .map((id) => spellCatalog[id])
    .filter((d): d is SpellDef => d !== undefined);

  if (known.length === 0) {
    return <p class="spellbook-empty">{t('spellbook.empty')}</p>;
  }

  const schools = orderedSchools(known.map((d) => d.school));
  // L'école active peut devenir invalide (héros dont le grimoire change) → repli
  // déterministe sur la 1re école ordonnée.
  const school = activeSchool && schools.includes(activeSchool) ? activeSchool : schools[0]!;
  const circles = Array.from(new Set(known.filter((d) => d.school === school).map((d) => d.circle))).sort(
    (a, b) => a - b,
  );

  return (
    <div class="spellbook-list">
      <div class="spellbook-tabs" role="tablist" aria-label={t('spellbook.schoolsLabel')}>
        {schools.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={s === school}
            class={`spellbook-tab${s === school ? ' active' : ''}`}
            data-testid={`spellbook-tab-${s}`}
            onClick={() => setActiveSchool(s)}
          >
            {t(`school.${s}`)}
          </button>
        ))}
      </div>
      <section class="spellbook-school" role="tabpanel" aria-label={t(`school.${school}`)}>
        {circles.map((circle) => (
          <div key={circle} class="spellbook-circle">
            <h4>{t('spellbook.circle', { circle })}</h4>
            <ul class="spell-list">
              {known
                .filter((d) => d.school === school && d.circle === circle)
                .map((spellDef) => {
                  // C2 : coût EFFECTIF (réduction Magie par école, A6) — pas le
                  // coût brut : sinon un sort lançable s'affiche grisé et le coût est faux.
                  const cost = effectiveManaCost(hero, skillCatalog, spellDef);
                  const castable = hero.mana >= cost;
                  return (
                    <li key={spellDef.id}>
                      <button
                        class={`spell-item${castable ? '' : ' spell-item-disabled'}`}
                        data-testid={`spell-${spellDef.id}`}
                        disabled={!castable}
                        onClick={() => onSelect(spellDef.id)}
                      >
                        <span class="spell-name">
                          {resolveSpellName(spellDef.id)}
                          {spellDef.area === 'splash' && (
                            <span class="spell-area" data-testid={`spell-area-${spellDef.id}`}>
                              {' '}
                              {t('spellbook.area')}
                            </span>
                          )}
                        </span>
                        <span class="spell-cost">{t('spellbook.manaCost', { cost })}</span>
                        {!castable && <span class="spell-reason">{t('spellbook.notEnoughMana')}</span>}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

/** Cibles possibles pour le sort sélectionné : piles ennemies (dégâts/debuff) ou alliées (soin/buff). */
function TargetList({
  def,
  combat,
  targetId,
  onSelect,
}: {
  def: SpellDef;
  combat: CombatState;
  targetId: string | null;
  onSelect: (stackId: string) => void;
}) {
  // Un sort qui ne vise pas l'ennemi (soin/buff/rally) cible le camp du joueur —
  // source unique partagée avec le moteur (F-SCHOOLS.6 : `rally` = allié).
  const friendly = !spellTargetsEnemy(def.kind);
  const unitCatalog = useApp((s) => s.game.unitCatalog);
  // Cibles vivantes et non furtives seulement (B40 — même filtre que
  // `UnitSpellModal`) ; une pile ennemie immunisée aux sorts (CAP-SPELLIMMUNE)
  // n'est pas ciblable par un sort hostile (parité avec la validation moteur).
  const targets: CombatStack[] = combat.stacks.filter(
    (s) =>
      s.count > 0 &&
      !s.stealthed &&
      (friendly
        ? s.side === combat.playerSide
        : s.side !== combat.playerSide && !isSpellImmune(unitCatalog, s.unitId)),
  );

  if (targets.length === 0) {
    return <p class="spellbook-empty">{t('spellbook.noTargets')}</p>;
  }

  return (
    <ul class="spell-target-list">
      {targets.map((stack) => (
        <li key={stack.id}>
          <button
            class={`spell-target${targetId === stack.id ? ' selected' : ''}`}
            data-testid={`spell-target-${stack.id}`}
            onClick={() => onSelect(stack.id)}
          >
            {resolveUnitName(stack.unitId)} ×{stack.count}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * C-SPELLUI.2 : liste des piles touchées par un sort de zone (splash/all/chaîne),
 * ordre de résolution. Source unique moteur (`spellAffectedStacks`, la même que
 * la résolution et la préviz agrégée) ⇒ zéro géométrie hex réimplémentée.
 */
function SpellZone({ spellId, targetId }: { spellId: string; targetId: string }) {
  const affected = spellAffectedStacks(appStore.getState().game, spellId, targetId);
  if (affected.length <= 1) return null; // mono-cible effective : rien à annoncer
  return (
    <p class="spell-zone" data-testid="spell-zone">
      <span class="spell-zone-label">{t('spellbook.zone')}</span>{' '}
      {affected.map((s) => `${resolveUnitName(s.unitId)} ×${s.count}`).join(', ')}{' '}
      <span class="spell-zone-count">{t('spellbook.zoneCount', { count: affected.length })}</span>
    </p>
  );
}

/** Texte de prévisualisation obligatoire (doc 08 §2.4) — « — » si l'estimation a échoué (stub lot K). */
function formatPreview(est: SpellEstimate | null, failed: boolean): string {
  if (failed || !est) return t('spellbook.previewUnavailable');
  switch (est.kind) {
    case 'damage':
      return t('spellbook.previewDamage', { amount: est.amount, kills: est.kills });
    case 'heal':
      return t('spellbook.previewHeal', { amount: est.amount });
    case 'buff':
      return t('spellbook.previewBuff');
    case 'debuff':
      return t('spellbook.previewDebuff');
    case 'applyMarks':
      return t('spellbook.previewMarks');
    case 'dispel':
      return t('spellbook.previewDispel', { count: est.amount });
    case 'cure':
      return t('spellbook.previewCure', { count: est.amount });
    case 'resurrectFull':
      return t('spellbook.previewResurrect', { count: est.amount });
    case 'summon':
      return t('spellbook.previewSummon', { count: est.amount });
    default:
      return t('spellbook.previewUnavailable');
  }
}
