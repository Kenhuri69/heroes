# Plan — Asset manquant : blason de la faction Dungeon

## Constat
La faction **dungeon** est enregistrée et jouable (`data/factions/index.json`,
7ᵉ maison) avec unités et bâtiments complets, mais son **blason** manque :
- Aucune recette `dungeon` dans `tools/assets/gen_faction_badge.py`.
- Aucun fichier `assets/badges/dungeon.png`.

Les 5 autres vraies factions (haven, necropolis, arcane-hunters, sylvan-court,
vox-arcana) ont toutes leur écu. Sans asset, `FactionBadge` retombe sur le motif
géométrique générique (repli a11y) → identité visuelle absente à l'écran de ville,
au pré-combat, etc.

## Identité (doc 17 §1)
- Elfes noirs souterrains, cultes du serpent, sorciers-suzerains.
- Couleurs : **violet sombre, noir, éclats de magenta arcanique**.
- **Motif de bannière : serpent lové** (explicite doc 17 §1, non chromatique).

## Étapes
1. Vérifier le déterminisme du générateur dans cet env (regénérer un blason
   existant → octets identiques au commit). → verify: `git diff --stat` vide.
2. Ajouter une charge héraldique `_serpent` (serpent lové en spirale, corps métal
   biseauté effilé, tête + langue fourchue, halo magenta arcanique). → verify:
   fonction pure, mêmes conventions que les autres charges (signature
   `(img, d, cx, cy, r, ramp)`).
3. Ajouter la recette `"dungeon"` : champ violet sombre → noir, ramp SILVER
   (acier froid elfe noir, distinct du laiton Vox Arcana), chef magenta, charge
   `_serpent`. → verify: `dungeon` dans `RECIPES`.
4. Générer `assets/badges/dungeon.png` (256², déterministe). → verify: fichier
   présent, PNG 256×256 RGBA, re-run = octets identiques.
5. Non-régression : les 5 blasons existants restent byte-identiques (recette
   ajoutée, aucune touchée). → verify: `git status` ne montre que dungeon.png
   ajouté + le script modifié.
6. Docstring du script mis à jour (liste des factions). Doc 17 §1 déjà à jour
   (source de vérité). → verify: cohérence code ↔ doc.

## État — livré
- [x] 1. Déterminisme vérifié (regen haven → git clean).
- [x] 2. Charge `_serpent` ajoutée (spirale effilée + tête/langue + halo magenta).
- [x] 3. Recette `dungeon` ajoutée (violet sombre → noir, SILVER, chef magenta).
- [x] 4. `assets/badges/dungeon.png` généré (256² RGBA), re-run byte-identique
      (md5 `cffe14ca…`).
- [x] 5. Non-régression : `git status` = seuls le script + dungeon.png (+ ce plan).
- [x] 6. Docstring du script à jour ; doc 17 §1 déjà source de vérité.

## Gaps restants (hors périmètre — nécessitent un modèle image LLM)
La faction dungeon manque aussi de `backgrounds/town-dungeon.jpg` et des jetons
de carte `map/{hero,town,camp}-dungeon.png`. Ce sont des « pièces uniques LLM »
(pas de générateur procédural), qui **retombent gracieusement** sur un rendu
procédural. Non traités ici : ce lot ne couvre que l'asset générable
déterministiquement avec l'outillage existant (le blason, comme les 5 autres
factions).

## Décisions
- SILVER plutôt que BRASS : acier froid des elfes noirs, contraste avec l'or
  Vox Arcana (violet lui aussi) → deux écus violets restent distincts.
- Serpent dessiné en argent biseauté + accent magenta (yeux/halo) — même patron
  que crâne (vert spectral) / flèche (rune cyan) : le métal porte la forme,
  l'accent porte l'identité chromatique.
- Test navigateur (guideline §7) : asset PNG hors bundle JS, repli gracieux ⇒
  pas de nouveau chemin de code client ; couverture existante suffit. Le rendu
  se vérifie visuellement (aperçu PNG).
