import type { HeroState } from '@heroes/engine';
import { t, resolveArtifactName, resolveArtifactLore } from '../app/i18n';
import { artifactUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import './HeroInventory.css';

const ARTIFACT_SLOTS = 10;

/**
 * Section Inventaire du tiroir héros (doc 08 §2.3) : 10 slots d'artefacts,
 * lecture seule (équiper/déséquiper = raffinement ultérieur). `hero.artifacts`
 * peut être vide/plus court que 10 tant que le lot K/L n'a pas livré.
 */
export function HeroInventory({ hero }: { hero: HeroState }) {
  const slots = Array.from({ length: ARTIFACT_SLOTS }, (_, i) => hero.artifacts[i] ?? null);
  return (
    <section class="hero-inventory" data-testid="hero-inventory">
      <h3 class="hero-section-title">{t('hero.inventoryTitle')}</h3>
      <ul class="hero-inventory-slots">
        {slots.map((artifactId, i) => (
          <li key={i} class={artifactId ? 'hero-inventory-slot filled' : 'hero-inventory-slot empty'}>
            {artifactId ? (
              <>
                <AssetImg
                  src={artifactUrl(artifactId)}
                  alt=""
                  class="hero-inventory-icon"
                  fallback={null}
                />
                <span class="hero-inventory-name">{resolveArtifactName(artifactId)}</span>
                {resolveArtifactLore(artifactId) && (
                  <span class="content-lore hero-inventory-lore">{resolveArtifactLore(artifactId)}</span>
                )}
              </>
            ) : (
              t('hero.inventoryEmptySlot')
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
