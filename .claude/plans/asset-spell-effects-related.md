# Plan — Assets « sort effet icône & éléments liés » (murs, unités invoquées)

Branche : `claude/asset-sort-related-elements-rdr8jq`

## Contexte

Le combat rend aujourd'hui :
- le **grimoire** (`SpellBook.tsx`) en **liste texte seule** (aucune icône de sort) ;
- les **effets de sorts** (buff/debuff/silence/poison/marque/immobilisation/furtivité)
  sans **aucun badge visible** sur le jeton d'unité (`CombatScene.ts` ne pose que la
  pastille d'effectif) ;
- les **murs de siège** (`combat.siegeWalls`) comme de simples **rochers** d'obstacle
  (`drawBoulder` de `hexgrid.ts`), indistincts des obstacles de champ ;
- l'**unité invoquée** (`elementaire-de-terre` de `invocation-elementaire`) via le
  **repli procédural** de jeton (aucun sprite dédié `units/core/`).

Aucune famille d'asset « sorts / effets / murs / invocations » n'existe dans
`docs/12-assets-style-guide.md` : c'est un **nouveau lot d'assets**.

Le registre `packages/client/src/render/assets.ts` auto-découvre tout PNG de `assets/`
(`import.meta.glob ?url`, hors bundle JS) ⇒ déposer un fichier nommé par convention le
branche, avec **repli procédural gracieux** (patron `AssetImg` / `getTexture`).

## Décision utilisateur

- **Périmètre** : les 4 familles (icônes de sorts, badges d'effet sur unités, murs de
  siège, unités invoquées).
- **Méthode** : **procédural (Python/PIL) d'abord** (ce plan, phase 1), **phase 2 LLM**
  tracée ci-dessous.

## Invariants (guidelines §8)

- **Zéro diff moteur** : données/assets + client uniquement. Le moteur ne gagne aucune
  règle ni aucune faction en dur.
