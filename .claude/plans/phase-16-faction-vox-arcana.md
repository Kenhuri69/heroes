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
- **16.2a** ✅ **LIVRÉ** — paquet `data/factions/vox-arcana/` complet : manifeste
  (5 **Maisons** `houses[]` à effets déclaratifs, lineup T1–T8, chaîne d'habitations
  T1→T8, ville), 8 unités (capacités génériques `shooter/flying/noRetaliation`),
  `buildings.json`, locales FR/EN ; ajout à `data/factions/index.json`.
  Vérif : `content:check` + `faction:validate vox-arcana` verts, test contenu
  « la faction qui déclare des Maisons en résout un catalogue non vide » (trouvée
  par signature, sans la nommer → garde-fou vert), 89 tests contenu.
  Écart : **Résonance** (ressource) + **École de la Scène** (sorts) + spécialités
  différées ; élites différées.
- **16.2b** ✅ **LIVRÉ** — **choix de Maison via « Le Choixpeau »** (décision utilisateur : option B).
  Bâtiment exclusif (réutilise `exclusiveGroup`, façon Cercles AH) qui fixe la
  Maison de la ville et applique ses bonus au(x) héros du propriétaire.
  - **Moteur** (nouveau point générique) : effet de bâtiment déclaratif
    `houseChoice { houseId }` interprété à `BuildStructure` → résout `houseId`
    dans un `GameState.houseCatalog` (embarqué à `StartGame`) et stampe
    `houseId`/`houseEffects` sur les héros du propriétaire. `PlayerState.houseId`
    = choix canonique. Save v10→**v11** ; golden re-fixé. Zéro nom de faction
    (le moteur ne lit que `effect.houseId` opaque).
  - **Contenu** : 5 bâtiments Choixpeau (`vox-arcana-house-{lion,serpent,eagle,
    badger,venari}`, `exclusiveGroup: "vox-arcana-house"`, effet `houseChoice`),
    ajoutés à `manifest.town.buildings` + locales.
  - **Client** : passer `houseCatalog` à `StartGame` (les 3 sites) ; la sélection
    passe par l'écran de ville existant (bâtiments exclusifs déjà gérés, façon
    Cercles) ; sprites/blasons auto-découverts (doc 12 §10, zéro code).
  - Écart : héros recrutés APRÈS le choix (tavernes) — inheritance différée
    (stamp à la construction couvre le héros de départ, cas MVP).
- **16.3** — (absorbé par 16.4/16.5 : Résonance puis École de la Scène, livrés séparément).
- **16.4** ✅ **LIVRÉ** — Résonance : ressource de faction en **pur contenu**
  (zéro diff moteur), réutilise l'acquis Essence.
  - Manifeste vox-arcana : `factionResources: [{ id: resonance, cap: 999 }]` +
    `factionBonuses: [{ type: gainFactionResourceOnVictory, resource: resonance,
    amount: 10 }]` (bonus déjà interprété par `engine/faction/effects.ts`).
  - **T8 gaté** : `units/t8-avatar.json` coût `+40 resonance` (même mécanique
    que le Pénitent AH gate par l'Essence — `unit.cost` admet les ressources
    de faction).
  - Locales FR/EN : `factionResource.resonance` (Résonance / Resonance).
  - Test : `content/test/resonance-economy.test.ts` — faction trouvée **par
    signature** (déclare Maisons + ressource), assert gain-sur-victoire + T8 gaté
    + locales, jamais l'id littéral. 92 tests contenu verts.
  - Vérifs : `content:check` + `faction:validate vox-arcana` verts, typecheck/lint
    OK, 376 tests moteur (golden inchangé), garde-fou « zéro faction » vert.
  - **Écart** : génération de Résonance intra-combat (performeurs) différée ;
    icône `icons/resonance.png` non stagée ⇒ repli gracieux client (`<i/>`).
- **16.5** ✅ **LIVRÉ** — École de la Scène : école de sorts propre en **pur
  contenu** (même mécanisme que `traque` AH), zéro diff moteur.
  - Manifeste : `spellSchool: "scene"`.
  - `data/core/spells.json` : 4 sorts `scene` à effets **génériques déjà au
    moteur** — `barriere-du-honmoon` (buff `defenseMod` C1), `chant-de-courage`
    (buff `attackMod` C1), `dissonance` (debuff `attackMod` C2), `rappel`
    (`heal` C3).
  - Locales : `spell.<id>` + `.lore` FR/EN pour les 4.
  - `packages/content/src/schemas.ts` : `SPELL_SCHOOLS` (liste contrôlée de
    contenu, anti-typo) étendue de `scene` — **nom d'école, pas d'id de faction**
    (garde-fou vert), précédent identique à `traque`.
  - Client déjà générique (`SpellBook` + `game.ts` lisent `manifest.spellSchool`)
    ⇒ zéro code : un héros Vox Arcana connaît les sorts de la Scène.
  - Vérifs : `content:check` vert, typecheck/lint OK, 92 tests contenu, 376 tests
    moteur (golden inchangé), garde-fou vert, smoke.
  - **Écart** : capacités de signature (barrière de zone T8, peur, renaissance)
    différées.
- **16.6** ✅ **LIVRÉ** — avatars des héros Hermione & Rumi intégrés (staging).
  - Les planches héros (QC `sheet_extract`) étant déjà stagées (étape 4), le lot
    les rend **découvrables** par le client : renommage à la **convention
    d'archétype** `heroes/<factionId>-<might|magic>` utilisée par toutes les
    factions — Rumi (Might/Hunter) ⇒ `vox-arcana-might.png`, Hermione (Magic) ⇒
    `vox-arcana-magic.png`.
  - Zéro code, zéro donnée de manifeste : `heroAvatarUrl(factionId, archetype)`
    lit le registre auto-découvert ; le build émet bien les 2 PNG hashés.
  - **Écart** : l'**identité** nommée en jeu (nom Hermione/Rumi, spécialité,
    Maison de départ, cf. doc 16 §6) reste liée au **système de héros nommés du
    moteur**, non ouvert (différé pour toutes les factions). Le smoke par défaut
    démarre une autre faction ⇒ le rendu de l'avatar vox-arcana n'est pas
    directement exercé (couverture honnête §7) ; la convention est prouvée par
    les factions sœurs + la sortie de build.
- **Différés** : Résonance intra-combat (performeurs), barrière du Honmoon T8, renaissance Phénix, peur Sombral, unités élites.

## Écarts / décisions

- **Génération d'images indisponible dans l'environnement Claude Code** : HF Spaces `invoke` désactivé (`gradio=none`), et le procédural du projet ne couvre que tuiles/icônes — pas les personnages painterly. Les planches sont donc générées **hors environnement** (Gemini/Nano Banana), puis je fais QC + détourage + staging (`sheet_extract.py`, deps installées).
- Nom : « Vox Arcana » retenu parmi 4 propositions (vs L'Ordre du Honmoon / Sonarium / Le Chœur d'Ébène).
- T5 = Sombral (validé).
