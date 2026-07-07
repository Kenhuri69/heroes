import { useState } from 'preact/hooks';
import {
  effectiveManaCost,
  estimateSpell,
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
  const [spellId, setSpellId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<SpellEstimate | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  if (!combat) return null;
  const def = spellId ? spellCatalog[spellId] : undefined;

  const selectSpell = (id: string): void => {
    setSpellId(id);
    setTargetId(null);
    setPreview(null);
    setPreviewFailed(false);
  };

  const backToList = (): void => {
    setSpellId(null);
    setTargetId(null);
    setPreview(null);
    setPreviewFailed(false);
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
  };

  const cast = (selectedSpellId: string, selectedTargetId: string): void => {
    dispatch({ type: 'CastSpell', spellId: selectedSpellId, targetStackId: selectedTargetId })
      .then(() => onClose())
      .catch((err: unknown) => {
        // Remédiation CL3 : le sort a été REJETÉ (mana, cible, déjà lancé…) — on
        // surface l'erreur et on GARDE le livre ouvert (avant : fermé comme si le
        // sort était parti, perte silencieuse de l'action du joueur).
        pushToast(commandErrorMessage(err));
      });
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal spellbook"
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
          <SpellList hero={hero} spellCatalog={spellCatalog} skillCatalog={skillCatalog} onSelect={selectSpell} />
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
              {targetId ? formatPreview(preview, previewFailed) : t('spellbook.chooseTarget')}
            </div>
            <button
              class="spellbook-cast"
              data-testid="spell-cast"
              disabled={!targetId}
              onClick={() => targetId && cast(def.id, targetId)}
            >
              {t('spellbook.cast')}
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
  onSelect,
}: {
  hero: HeroState;
  spellCatalog: Record<string, SpellDef>;
  skillCatalog: Record<string, HeroSkillDef>;
  onSelect: (spellId: string) => void;
}) {
  const known = hero.spells
    .map((id) => spellCatalog[id])
    .filter((d): d is SpellDef => d !== undefined);

  if (known.length === 0) {
    return <p class="spellbook-empty">{t('spellbook.empty')}</p>;
  }

  return (
    <div class="spellbook-list">
      {orderedSchools(known.map((d) => d.school)).map((school) => {
        const circles = Array.from(new Set(known.filter((d) => d.school === school).map((d) => d.circle))).sort(
          (a, b) => a - b,
        );
        return (
          <section key={school} class="spellbook-school">
            <h3>{t(`school.${school}`)}</h3>
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
                            <span class="spell-name">{resolveSpellName(spellDef.id)}</span>
                            <span class="spell-cost">
                              {t('spellbook.manaCost', { cost })}
                            </span>
                            {!castable && <span class="spell-reason">{t('spellbook.notEnoughMana')}</span>}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
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
  const friendly = def.kind === 'heal' || def.kind === 'buff';
  const targets: CombatStack[] = combat.stacks.filter((s) =>
    friendly ? s.side === combat.playerSide : s.side !== combat.playerSide,
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
    default:
      return t('spellbook.previewUnavailable');
  }
}
