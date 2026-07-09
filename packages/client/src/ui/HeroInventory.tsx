import type { ArtifactDef, ArtifactSlot, HeroState } from '@heroes/engine';
import { t, resolveArtifactName, resolveArtifactLore } from '../app/i18n';
import { artifactUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import './HeroInventory.css';

/**
 * Ordre d'affichage de la poupée d'équipement (doc 08 §2.3, lot UXD-5b) —
 * tête → pieds. Chaque type est UNE position typée ; un 2ᵉ artefact du même
 * type (ou un artefact sans `slot`) déborde dans le sac.
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

/** Contenu d'un artefact équipé : icône (repli nom) + nom + lore optionnel. */
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
 * Section Équipement du tiroir héros (doc 08 §2.3) : poupée à 10 emplacements
 * NOMMÉS (typés par slot) + sac de débordement. Lecture seule (équiper/
 * déséquiper = raffinement ultérieur). Le regroupement est purement
 * présentationnel : le moteur garde son tableau plat `hero.artifacts` et ne
 * lit jamais `slot`.
 */
export function HeroInventory({
  hero,
  catalog,
}: {
  hero: HeroState;
  catalog: Record<string, ArtifactDef>;
}) {
  // Chaque type de slot reçoit le 1er artefact équipé de ce type ; les suivants
  // et les artefacts sans slot (ou de type inconnu) vont au sac.
  const equipped: Partial<Record<ArtifactSlot, string>> = {};
  const bag: string[] = [];
  for (const artifactId of hero.artifacts) {
    if (!artifactId) continue;
    const slot = catalog[artifactId]?.slot;
    if (slot && !equipped[slot]) equipped[slot] = artifactId;
    else bag.push(artifactId);
  }

  return (
    <section class="hero-inventory" data-testid="hero-inventory">
      <h3 class="hero-section-title">{t('hero.equipmentTitle')}</h3>
      <ul class="hero-equipment-doll">
        {SLOT_ORDER.map((slot) => {
          const artifactId = equipped[slot];
          const slotLabel = t(`hero.slot.${slot}`);
          const content = artifactId ? resolveArtifactName(artifactId) : t('hero.inventoryEmptySlot');
          return (
            <li
              key={slot}
              class={artifactId ? 'hero-inventory-slot filled' : 'hero-inventory-slot empty'}
              data-testid={`hero-slot-${slot}`}
              aria-label={t('hero.slotState', { slot: slotLabel, content })}
            >
              <span class="hero-slot-label" aria-hidden="true">
                {slotLabel}
              </span>
              {artifactId ? <ArtifactContent artifactId={artifactId} /> : null}
            </li>
          );
        })}
      </ul>
      {bag.length > 0 && (
        <>
          <h4 class="hero-bag-title">{t('hero.bagTitle')}</h4>
          <ul class="hero-inventory-bag" data-testid="hero-bag">
            {bag.map((artifactId, i) => (
              <li key={i} class="hero-inventory-slot filled">
                <ArtifactContent artifactId={artifactId} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
