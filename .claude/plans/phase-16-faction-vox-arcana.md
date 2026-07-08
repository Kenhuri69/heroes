# Phase 16 — Nouvelle faction : Vox Arcana (Poudlard × KPop Demon Hunters)

> Plan vivant (guidelines §5). Faction #6, **test de modularité #4**.
> État : **cadrage — validation de l'identité par les assets** (aucun code moteur, aucune donnée jouable encore).

## Concept validé (chat)

- **Fantasme** : une académie de magie où l'on chasse le démon par l'**incantation** (héritage Poudlard) *et* la **scène** (héritage HUNTR/X / KPop Demon Hunters). Ton **sérieux, mythologique**.
- **Signature** : **Les 5 Maisons** — allégeance choisie (héros/ville) qui applique un profil de bonus **déclaratif** → 1 seul point d'extension moteur générique `houseAllegiance` (jamais `if maison === …`).
- **Ressource de faction** : **Résonance (Honmoon)** — montée en combat par les unités « qui chantent », dépensée dans l'**École de la Scène**.
- **Différenciation vs Arcane Hunters** (doc 05, déjà « académie × chasse ») : AH = **Marques + Cercles + traque** ; K-MAGIX = **Maisons + Résonance + scène/Honmoon**. Palette et bestiaire distincts (néon pop + glycine + oni coréen vs runes de traque).

## Direction artistique (dérivée des visuels fournis)

- Pierre noire gothique + filigrane d'argent/or ; **cyan électrique + magenta/violet néon** ; **glycine (wisteria)** ; château gothique **+ toits de pagode coréens** ; masque d'**oni** ; chouettes/corbeaux spectraux, gargouilles.
- Nom de faction **verrouillé** : **Vox Arcana** (id `vox-arcana`) — « la voix arcane » (le sort *et* la voix). Ex-titre « K-MAGIX / Demon Tour ».

## Les 5 Maisons (signature)

| Maison | Archétype | Bonus déclaratif (à chiffrer) |
|---|---|---|
| Le Lion | courage | +Att mêlée, +Moral |
| Le Serpent | ambition | +Or/jour, accès malédictions |
| L'Aigle | savoir | +Mana, coût de sort réduit |
| Le Blaireau | loyauté | +Croissance hebdo, +Déf/PV |
| **Venari** (HUNTR/X) | scène/Honmoon | +Gain de Résonance, buffs de performance renforcés |

## Roster T1–T8 (dosage Poudlard + hunter)

T1 Chœur d'apprentis · T2 Duelliste · T3 Hippogriffe · T4 Chasseuse-Idole (HUNTR/X) ·
T5 Sombral *(validé ; swap Kumiho/Haetae possible plus tard)* · T6 Maître de Sortilèges · T7 Phénix ·
T8 Avatar du Honmoon (débloqué à Résonance max).

## Héros nommés

- **Hermione** — héroïne **Magic**, Maison de l'Aigle (savoir/incantation).
- **Rumi** — héroïne **Might/Hunter**, Maison Venari (double lame, scène/Honmoon).

## Étapes

1. Cadrage identité (ce plan) → **vérif** : validé en chat. ✅
2. Nom de faction verrouillé → **vérif** : **Vox Arcana** (`vox-arcana`). ✅
3. Base d'assets : prompts avatars Hermione & Rumi + blasons 5 Maisons + planche d'unités → **vérif** : `assets/prompts/faction-vox-arcana.md`, prompts conformes doc 12. ✅
4. Génération des visuels **(externe/Gemini — côté utilisateur)** → **vérif** : 3 planches reçues (unités T1–T8, 5 Maisons, héros Hermione & Rumi), conformes DA. ✅
   - QC + détourage + staging `assets/` (`sheet_extract`) → **vérif** : ✅ stagé,
     base complète : 2 héros, 5 blasons, **8/8 unités** (t5-sombral & t7-phenix
     regénérées sur fond gris clair puis extraites, QC verte).
5. Verrouillage du plan par les assets → **vérif** : DA + roster + 5 Maisons + héros tous lisibles et raccord ; distinction vs Arcane Hunters confirmée. ✅
6. Rédaction `docs/16-faction-vox-arcana.md` (source de vérité, guidelines §8.6) → **vérif** : doc complet façon doc 05 (lore, 5 Maisons, Résonance, École de la Scène, lineup T1–T8, bâtiments, héros, points d'extension). ✅
7. Découpage en sous-lots data-only + points d'extension (`houseAllegiance`, Résonance) → **vérif** : garde-fou « zéro faction dans le moteur » vert. ⏳ (en cours)

## Découpage pressenti (sous-lots)

- **16.1** ✅ **LIVRÉ** — `houseAllegiance` : LE nouveau point d'extension moteur générique.
  - `HeroState.houseId` + `houseEffects` (save v9→**v10**) ; effets résolus à la
    création depuis `StartGame.houseCatalog` + `PlayerSetup.startingHouseId`.
  - Injection dans `hero/skills.ts` (`sumHouseField`) : les effets de Maison
    s'agrègent au même titre que les compétences dans **chaque** accesseur
    (or/jour, mêlée/tir/armure, chance, moral, PM, vision) + réduction de mana
    **agnostique de l'école** — zéro changement chez les consommateurs, zéro nom
    de faction (l'accesseur ne lit que `hero.houseEffects`).
  - Contenu : `houseSchema`/`houseEffectSchema` (sous-ensemble réellement agrégé,
    pas de mensonge de contenu), `manifest.houses[]`, `buildHouseCatalog`,
    validation des clés de nom localisées.
  - Tests : `house-allegiance.test.ts` (moteur + contenu), `save-shape` v10,
    golden re-fixé (`50cf7842`, forme seule). Garde-fou vert, typecheck/lint OK.
  - **Écart** : le **client** ne passe pas encore `houseCatalog`/`startingHouseId`
    à `StartGame` (Maisons dormantes en jeu) → **16.2** avec les données vox-arcana.
- **16.2** — paquet `data/factions/vox-arcana/` en stub (manifeste + 1 unité T1) qui charge et passe `content:check` ; ajout à `data/factions/index.json`.
- **16.3** — lineup T1–T8 data-only (capacités génériques) + test de recrutement faction-agnostique.
- **16.4** — Résonance : `factionResources` + `gainFactionResourceOnVictory` (réutilise l'acquis Essence) ; T8 gaté par la Résonance.
- **16.5** — École de la Scène : `spellSchool: scene` + 4 sorts (effets génériques) + locales.
- **16.6** — héros Hermione & Rumi en données + staging des assets (QC `sheet_extract`).
- **Différés** : Résonance intra-combat (performeurs), barrière du Honmoon T8, renaissance Phénix, peur Sombral, unités élites.

## Écarts / décisions

- **Génération d'images indisponible dans l'environnement Claude Code** : HF Spaces `invoke` désactivé (`gradio=none`), et le procédural du projet ne couvre que tuiles/icônes — pas les personnages painterly. Les planches sont donc générées **hors environnement** (Gemini/Nano Banana), puis je fais QC + détourage + staging (`sheet_extract.py`, deps installées).
- Nom : « Vox Arcana » retenu parmi 4 propositions (vs L'Ordre du Honmoon / Sonarium / Le Chœur d'Ébène).
- T5 = Sombral (validé).
