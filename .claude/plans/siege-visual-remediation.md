# Plan — Remédiation visuelle du combat de siège

> **Source** : audit `docs/19-analyse-graphique-siege.md` (captures
> `docs/captures/siege/`). Constats validés par l'utilisateur ; ce plan est la
> feuille de route d'exécution. **Plan vivant** (guidelines §5) : cocher chaque
> étape, noter écarts et décisions au fil de l'eau.
>
> **Invariants à respecter sur TOUS les lots** (guidelines §8) : moteur sans
> faction (ids opaques), RNG seedé uniquement, moteur sans dépendance au rendu,
> touch-first, docs = source de vérité (mettre à jour `docs/02`/`08`/`12` dans
> le même commit quand un lot change l'habillage spécifié). Budget bundle
> < 800 Ko gzip (les PNG restent hors bundle via le registre d'assets).
> Un seul lot touche le moteur (S5b) — générique, zéro bump
> `CURRENT_SAVE_VERSION` attendu, golden inchangé attendu (le replay golden
> n'exerce ni machines de guerre ni siège).

## Ordre d'exécution recommandé

1. **Vague 1 — câblages purs client, gros impact/petit coût** : S2, S3, S8 ✅ (livrée)
2. **Vague 2 — assets & habillage** : S4, S1, S5a, S6
3. **Vague 3 — moteur générique + UI** : S5b, S7
4. **Vague 4 — polish & investigation** : S9

Chaque lot = une branche `claude/siege-<lot>` + une PR draft dédiée (ou un
groupe cohérent par vague), vérifiée avant push : `pnpm typecheck && pnpm lint
&& pnpm test` (golden inclus), garde-fou « zéro faction », budget bundle,
smoke ciblé. Tout nouveau test suit le skill `test-authoring`. Vérification
visuelle : rejouer la recette de l'annexe du doc 19 (état de siège forgé) et
comparer aux captures de référence.

---

## Lot S2 — Bombardement visible (P1, client seul) ✅ priorité 1 — LIVRÉ (2.1/2.3/2.4)

L'événement moteur `WallBombarded { col, row, destroyed }` existe
(`engine/combat/turns.ts`, `bombardWalls`) mais n'était pas rendu.

- [x] S2.1 `CombatScene` `animateEvent` case `WallBombarded` : **projectile**
      lobé (origine hors-champ haut-gauche du camp attaquant → hex du mur via
      `offsetToPixel`, `spawnProjectile`) + **impact** « éclats de pierre »
      (`spawnSpellImpact(..., 'damage', …)`). Coupé en reduce-motion.
- [ ] S2.2 État « mur endommagé » (overlay de fissures) — **différé** : nécessite
      un asset `combat/siege-wall-cracked` + `syncWalls` intégrant les PV dans sa
      signature (vague 2 assets).
- [x] S2.3 `destroyed: true` : `redrawBoard` (brèche élargie) + `shakeBoard`
      (effondrement), hors reduce-motion.
- [x] S2.4 Journal de combat : `combatLogText` case `WallBombarded` →
      `combatLog.wallHit` / `combatLog.wallDestroyed` (FR/EN), **unit-testé**
      (`combat-log.test.ts`).
- Vérif LIVRÉE : `combat-log.test` (mapping hit/destroyed distincts) ; le rendu
  FX réutilise `spawnProjectile` (couvert B6) + `spawnSpellImpact`. Le **smoke
  siège dédié (S-TEST)** — forge d'état lourde (IndexedDB, doc 19 annexe) —
  reste à construire comme **harnais partagé de la vague** (couvrira S1/S2/S3/S6
  en non-régression) ; noté ci-dessous. Golden inchangé (client seul).

## Lot S3 — Douve lisible (P1, client seul) — LIVRÉ (S3.1/S3.2)

- [x] S3.1 `drawBoard` (`render/hexgrid.ts`) : **cumule** — le fond de douve
      (`FILL_MOAT` à `ALPHA_MOAT_DECOR` 0.5) est posé SOUS l'hex d'état ⇒ un hex
      douve atteignable garde sa teinte fossé sous la surbrillance verte, le pip
      reste dessiné. Chemin non-douve **byte-identique** (additions gardées
      `isMoat && !isObstacle`).
- [x] S3.2 Décor + marqueur : `drawWaves` (vaguelettes déterministes, patron
      `drawBoulder`, couleur écume `WAVE_COLOR`) dessiné TOUJOURS sur un hex douve
      (2ᵉ canal non chromatique A5), même sous surbrillance.
- [ ] S3.3 Dégâts annoncés (readout « −{moatDamage} » au tap-1 sur douve) —
      **différé** : nécessite un nouvel état de prévisualisation de déplacement
      (le `combatPreview` actuel ne porte que l'estimation d'ATTAQUE). Follow-up.
- Vérif : chemin non-douve inchangé (smokes combat @core rendent le plateau) ;
  additions strictement gardées `isMoat`. Rendu douve : capture au smoke siège
  (S-TEST partagé, à venir).

## Lot S8 — Popups de dégâts (P2, client seul, trivial)

- [x] S8.1 Décaler le spawn des chiffres flottants au-DESSUS du sprite
      (ancre haute du jeton) pour ne plus recouvrir badges d'effectif ni
      voisins immédiats. → `POPUP_HEAD_OFFSET = TOKEN_RADIUS·1.55`, appliqué à
      `spawnDamageNumber` + `spawnFloatingLabel`.
- [x] S8.2 Lier la durée de vie du popup au jeton : si la pile meurt et que
      son fondu se termine, accélérer/écourter le popup orphelin (plus de
      « −38 » flottant sur herbe nue). → `spawnDamageNumber(token?)` : fondu
      écourté (~120 ms) dès `token.destroyed` ; câblé aux 5 sites (frappe,
      MoatDamaged, SpellCast, UnitSpellCast, HeroStruck).
- Vérif : captures avant/après sur la mêlée à la brèche ; aucun test dédié
  (FX purs), le smoke anti-gel couvre la non-régression. **Livré** (détail :
  `siege-s8-damage-popups.md`).

## Lot S4 — Fond de ville de siège (P1, assets + client)

- [ ] S4.1 Assets : toiles `backgrounds/siege-<factionId>.jpg` pour les
      factions livrées + une générique `backgrounds/siege.jpg` (skill
      `asset-sheet`/prompts doc 12 ; cadrage : champ devant des murailles,
      silhouette de la ville de la faction à l'horizon, gouache du projet).
      Prompts déposés dans `assets/prompts/`.
- [ ] S4.2 Client : `combatBackgroundUrl` prend un contexte — si
      `combat.townId != null`, résoudre `backgrounds/siege-<factionDeLaVille>`
      → repli `backgrounds/siege` → repli terrain actuel (`main.ts`, câblage
      du fond DOM existant, zéro moteur, id de faction opaque).
- [ ] S4.3 Doc 12 (guide assets) + doc 08 §2.4 : documenter la convention.
- Vérif : recette doc 19 ⇒ le siège Necropolis n'est plus sur prairie ;
  combats de plaine inchangés ; budget bundle inchangé (JPEG hors bundle).

## Lot S1 — Rempart continu (P1, assets + client)

- [ ] S1.1 Assets : jeu de sprites de rempart orientés colonne —
      `siege-wall-top / -mid / -bottom / -stub` (moignon détruit) + **porte**
      `siege-gate` (et variante brisée `siege-gate-breached`), même gouache
      (skill `asset-sheet`, prompts doc 12 §7).
- [ ] S1.2 `syncWalls` : choisir le sprite par position dans la colonne
      (extrémités/segments), ancrer bord-à-bord pour absorber le zigzag de
      l'offset hex (léger décalage x par parité de rangée, chevauchement
      vertical) ⇒ muraille visuellement continue.
- [ ] S1.3 Habiller l'OUVERTURE : hexes de porte (`SIEGE_GATE_ROWS`) avec le
      sprite de porte (ouverte = franchissable) ; hexes de brèche catapulte
      avec des gravats/moignons — la porte légitime et la brèche deviennent
      discernables. Les positions viennent de l'état (`siegeWalls` absents +
      géométrie connue), aucune règle nouvelle.
- [ ] S1.4 Repli gracieux conservé (aucun asset ⇒ rocher actuel).
- Vérif : captures avant/après aux manches 1 et 4 ; smoke siège (S-TEST) vert ;
  doc 08 §2.4 mis à jour.

## Lot S5a — Sprites des machines manquantes (P1, assets seuls)

- [ ] S5a.1 Produire `assets/units/core/first-aid-tent.png` et
      `assets/units/core/ammo-cart.png` (skill `asset-sheet`, planche
      « machines de guerre » cohérente avec catapulte/baliste existantes).
- [ ] S5a.2 QC : vignettes pré-combat + jetons en bataille remplacent cases
      vides/fanions (aucun code à changer — le registre auto-découvre).
- Vérif : recette doc 19, écran pré-combat sans case vide.

## Lot S5b — Placement dédié des machines (P1, **moteur générique**)

Seul lot moteur. Les machines (`warMachine`) sont placées comme des piles
ordinaires par `placeSide` (débordement du chariot en 1ʳᵉ ligne, capture 2).

- [ ] S5b.1 `placeSide`/appelants (`combat/setup.ts`) : les piles dont la déf
      porte `warMachine` sont placées sur des **emplacements réservés hors
      formation** — colonne derrière la ligne de départ du camp (attaquant :
      col 0 reste aux créatures, machines en « rangée arrière » : mêmes hexes
      qu'aujourd'hui MAIS réservés en fin de colonne sans débordement sur la
      colonne de front ; choix simple : caper la formation créatures à
      `COMBAT_ROWS − nbMachines`). Générique : décision par capacité
      `warMachine` (donnée), aucun id en dur.
- [ ] S5b.2 Tests moteur : placement avec 7 piles + 4 machines ⇒ aucune
      machine en colonne de front ; ordre de la formation créatures inchangé
      sans machines (non-régression guardian/héros-vs-héros).
- [ ] S5b.3 Docs : doc 02 §5 (placement) aligné.
- Vérif : golden **inchangé** (replay sans machines) ; 835+ tests moteur
  verts ; pas de bump save (aucune forme nouvelle) ; captures avant/après.
- ⚠️ Si l'implémentation révèle un impact replay/golden : s'arrêter et
  re-scoper avec l'utilisateur (ne pas re-fixer le golden en silence).

## Lot S6 — Tour de tir = structure (P2, client seul)

- [ ] S6.1 `buildStackToken` : une pile dont la déf porte `warMachine` +
      `immobile` côté défenseur de siège (ou marqueur d'habillage générique
      dans les données de l'unité, ex. `presentation: "structure"` — décision
      à l'implémentation, zéro id en dur) est rendue SANS ellipse de camp ni
      socle « créature » : socle de pierre procédural + sprite, badge
      d'effectif remplacé par une jauge/omission (une tour n'est pas « 1 »).
- [ ] S6.2 La tour reste ciblable/inspectable comme aujourd'hui (aucune règle
      changée) ; l'appui long garde la fiche.
- Vérif : capture avant/après ; smoke siège vert.

## Lot S7 — Pré-combat « Siège » (P2, client seul)

- [x] S7.1 `PreBattleScreen` : si `combat.townId != null`, titre
      « Siège de {faction} », blason de la faction de la ville (prioritaire sur
      la pile dominante), et rangée « défenses » : Fort niv. N + Rempart/Douve/
      Tour selon l'état (`town.buildings.fort`, `combat.siegeWalls/moat`, pile
      `defender-tower`).
