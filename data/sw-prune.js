// Décision d'élagage du cache d'assets du service worker (R7/P3, doc 07 §6).
//
// Script CLASSIQUE chargé par `importScripts('./sw-prune.js')` depuis `sw.js` :
// le SW reste un script classique (enregistrement inchangé), et la décision
// d'élagage devient une fonction PURE — donc testable en unitaire hors
// navigateur (`packages/client/src/app/sw-prune.test.ts`), ce que la logique
// noyée dans `sw.js` (globals `caches`/`self`) ne permettait pas.
// Publiée sur le scope global du worker, comme le veut un script classique.

/**
 * Combien d'entrées `/assets/` les PLUS ANCIENNES faut-il évincer ?
 *
 * Deux bornes CUMULÉES, éviction toujours **par ordre d'insertion** (inchangé —
 * `cache.keys()` préserve cet ordre) :
 *  - `maxEntries` : plafond du nombre d'entrées ;
 *  - `maxBytes`   : plafond du poids total (les assets peints pèsent de 400 Ko à
 *                   620 Ko pièce ⇒ le plafond d'entrées seul autorisait plusieurs
 *                   dizaines de Mo, au-delà des quotas d'origine usuels sur mobile).
 *
 * @param {number[]} sizes tailles en octets, dans l'ordre d'insertion
 * @param {number} maxEntries plafond d'entrées
 * @param {number} maxBytes plafond de poids total, en octets
 * @returns {number} nombre d'entrées de tête à supprimer (0 ≤ n ≤ sizes.length)
 */
self.selectAssetEvictions = function selectAssetEvictions(sizes, maxEntries, maxBytes) {
  let total = 0;
  for (const size of sizes) total += size;
  let drop = Math.max(0, sizes.length - maxEntries);
  for (let i = 0; i < drop; i += 1) total -= sizes[i];
  while (drop < sizes.length && total > maxBytes) {
    total -= sizes[drop];
    drop += 1;
  }
  return drop;
};
