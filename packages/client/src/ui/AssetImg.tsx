import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

/**
 * `<img>` d'asset avec repli gracieux (décision lot intégration) : si l'URL est
 * absente (asset non produit / renommé) ou si le chargement échoue, on rend le
 * `fallback` (picto/texte procédural existant) au lieu d'une image cassée.
 * `loading="lazy"` : les octets ne sont fetchés qu'à l'affichage effectif.
 */
export function AssetImg({
  src,
  alt,
  class: cls,
  fallback = null,
}: {
  src: string | undefined;
  alt: string;
  class?: string;
  fallback?: ComponentChildren;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    <img src={src} alt={alt} class={cls} loading="lazy" onError={() => setFailed(true)} />
  );
}
