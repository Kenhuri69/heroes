import { artifactSlotConflict, type ArtifactDef, type ArtifactSlot, type HeroState } from '@heroes/engine';
import { useApp } from '../app/store';
import { dispatch } from '../app/dispatch';
import { t, resolveArtifactName, resolveArtifactLore, commandErrorMessage } from '../app/i18n';
import { artifactUrl } from '../render/assets';
import { pushToast } from './toasts';
import { AssetImg } from './AssetImg';
import './HeroInventory.css';

/**
 * Ordre d'affichage de la poupée d'équipement (doc 08 §2.3, lot UXD-5b) —
 * tête → pieds. Chaque type est UNE position typée ; un 2ᵉ artefact du même
 * type (ou un artefact sans `slot`) est montré en « autres équipés ».
 */
const SLOT_ORDER: ArtifactSlot[] = [
  'head',
  'neck',
  'torso',
  'cloak',
  'weapon',
  'shield',
  'hands',
  'ring',
  'feet',
  'misc',
];

/** Contenu d'un artefact : icône (repli nom) + nom + lore optionnel. */
function ArtifactContent({ artifactId }: { artifactId: string }) {
  const lore = resolveArtifactLore(artifactId);
  return (
    <>
      <AssetImg src={artifactUrl(artifactId)} alt="" class="hero-inventory-icon" fallback={null} />
      <span class="hero-inventory-name">{resolveArtifactName(artifactId)}</span>
      {lore && <span class="content-lore hero-inventory-lore">{lore}</span>}
    </>
  );
}

/**
 * Section Équipement du tiroir héros (doc 08 §2.3, H-ARTEQUIP) : poupée à 10
 * emplacements NOMMÉS (typés par slot) + **sac** (`backpack`). Interactive quand
 * c'est au tour du héros (hors combat) : taper un artefact équipé le **déséquipe**
 * (→ sac), taper un artefact du sac l'**équipe** (→ 1er slot libre). Le
 * regroupement typé reste présentationnel : le moteur garde son tableau plat
 * `hero.artifacts` et ne lit jamais `slot`.
 */
export function HeroInventory({
  hero,
  catalog,
}: {
  hero: HeroState;
  catalog: Record<string, ArtifactDef>;
}) {
  useApp((s) => s.locale); // réactivité i18n
  // Gérable seulement pour le héros du joueur ACTIF et hors combat (mêmes
  // préconditions que la commande moteur — sinon boutons inertes/toasts).
  const manageable = useApp(
    (s) => !s.game.combat && s.game.players[s.game.currentPlayer]?.id === hero.playerId,
  );

  // Chaque type de slot reçoit le 1er artefact équipé de ce type (avec son index
  // dans `hero.artifacts`, requis pour déséquiper) ; les suivants et les artefacts
  // sans slot vont dans « autres équipés ».
  const equipped: Partial<Record<ArtifactSlot, { id: string; index: number }>> = {};
  const overflow: { id: string; index: number }[] = [];
  hero.artifacts.forEach((id, index) => {
    if (!id) return;
    const slot = catalog[id]?.slot;
    if (slot && !equipped[slot]) equipped[slot] = { id, index };
    else overflow.push({ id, index });
  });
  const backpack = hero.backpack ?? [];
  const artifactsFull = !hero.artifacts.includes(null);

  const unequip = (slot: number): void => {
    dispatch({ type: 'UnequipArtifact', heroId: hero.id, slot }).catch((err: unknown) =>
      pushToast(commandErrorMessage(err), 'error'),
    );
  };
  const equip = (index: number): void => {
    dispatch({ type: 'EquipArtifact', heroId: hero.id, index }).catch((err: unknown) =>
      pushToast(commandErrorMessage(err), 'error'),
    );
  };

  return (
    <section class="hero-inventory" data-testid="hero-inventory">
      <h3 class="hero-section-title">{t('hero.equipmentTitle')}</h3>
      <ul class="hero-equipment-doll">
        {SLOT_ORDER.map((slot) => {
          const entry = equipped[slot];
          const slotLabel = t(`hero.slot.${slot}`);
          const content = entry ? resolveArtifactName(entry.id) : t('hero.inventoryEmptySlot');
          const label = entry
            ? t('hero.slotStateUnequip', { slot: slotLabel, content })
            : t('hero.slotState', { slot: slotLabel, content });
          return (
            <li key={slot} class="hero-inventory-cell">
              {entry && manageable ? (
                <button
                  type="button"
                  class="hero-inventory-slot filled hero-inventory-action"
                  data-testid={`hero-slot-${slot}`}
                  aria-label={label}
                  onClick={() => unequip(entry.index)}
                >
                  <span class="hero-slot-label" aria-hidden="true">
                    {slotLabel}
                  </span>
                  <ArtifactContent artifactId={entry.id} />
                </button>
              ) : (
                <div
                  class={entry ? 'hero-inventory-slot filled' : 'hero-inventory-slot empty'}
                  data-testid={`hero-slot-${slot}`}
                  aria-label={label}
                >
                  <span class="hero-slot-label" aria-hidden="true">
                    {slotLabel}
                  </span>
                  {entry ? <ArtifactContent artifactId={entry.id} /> : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {overflow.length > 0 && (
        <>
          <h4 class="hero-bag-title">{t('hero.otherEquipped')}</h4>
          <ul class="hero-inventory-bag" data-testid="hero-equipped-extra">
            {overflow.map(({ id, index }) =>
              manageable ? (
                <li key={index}>
                  <button
                    type="button"
                    class="hero-inventory-slot filled hero-inventory-action"
                    aria-label={t('hero.unequipArtifact', { content: resolveArtifactName(id) })}
                    onClick={() => unequip(index)}
                  >
                    <ArtifactContent artifactId={id} />
                  </button>
                </li>
              ) : (
                <li key={index} class="hero-inventory-slot filled">
                  <ArtifactContent artifactId={id} />
                </li>
              ),
            )}
          </ul>
        </>
      )}

      <h4 class="hero-bag-title">{t('hero.bagTitle')}</h4>
      {backpack.length === 0 ? (
        <p class="hero-bag-empty" data-testid="hero-bag-empty">
          {t('hero.bagEmpty')}
        </p>
      ) : (
        <ul class="hero-inventory-bag" data-testid="hero-bag">
          {backpack.map((id, index) => {
            // H-ARTEQUIP typed slots : l'emplacement exclusif de l'artefact est
            // déjà pris ⇒ on désactive la case (préviz, pas de tap mort) avec la
            // même règle que la validation moteur.
            const conflict = artifactSlotConflict(hero, catalog, id);
            return manageable ? (
              <li key={index}>
                <button
                  type="button"
                  class="hero-inventory-slot filled hero-inventory-action"
                  data-testid={`hero-bag-item-${index}`}
                  disabled={artifactsFull || conflict}
                  aria-label={t('hero.equipArtifact', { content: resolveArtifactName(id) })}
                  title={conflict ? t('cmdError.slotOccupied') : undefined}
                  onClick={() => equip(index)}
                >
                  <ArtifactContent artifactId={id} />
                </button>
              </li>
            ) : (
              <li key={index} class="hero-inventory-slot filled">
                <ArtifactContent artifactId={id} />
              </li>
            );
          })}
        </ul>
      )}
      {backpack.length > 0 && artifactsFull && manageable && (
        <p class="hero-bag-empty">{t('hero.equipFull')}</p>
      )}
    </section>
  );
}
