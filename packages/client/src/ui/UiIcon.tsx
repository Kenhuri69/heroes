import type { ComponentChildren } from 'preact';
import { uiIconUrl } from '../render/assets';
import { AssetImg } from './AssetImg';

/**
 * Icône d'action/onglet du design system (UXD-2) : résout `assets/ui/<id>_*.png`
 * (recettes procédurales `act-*` / `tab-*` de gen_ui_icons.py) avec repli sur le
 * glyphe texte historique si l'asset manque. Toujours décorative (`alt=""`) :
 * le sens est porté par le libellé ou l'`aria-label` du bouton hôte (doc 08 §4).
 * Taille unique 20 px (classe `.ui-icon`), mipmap 24 réduit par le navigateur.
 */
export function UiIcon({ id, fallback }: { id: string; fallback: ComponentChildren }) {
  return (
    <AssetImg
      src={uiIconUrl(id, 20)}
      alt=""
      class="ui-icon"
      fallback={<span class="ui-icon-fallback" aria-hidden="true">{fallback}</span>}
    />
  );
}
