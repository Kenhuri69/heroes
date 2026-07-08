# Plan — Lot M2 : Carte — jours chiffrés, annulation, fiches d'objets (C5*, C7, C6)

> Deuxième lot du plan `.claude/plans/ux-revue-mmho.md` (après M1, PR #140
> mergée). Périmètre ajusté : le lot C-3 (#124) a livré le **compte de jours
> réel** de la préviz (couleur verte/jaune/orange par jour) — reste le point
> A5 : la couleur est le **seul** canal. Client seul, zéro diff moteur.

## Constats traités

- **C5\* (P0, résiduel A5)** : la préviz de chemin encode le jour par la seule
  couleur (`render/pathPreview.ts:11-16`) — ajouter des **étiquettes
  numériques** aux points d'arrêt de chaque journée.
- **C7 (P0)** : pas de bouton « Annuler le déplacement » (doc 08 §3) — la
  préviz ne s'efface qu'en tapant ailleurs, geste non découvrable.
- **C6 (P0)** : aucune fiche d'objet de carte (doc 08 §2.1 « appui long sur
  tout objet = fiche ») ; `render/mapObjects.ts` est purement visuel et le
  client n'a **aucun geste d'appui long** (`input/pointer.ts` : tap seul).

## Étapes

1. **Geste `onLongPress`** (`input/pointer.ts`) : timer ~450 ms, annulé si
   déplacement > 8 px, second pointeur ou relâche anticipée — même patron que
   `onTap` (désabonnement symétrique). Fonctionne souris ET tactile (doc 08
   §1.1 : parité).
   → *Vérif* : smoke appui long (mouse down / wait / up).
2. **Étiquettes de jours** (`render/pathPreview.ts`) : au dernier pas de chaque
   journée, étiquette « J2 »/« J3 »… (formatteur i18n injecté par la scène —
   le module de rendu ne dépend pas d'i18n). Rien sur un chemin d'un seul
   jour (pas de bruit). `PathPreview` expose un `container` (points + textes).
   → *Vérif* : visuel (capture chemin multi-jours) ; A5 levé sur ce point.
3. **Annuler le déplacement** : la scène publie `pathPreviewActive` dans le
   store ; bouton DOM (≥ 44 px) dans le HUD bas, visible pendant la préviz,
   émet `heroes:cancel-path` (même patron que `heroes:new-game`) — la scène
   efface la préviz. Pas d'undo post-exécution (doc 08 §3 : une révélation a
   pu avoir lieu — le doc reste la règle).
   → *Vérif* : smoke tap → bouton visible → clic → préviz effacée.
4. **Fiche d'objet de carte** : appui long sur une tuile **explorée** portant
   un objet ⇒ `mapCard` (store) → composante DOM `MapObjectCard` (dialogue
   léger : titre par type, contenu par type — ressource/quantité, mine
   revenu + propriétaire (vous/adversaire/neutre), gardien **fourchette de
   force** (mêmes `strengthBands` que le hint, doc 02 §2.2 : jamais l'effectif
   exact) + nom d'unité, trésor or/XP au choix, artefact nom résolu,
   habitation nom + stock, lieu de bonus effet + fréquence). Fermeture ×/
   backdrop/Échap. Villes différées à M7 (en-tête de ville, C21).
   → *Vérif* : smoke appui long sur la mine (3,6) de proto-01 ⇒ fiche visible.
5. **Locales FR/EN + doc 08 §2.1** (état M2) + journal des plans.

## Vérifications de sortie

- [x] Typecheck 5/5 + lint + garde-fou couleurs + contenu (83).
- [x] Smoke : 2 nouveaux tests verts desktop + mobile (annulation, fiche à
      l'appui long — en mobile le test PAN d'abord : la tuile tombe sous le
      HUD bas). Suite complète : 108 passés ; les 2 tests de fluidité ×4 ont
      échoué UNIQUEMENT sous la charge de scripts concurrents et repassent
      isolés (contention CPU, hors périmètre).
- [x] Captures : étiquettes D1/D2 aux points d'arrêt (locale EN), fiche de
      mine (« +1000 Gold/day … Neutral — step on it to capture it »),
      bouton « Annuler le déplacement » visible pendant la préviz.

## Journal

- 2026-07-08 : plan ouvert (M1 mergé #140, branche repartie de main).
- 2026-07-08 : étapes 1–5 livrées. Geste `onLongPress` (450 ms, annulé par
  pan/pinch/relâche) ; étiquettes de jours dans `PathPreview` (formatteur
  i18n injecté, `container` points + textes) ; `pathPreviewActive` +
  `mapCard` au store ; bouton « Annuler le déplacement » (événement
  `heroes:cancel-path`) ; `MapObjectCard` (7 types d'objets, fourchette de
  force gardien, garde brouillard) ; 24 clés de locale FR/EN ; doc 08 §2.1.
  Écart : préviz de chemin rendue SOUS le brouillard (préexistant — les pas
  en zone inexplorée sont masqués) ; noté, pas traité ici. Marge du smoke
  appui long portée à 900 ms (setTimeout retardé sous charge CI).