- [x] S7.2 Locales FR/EN (`preBattle.siegeTitle`, `defenseFort/Wall/Moat/Tower`).
- [x] S7.3 Repli d'avatar héros (constat 3.2 du doc 19) : le médaillon de héros
      en combat affiche **l'initiale du héros** (nom localisé) au lieu du disque
      noir nu ; l'avatar chargé la recouvre. (Le repli du pré-combat utilisait
      déjà `FactionBadge`.)
- Vérif : capture avant/après ; audit i18n (0 chaîne en dur) ; doc 08 §2.4.
  **Livré** (détail : `siege-s7-precombat.md`).

## Lot S9 — Polish & investigation (P3)

- [ ] S9.1 Investiguer la surbrillance « attaquable » sur hex vide (capture 4
      du doc 19) : reproduire via la recette + rounds auto ; suspect =
      interaction mort-différée (`pendingDeathIds`)/redraw. Corriger si bug
      confirmé, sinon documenter la cause.
- [ ] S9.2 Rochers d'obstacles : remplacer le polygone procédural par des PNG
      props (patron `assets/tiles/props/`), repli procédural conservé.
- [ ] S9.3 Projectile de baliste : remplacer le trait par un carreau orienté
      (petit sprite ou forme dessinée), traînée courte.
- [ ] S9.4 Cadrage d'ouverture : marge du fit initial pour que badges des
      piles extrêmes (rangée 9) ne soient pas rognés par la barre d'actions.
- Vérif : captures ; smoke anti-gel inchangé.

## S-TEST — Couverture de test transverse (avec la vague 1)

- [ ] Un test smoke « siège » dédié (`@core`, skill `test-authoring`) : forge
      l'état de l'annexe doc 19 via `__HEROES_TEST__` (même recette IndexedDB),
      déclenche `CaptureTown`, assert : écran pré-combat visible → « Combattre »
      → un round auto → `combatFx.projectiles > 0` (S2), combat toujours
      vivant, pas de gel. Coût ~1 smoke ; couvre S1/S2/S3/S6 en non-régression.
- [ ] Étendre la recette en helper partagé si plusieurs tests l'utilisent.

## Journal des décisions

- (à remplir au fil des lots)
