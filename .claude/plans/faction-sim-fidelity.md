# Lot — Fidélité de `faction:sim` (équilibrage passe 2, prérequis)

> Direction utilisateur : « ajoute les éléments manquants à la simulation
> nécessaires pour avoir un avis juste » puis « les deux (matrice + gauntlet) ».
> Plutôt que tuner les stats de faction contre un sim aveugle à la moitié des
> mécaniques, on **rend le sim fidèle** — ensuite seulement on décidera d'un
> éventuel tuning.

## Diagnostic (mesuré)

Le sim actuel (`faction:sim`) résout **un duel unique valeur-égale** via le vrai
moteur (`StartCombat`+`AutoCombat`). Donc **déjà fidèle** pour tout ce qui est
intra-combat : `lifeDrain`, `rebirth` (Phénix), heals de `spellcaster` unité,
tir/vol/marques/ripostes. Les vrais trous sont **structurels** :

- ❌ **Nécromancie** (`raiseUndeadOnVictory`) : relève des squelettes *après* la
  victoire, dans l'armée du héros vainqueur — un duel unique ne peut pas valoriser
  « des unités gratuites gardées pour le combat suivant ». Le sim classe Necro
  **dernière (30.7 %)** alors que c'est toute son identité. **Trou majeur.**
- ❌ **Héros** : le sim n'en a aucun ⇒ ni attaque de héros, ni sorts, ni effets de
  faction post-victoire (qui exigent un héros + un joueur).
- ⚠️ **Résonance/Essence** : gagnées en combat, **dépensées hors combat**
  (recrutement gaté). Un sim de combat pur n'a nulle part où les dépenser ⇒ reste
  hors périmètre (limitation assumée ; sous-estime seulement Vox, déjà trop fort).

## Approche

Ajouter **UN** primitif moteur pur et faction-agnostique, puis composer deux
sorties dans l'outil. **Golden-safe** (ne touche ni stats de faction ni unités
synthétiques du golden), **pas de bump `CURRENT_SAVE_VERSION`** (le sim construit
un état ad hoc, ne sérialise rien).

### 1. Moteur — `simulateHeroCombat` (combat/simulate.ts)

Primitif **stateless** d'un combat **héros-vs-héros** auto-résolu :
`(catalog, config, factionCatalog, challenger{army,factionId}, opponent{army,factionId}, seed)`
→ `{ winner, challengerArmy }`. Construit un état ad hoc (2 joueurs + 2 héros,
`factionId` posé), appelle `beginHeroCombat` + `runAutoCombat`, lit le vainqueur
et **l'armée reconstruite du challenger** (survivants **+ relève nécromancienne**
appliquée par `applyHeroVsHeroConsequences`/`applyFactionVictoryEffects`). Le
moteur ne lit que des `factionId` opaques ⇒ garde-fou « zéro faction » intact.

### 2. Outil — deux mesures composées à partir du primitif (faction-sim.ts)

- **Duel valeur-égale** (existant, conservé) : winrate par paire — canari de stats.
- **Matrice d'attrition** : pour (A,B), A (armée budget + report) enchaîne des
  vagues d'un B **frais plein-budget** ; profondeur = nb de B vaincus avant wipe.
  Report des survivants + squelettes entre vagues ⇒ **valorise la nécromancie et
  la dominance**. Moyenné sur quelques graines. Rapporté A↔B.
- **Gauntlet de survie** (leaderboard) : chaque faction (budget + report) affronte
  une **rotation escaladante** des armées valeur-égale des AUTRES factions (vagues
  ×count croissantes) ; score = vagues survécues. Réutilise le contenu existant,
  même yardstick pour toutes ⇒ comparable. Trie décroissant.

## Étapes & vérification

1. `simulateHeroCombat` + export `@heroes/engine`. → verify : test unitaire moteur
   (nécromancie relève bien en report ; un duel neutre rend un vainqueur cohérent
   avec `simulateAutoCombat`). Golden **inchangé** (unités synthétiques).
2. Outil : matrice d'attrition + gauntlet, sorties lisibles + note limitation
   résonance. → verify : `pnpm faction:sim` produit les 3 sections ; runtime
   raisonnable (background).
3. Recette complète : typecheck -r · lint · engine test (golden) · content test ·
   content:check · garde-fous faction+couleurs · build -r · bundle · smoke @core.
4. Doc : noter l'outillage dans doc 06 §5.6 (ou 09) + CLAUDE.md ; **aucun** verdict
   de tuning dans ce lot (mesure d'abord).

## Journal
- [x] Diagnostic mesuré (matrice fraîche : Vox 71.5 % / Necro 30.7 % ; 4 béances)
- [x] Primitif moteur `simulateHeroCombat` + test (4 cas, dont preuve de relève
      nécromancienne en report). Golden inchangé (833 tests, +4).
- [x] Outil (3 sections) — 1ʳᵉ passe : vagues plein-budget ⇒ profondeurs écrasées
      à 0-1 (pas de discrimination). **Correctif** : vagues FRACTIONNELLES
      croissantes (`WAVE_BASE 0.3 + WAVE_STEP 0.2·n`) ⇒ le sustain compound ;
      `factionId` adverse exact par vague (Haven a un `combatBonus` passif).
- [x] Mesure : gauntlet discrimine (Necro 2ᵉ/3ᵉ, **plus jamais dernière** —
      correction robuste inter-schémas ; Vox = burst, pas confirmé sur-sustain).
- [ ] Recette verte + doc + PR draft (en cours)
