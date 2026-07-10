# Nettoyage de la dérive des prompts de planches — plan vivant

Découvert en travaillant les assets des lieux de bonus (PR #185) : régénérer
`assets/prompts/` avec `tools/assets/gen_prompts.py` révèle que les fichiers
committés ont **dérivé des données** (`data/`). Cause : l'ajout de la faction
**vox-arcana** (6ᵉ maison) et de contenu depuis la dernière régénération —
plusieurs familles dépassent désormais 8 sujets et sont éclatées en `-p1/-p2`
par le générateur, mais les anciens fichiers monoplanche sont restés committés.

Le générateur est **correct et data-driven** ; ce sont ses **sorties committées**
qui sont périmées. Le lot = régénérer et réconcilier (zéro changement de code
générateur). **Aucun diff moteur, aucun asset image** (fichiers .md seulement).

## 1. Constat (diff régénération vs committé)

Distinction cruciale — certains prompts sont **manuels** (pas d'en-tête
« Générée par gen_prompts.py ») et NE DOIVENT PAS être touchés :
- Manuels (conservés) : `audio-music`, `audio-sfx`, `faction-vox-arcana`,
  `props-forest`.

Fichiers **générés** à réconcilier :
- **Périmés à supprimer** (monoplanche remplacée par `-p1/-p2`) :
  `hero-avatars`, `map-props`, `mines`, `units-arcane-hunters`, `units-haven`,
  `units-necropolis`.
- **Nouveaux à ajouter** : `buildings-sylvan-court`, `units-vox-arcana`, et les
  planches éclatées `hero-avatars-p1/p2`, `map-props-p1/p2`, `mines-p1/p2`,
  `units-arcane-hunters-p1/p2`, `units-haven-p1/p2`, `units-necropolis-p1/p2`,
  `units-sylvan-court-p1/p2`.
- **Modifiés (régénération data-driven légitime)** : `backgrounds` (terrains),
  `buildings-arcane-hunters-p2`, `map-heroes` (héros vox-arcana ⇒ 4×1→4×2),
  `units-test-faction` (2 unités ⇒ 1×1→2×1).

## 2. Étapes & vérifications

1. [x] Régénérer (`gen_prompts.py`) et calculer stale/new/modified par diff de
   listes → verif : les 4 manuels distingués par l'en-tête et exclus.
2. [x] Vérifier que les fichiers modifiés reflètent bien une évolution de `data/`
   (échantillon `map-heroes`, `units-test-faction`) → verif : diffs cohérents.
3. [x] `git rm` les 6 générés périmés ; `git add` les nouveaux + modifiés ;
   laisser les 4 manuels intacts → verif : `git status` = uniquement des .md
   d'`assets/prompts/`, aucun manuel touché.
4. [x] Re-régénérer une 2ᵉ fois ⇒ **aucun diff** (idempotence : preuve que le
   committé est enfin aligné sur le générateur).
5. [x] Commit + push (même branche désignée) + MAJ description PR #185.

## 3. Décisions & écarts

- **Pas de changement de `gen_prompts.py`** : la dérive est dans les sorties, pas
  le générateur. On aligne les sorties.
- **Fichiers manuels préservés** : `audio-*`, `faction-vox-arcana`, `props-forest`
  n'ont pas l'en-tête « Générée par » — hors périmètre du générateur, laissés
  tels quels (les supprimer serait une perte de contenu rédigé à la main).
- **Même branche/PR** que les assets (harness : branche désignée
  `claude/map-generation-resources-5mh7ei`) — lot documenté par ce plan et un
  commit dédié ; `map-props` (villes vox-arcana) réconcilié ici puisque c'est de
  la vraie dérive, cohérent avec le générateur complet de la branche.
- **Purement documentaire/outillage** (fichiers .md de prompts) : le smoke n'est
  pas requis (guideline §7) — aucun code exécutable touché. Idempotence du
  générateur = critère de vérification tenant lieu de non-régression.
