# H-LEVELCHOICE — choix d'attribut à la montée de niveau (doc 02 §1.2)

> « go next » autonome après #200. Item S du backlog `game-feature-gaps.md`.
> Rend la montée de niveau **choisie** par le joueur humain (façon HoMM /
> `ChooseSkill`), au lieu du tirage auto pondéré. **File** de propositions
> (pas d'écrasement, cf. spec). L'IA garde le tirage auto (zéro régression).

## Conception
- `HeroState.pendingAttributeChoices: [Attr, Attr][]` — **file** de paires de
  propositions (save bump). Vidée par `ChooseAttribute`.
- `grantXp` (experience.ts), par niveau gagné :
  - joueur **humain** ⇒ empile une paire de 2 attributs distincts (tirés au RNG
    pondéré, déterministe) ; n'applique RIEN ; `HeroLevelUp` sans `attribute`.
  - joueur **IA** / sans contrôleur ⇒ comportement ACTUEL : `rollAttribute` +
    `attributes[attr]++` ; `HeroLevelUp` avec `attribute`.
- Commande `ChooseAttribute { heroId, attribute }` : valide (héros, file non
  vide, attribut dans la 1ʳᵉ paire) ; applique +1, défile ; émet
  `HeroAttributeChosen { heroId, attribute, level }`.
- Événements : `HeroLevelUp.attribute` devient **optionnel** ; nouvel
  `HeroAttributeChosen`. (Événements = transitoires, hors save.)
- Client : modale `AttributeChoice` (miroir `SkillChoice`), montée quand
  `pendingAttributeChoices.length > 0` ; présente la 1ʳᵉ paire. Toast au choix.
- Golden : le combat du gardien se résout AVANT la montée (XP post-combat) ⇒
  résultat inchangé ; seuls la forme (nouveau champ) + les attributs du héros
  humain (désormais en file) changent ⇒ **re-fix du hash**, assertions de valeur
  (gardien retiré, armée ∈ ]0,23], positions, ressources) préservées.

## Étapes / vérif
1. state.ts : champ + bump `CURRENT_SAVE_VERSION` + changelog → verify: typecheck.
2. events.ts : `attribute?` + `HeroAttributeChosen`.
3. experience.ts + hero/level-up.ts : `rollAttributePair`, branche humain/IA.
4. commands.ts + hero/index.ts + engine.ts : `ChooseAttribute` (validate+handle).
5. client : `AttributeChoice.tsx`, montage shell, toasts/notifications, locales.
6. save-shape : +clé, bump 17. golden : re-fix hash (run test).
7. smoke : monter le héros humain d'un niveau ⇒ modale ⇒ choix ⇒ +1 attribut.
8. Final : typecheck/lint/build, tests moteur, smoke (CI), garde « zéro faction ».

## Journal
- Livré. state v17 + `pendingAttributeChoices` (file). events : `attribute?` +
  `HeroAttributeChosen`. `rollAttributePair` + branche humain(file)/IA(auto) dans
  grantXp. Commande `ChooseAttribute` (validate `invalidAttribute`/`noPendingChoice`
  + handle). Client `AttributeChoice` (montée gate `!pendingSkillHero` → pile ≤ 2),
  toasts/notifications + locales FR/EN. Fixtures moteur + save-shape (v17, +clé).
  Golden re-fixé `879c3291` (le héros humain golden ne franchit aucun niveau ⇒
  file vide ; combat/valeurs inchangés). Tests moteur 451 verts. Smoke : gating
  d'absence des 2 modales (flux complet non déclenchable, XP trop haute — convention
  existante du repo, cf. en-tête smoke).