- **Pas de bump `CURRENT_SAVE_VERSION`** (aucune forme sérialisée touchée).
- **Golden inchangé** (aucun replay ne dépend du rendu).
- **Garde-fou « zéro faction dans `packages/` »** vert (clés d'asset opaques).
- **Repli procédural** : tout asset absent retombe sur l'affichage procédural existant
  (jamais d'image cassée).

---

## Phase 1 — Procédural (Python/PIL) + câblage client

### Étape 1 — Générateur procédural `tools/assets/gen_spell_assets.py`
Style `gen_ui_icons.py` (déterministe, mipmaps LANCZOS, silhouette + liseré + rehaut).
Produit 4 familles :

1. **Icônes de sorts** `assets/spells/<school>-<kind>.png` (mipmaps 64/48/32/24).
   - Palette **par école** (fire/water/earth/air/neutral/traque/scene/lumiere/prime) ;
   - glyphe **par type** (`kind` : damage/heal/buff/debuff/dispel/cure/applyMarks/
     silence/banish/rally/stealth/teleport/summon/resurrectFull/adventure) ;
   - un fichier par couple `(school, kind)` **réellement présent** dans
     `data/core/spells.json` (art unique par fichier, pas de doublon).
2. **Badges d'effet** `assets/ui/status-<name>.png` (mipmaps 32/24/16, lisibles ≥16px) :
   `buff`, `debuff`, `silence`, `poison`, `mark`, `immobilized`, `stealth`.
3. **Mur de siège** `assets/combat/siege-wall.png` (512²) — segment de rempart en pierre.
4. **Unité invoquée** `assets/units/core/elementaire-de-terre.png` (512²) — élémentaire
   de terre rocheux, cohérent avec les sprites d'unité core (512²).

- Vérif : `python3 tools/assets/gen_spell_assets.py` génère les PNG + `_preview.png`
  sans erreur ; tailles conformes.

### Étape 2 — Résolveurs de registre (`render/assets.ts`)
- `spellIconUrl(school, kind, px)` → `spells/<school>-<kind>` (mipmap).
- `statusIconUrl(name, px)` → `ui/status-<name>` (mipmap).
- `siegeWallUrl()` → `combat/siege-wall`.
- (`unitSpriteUrl` couvre déjà `units/core/elementaire-de-terre` — rien à ajouter.)
- Vérif : `pnpm --filter @heroes/client typecheck`.

### Étape 3 — Grimoire : icône par sort (`SpellBook.tsx`)
- Poser `<AssetImg src={spellIconUrl(def.school, def.kind)} …>` devant chaque entrée
  de sort et sur l'en-tête de l'écran de ciblage ; repli = aucune image (état actuel).
- CSS `.spell-icon` (taille via `rem`, a11y 3 crans).
- Vérif : typecheck + lint ; le repli laisse le grimoire fonctionnel.

### Étape 4 — Badges d'effet sur jetons (`CombatScene.ts`)
- Dériver de la pile les statuts actifs (net buff/debuff des `statuses`, `silenced`,
  `damagePerRound`>0 ⇒ poison, `marks`>0, `immobilizedRounds`>0, `stealthed`).
- Rangée de petits sprites au-dessus du jeton (texture `statusIconUrl`, repli disque
  coloré procédural), mise à jour à chaque `syncStacks`.
- Vérif : smoke (les badges apparaissent quand un statut est actif ; pas de crash sans
  asset).

### Étape 5 — Mur de siège rendu distinct (`CombatScene.ts`)
- Calque « murs » : sur chaque hex de `combat.siegeWalls`, poser le sprite
  `siegeWallUrl()` (repli = rocher actuel `drawBoulder`, inchangé pour les obstacles
  de champ).
- Vérif : smoke siège (le rempart s'affiche ; les obstacles de champ restent rochers).

### Étape 6 — Doc 12 + smoke + vérifs finales
- `docs/12-assets-style-guide.md` : nouvelle **famille S** (sorts/effets/murs/invocations),
  conventions de nommage, note « repli procédural » + renvoi phase 2 LLM.
- Étendre `tests/smoke.spec.ts` : présence d'au moins une icône de sort dans le grimoire
  et d'un badge d'effet (ou repli) sans erreur.
- Vérifs : `typecheck`, `lint`, `pnpm --filter @heroes/engine test` (golden + garde-fous),
  `content:check`, budget bundle, smoke headless.
- Commit + push + PR draft.

---

## Phase 2 — Montée en fidélité par LLM (planches d'images) — À FAIRE ULTÉRIEUREMENT

Le procédural (phase 1) donne des placeholders lisibles et branchés ; la fidélité
visuelle finale passera par des **planches LLM** (skill `asset-sheet`, doc 12 §10),
**sans aucun changement de code** (mêmes clés de fichier ⇒ substitution par simple
dépôt de PNG, repli procédural en attendant).

Prompts **rédigés** (staging `assets/prompts/`, prêts à coller — grille, ids row-major,
commande d'extraction exacte + post-traitement mipmaps) :
- `spells-icons-p1.md` — 16 icônes de sorts (écoles fire/water/earth/air), grille 4×4.
- `spells-icons-p2.md` — 20 icônes (neutral/traque/scene/lumiere/prime), grille 5×4.
  (Couples (école, type) dérivés de `data/core/spells.json` → 36 icônes au total.)
- `combat-status-badges.md` — 7 badges d'état (buff/debuff/silence/poison/mark/
  immobilized/stealth), grille 7×1, façon badges de jeu lisibles à 16px.
- `combat-siege-wall.md` — segment de rempart de pierre (image unique, `process_sprite.py`).
- `units-summoned.md` — 4 élémentaires (terre câblé aujourd'hui ; air/feu/eau stagés
  en avance), grille 4×1, style planche d'unités.

QC/découpe via `sheet_extract.py` → `assets/spells/`, `assets/ui/`, `assets/combat/`,
`assets/units/core/` (mêmes noms qu'en phase 1). **Icônes** (spells/status) : mipmaps à
générer après extraction (`_<64|48|32|24>` / `_<32|24|16>`, snippet dans chaque prompt)
OU repli non suffixé à ajouter aux résolveurs (choix d'implémentation). **Mur/invocation**
(512² uniques) : drop-in direct. Aucun câblage : phase 2 = art seul.

> ⚠️ **Un point de câblage restant pour un drop-in 100 % « déposer le PNG »** : les
> résolveurs `spellIconUrl`/`statusIconUrl` exigent le suffixe de mipmap. Soit
> l'art LLM est mipmappé au post-traitement (fourni), soit on ajoute un repli non
> suffixé aux deux résolveurs (petit diff client, à décider en ouvrant la phase 2).

### Phase 2 — 1ʳᵉ passe d'art LLM (planches reçues)

Extraction via `sheet_extract.py` (QC verte) + circular-mask ad hoc pour les
médaillons. **Intégré** (remplace le procédural / ajoute) :
- **Badges d'effet** (7/7, planche 7×1 propre) → `assets/ui/status-*_{32,24,16}` mipmappés.
- **Mur de siège** (image unique) → `assets/combat/siege-wall.png` (floodfill tol 42,
  pierre chaude ≠ gris de fond).
- **Élémentaires** terre/feu/eau (planche 4×1, `--tol 55` pour ôter les panneaux gris
  internes) → `assets/units/core/`. Seul `elementaire-de-terre` est câblé ; feu/eau stagés.

**Différé (re-génération nécessaire)** — planches non conformes au découpage auto :
- **Icônes de sorts p1/p2** : la planche p1 a des **libellés texte incrustés**, des
  **doublons** (Earth-Buff, Fire-Damage) et **fire-debuff manquant** ; p2 = grille 7 col.
  avec icônes en trop et **sans libellé** (mapping impossible). Livrer un grimoire
  moitié-LLM/moitié-procédural serait incohérent ⇒ **on garde le procédural (36/36)**
  et on **re-génère** avec prompts durcis (« aucun texte, grille stricte, pas de
  doublon/manquant » — `spells-icons-p1/p2.md` mis à jour).
- **Élémentaire d'air** : corps trop translucide/pâle sur panneau gris ⇒ mangé au
  détourage (rembg indisponible : téléchargement du modèle bloqué 403 via le proxy).
  Re-gen sur fond plat unique + corps plus dense (`units-summoned.md` durci).

### Phase 2 — 2ᵉ passe (icônes de sorts re-générées)

Planches p1/p2 re-générées (prompts durcis). L'image LLM ne respecte **toujours pas**
le compte/l'ordre exacts (p1 = 15 au lieu de 16 ; p2 = 29 avec doublons), mais **sans
libellé externe** ⇒ détourables. Méthode : détection de médaillons (composantes
connexes rondes) + **masque circulaire géométrique** (robuste : garde tout le jeton
quelle que soit sa couleur, ôte les voisins par un rayon serré) + **mapping index→id
vérifié à l'œil** (couleur d'école + motif d'effet, doublons/spurious filtrés) →
planche de contrôle relue avant intégration.
- **33/36 icônes de sorts** intégrées (mipmaps 64/48/32/24, remplacent le procédural).
- **3 gardent le procédural** (absentes des planches) : `earth-damage`, `earth-summon`,
  `fire-debuff` — à combler par une petite planche de 3 ultérieurement.
Budget 332/800 Ko, smoke grimoire OK (l'icône du sort est bien rendue).

---

## Journal
- **Étape 1 ✅** — `tools/assets/gen_spell_assets.py` : 36 icônes de sorts
  (couples école/type lus dans `spells.json`) × 4 mipmaps, 7 badges d'effet × 3
  mipmaps, `combat/siege-wall.png` (512²), `units/core/elementaire-de-terre.png`
  (512²), + `_preview.png`. Généré sans erreur.
- **Étape 2 ✅** — résolveurs `spellIconUrl` / `statusIconUrl` / `siegeWallUrl`
  dans `render/assets.ts` (clés opaques ; `unitSpriteUrl` couvre déjà l'invocation
  via le repli core).
- **Étape 3 ✅** — `SpellBook.tsx` : `<AssetImg class="spell-icon">` par entrée de
  sort + en-tête de ciblage ; CSS `.spell-icon` en `rem` (a11y). Repli = sans icône.
- **Étape 4 ✅** — `CombatScene.updateStatusBadges` : rangée de badges au-dessus du
  jeton (buff/debuff/mark/immobilized/silence/poison/stealth), dérivée de l'état pur
  de la pile ; repli disque coloré. Reconstruite sur changement de signature.
- **Étape 5 ✅** — `CombatScene.syncWalls` : `wallLayer` pose le sprite de rempart
  sur les hexes `siegeWalls` (recouvre le rocher) ; repli = rocher `drawBoulder`.
- **Étape 6 ✅** — doc 12 : famille **S** ajoutée (table §0 + section §6quinquies).
  Smoke `@core` du grimoire étendu (assertion `img.spell-icon`).
- **Vérifs** : `typecheck` ✓, `lint` ✓, engine `897 tests` ✓ (golden inchangé,
  garde-fous verts), `content:check` ✓, garde-fou faction (aucun ID dans
  `packages/src`) ✓, build ✓ + budget bundle **331 Ko / 800 Ko** ✓, smoke combat
  (`grimoire` + 5 combats) ✓.
- **Couverture** : les murs de siège et l'unité invoquée ne sont exercés par aucun
  smoke existant (pas de scénario de siège ni de sort d'invocation dans la suite) —
  ils résolvent via les résolveurs (repli gracieux vérifié au typecheck/lint/build),
  non via une assertion de rendu Pixi (non assertable en smoke DOM, cf. skill
  test-authoring). Le grimoire est couvert en DOM ; les badges d'effet transitent par
  les combats smoke sans crash.
- **Phase 2 (LLM)** : non entamée — tracée ci-dessus, art seul, mêmes clés de fichier.
