import { useState } from 'preact/hooks';
import type { HeroState } from '@heroes/engine';
import { appStore, useApp } from '../app/store';
import { dispatch } from '../app/dispatch';
import { t, resolveUnitName, resolveArtifactName, resolveHeroName, commandErrorMessage } from '../app/i18n';
import { unitSpriteUrl, artifactUrl } from '../render/assets';
import { AssetImg } from './AssetImg';
import { reverseArmySlot, reverseArtifactSlot } from '../app/transfer-undo';
import './HeroSwap.css';

/**
 * Écran de rencontre héros ↔ héros (UX-HEROSWAP, doc 02 §1.5, doc 08 §2.3) :
 * deux colonnes, transfert **tap-tap** (pas de drag obligatoire, touch-first).
 * Taper une pile/un artefact d'une colonne l'envoie à l'AUTRE héros
 * (`TransferBetweenHeroes`, générique). « Tout donner » enchaîne les transferts.
 * « Équilibrer » (split d'une pile) est différé à UX-SPLIT.
 *
 * L'état est relu du store après chaque commande : les deux héros restent
 * référencés par id, la vue se ré-affiche sur la mutation moteur.
 */
export function HeroSwap({
  fromHeroId,
  toHeroId,
  onClose,
}: {
  fromHeroId: string;
  toHeroId: string;
  onClose: () => void;
}) {
  useApp((s) => s.locale);
  const game = useApp((s) => s.game);
  const catalog = useApp((s) => s.game.unitCatalog);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{
    from: string;
    to: string;
    kind: 'army' | 'artifact';
    slot: number;
    index: number;
  } | null>(null);
  const left = game.heroes.find((h) => h.id === fromHeroId);
  const right = game.heroes.find((h) => h.id === toHeroId);
  if (!left || !right) return null;

  const heroById = (id: string): HeroState | undefined => appStore.getState().game.heroes.find((h) => h.id === id);

  const send = (from: string, to: string, kind: 'army' | 'artifact', slot: number): void => {
    setError(null);
    setUndo(null);
    const src = heroById(from);
    const dst = heroById(to);
    dispatch({ type: 'TransferBetweenHeroes', fromHeroId: from, toHeroId: to, kind, slot })
      .then(() => {
        // LE-UX : prépare le retour arrière exact de ce transfert, s'il existe.
        const srcAfter = heroById(from);
        const dstAfter = heroById(to);
        if (!src || !dst || !srcAfter || !dstAfter) return;
        if (kind === 'artifact') {
          const back = reverseArtifactSlot(dst.artifacts, dstAfter.artifacts);
          if (back !== null) setUndo({ from: to, to: from, kind, slot: back, index: slot });
        } else {
          const back = reverseArmySlot(src.army, srcAfter.army, dst.army, dstAfter.army);
          if (back) setUndo({ from: to, to: from, kind, slot: back.slot, index: back.index });
        }
      })
      .catch((err: unknown) => setError(commandErrorMessage(err)));
  };

  const undoLast = async (): Promise<void> => {
    if (!undo) return;
    setUndo(null);
    setError(null);
    try {
      await dispatch({ type: 'TransferBetweenHeroes', fromHeroId: undo.from, toHeroId: undo.to, kind: undo.kind, slot: undo.slot });
      // La pile revient en fin d'armée : on la remet à sa place d'origine.
      const back = heroById(undo.to);
      const last = (back?.army.length ?? 0) - 1;
      if (undo.kind === 'army' && back && last !== undo.index) {
        await dispatch({ type: 'ReorderArmy', heroId: undo.to, from: last, to: undo.index });
      }
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  /** « Tout donner » : transfère toutes les piles (slot 0 se décale) puis tous les artefacts. */
  const giveAll = async (from: HeroState, to: string): Promise<void> => {
    setError(null);
    setUndo(null);
    // B14 (revue 2026-07) : relire l'état APRÈS chaque dispatch — l'état moteur
    // est immuable (immer), le `game` capturé au rendu ne change jamais : la
    // boucle ne se terminait que par l'exception `invalidTransfer` (erreur
    // affichée à tort) et la boucle d'artefacts n'était jamais atteinte.
    const fresh = (): HeroState | undefined =>
      appStore.getState().game.heroes.find((h) => h.id === from.id);
    try {
      while ((fresh()?.army.length ?? 0) > 0) {
        await dispatch({ type: 'TransferBetweenHeroes', fromHeroId: from.id, toHeroId: to, kind: 'army', slot: 0 });
      }
      const arts = fresh()?.artifacts ?? [];
      for (let i = 0; i < arts.length; i++) {
        if (arts[i] !== null) {
          await dispatch({ type: 'TransferBetweenHeroes', fromHeroId: from.id, toHeroId: to, kind: 'artifact', slot: i });
        }
      }
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  const column = (hero: HeroState, other: HeroState): preact.JSX.Element => (
    <section class="heroswap-col" data-testid={`heroswap-col-${hero.id}`}>
      <h3 class="heroswap-hero-name">{hero.name ? resolveHeroName(hero.name) : t('hero.genericName')}</h3>
      <h4 class="heroswap-section">{t('army.title')}</h4>
      <ol class="heroswap-army" data-testid={`heroswap-army-${hero.id}`}>
        {hero.army.length === 0 && <li class="heroswap-empty">{t('heroswap.empty')}</li>}
        {hero.army.map((stack, i) => (
          <li key={i}>
            <button
              type="button"
              class="heroswap-item"
              data-testid={`heroswap-army-${hero.id}-${i}`}
              aria-label={t('heroswap.giveStack', { name: resolveUnitName(stack.unitId), count: stack.count })}
              onClick={() => send(hero.id, other.id, 'army', i)}
            >
              <AssetImg
                src={unitSpriteUrl(stack.unitId, catalog[stack.unitId]?.groupId)}
                alt=""
                class="heroswap-icon"
                fallback={<span class="heroswap-item-name">{resolveUnitName(stack.unitId)}</span>}
              />
              <span class="heroswap-count">×{stack.count}</span>
            </button>
          </li>
        ))}
      </ol>
      <h4 class="heroswap-section">{t('hero.inventoryTitle')}</h4>
      <ul class="heroswap-artifacts" data-testid={`heroswap-artifacts-${hero.id}`}>
        {hero.artifacts.every((a) => a === null) && <li class="heroswap-empty">{t('heroswap.empty')}</li>}
        {hero.artifacts.map((artifactId, i) =>
          artifactId ? (
            <li key={i}>
              <button
                type="button"
                class="heroswap-item"
                data-testid={`heroswap-artifact-${hero.id}-${i}`}
                aria-label={t('heroswap.giveArtifact', { name: resolveArtifactName(artifactId) })}
                onClick={() => send(hero.id, other.id, 'artifact', i)}
              >
                <AssetImg
                  src={artifactUrl(artifactId)}
                  alt=""
                  class="heroswap-icon"
                  fallback={<span class="heroswap-item-name">{resolveArtifactName(artifactId)}</span>}
                />
              </button>
            </li>
          ) : null,
        )}
      </ul>
      <button
        type="button"
        class="heroswap-giveall"
        data-testid={`heroswap-giveall-${hero.id}`}
        onClick={() => void giveAll(hero, other.id)}
      >
        {t('heroswap.giveAll')}
      </button>
    </section>
  );

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal heroswap chrome-framed"
        role="dialog"
        aria-modal="true"
        aria-label={t('heroswap.title')}
        data-testid="heroswap"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="modal-header">
          <h2>{t('heroswap.title')}</h2>
          <button class="modal-close" data-testid="heroswap-close" aria-label={t('heroswap.close')} onClick={onClose}>
            ×
          </button>
        </header>
        {undo && (
          <button class="heroswap-undo" data-testid="heroswap-undo" onClick={() => void undoLast()}>
            {t('transfer.undo')}
          </button>
        )}
        {error && (
          <p class="heroswap-error" role="alert" data-testid="heroswap-error">
            {error}
          </p>
        )}
        <p class="heroswap-hint">{t('heroswap.hint')}</p>
        <div class="heroswap-cols">
          {column(left, right)}
          {column(right, left)}
        </div>
      </div>
    </div>
  );
}
