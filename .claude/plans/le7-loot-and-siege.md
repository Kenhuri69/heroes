# LE7 — Butin & siège

> Dernier lot du plan `game-experience-enrichment.md` (§4) : **C3** (artefacts qui
> font rêver) puis **D3** (siège avec héros visiteur). Décisions adoptées par
> l'utilisateur le 2026-09-29 (§5, point 14) ; amendements de l'expert repris
> (§3.1 C3 : rareté + artefacts qui changent une règle, reliques réservées aux
> grandes banques ; D3 : piles du héros d'abord, surplus en garnison qui tombe
> avec la ville).

## 1. Constat (lu dans le code)

- **Panoplies déjà livrées** (H-ARTEQUIP sets : `set { id, pieces, bonus }`,
  agrégées par `heroArtifactBonus`) : l'« étape 2 » de C3 est acquise.
- 16 artefacts, rareté 1–3 lue par le seul mapgen. Les banques réservent déjà la
  rareté maximale du catalogue à la grande banque, mais le butin de gardien et
  le marchand tirent dans **tout** le catalogue : un artefact de fond de carte
  tombe d'un gardien du seuil ou s'achète au 1ᵉʳ marché.
- Les artefacts ne portent que des stats plates + 4 drapeaux (immunités,
  résistance, sort). Aucun ne touche au vocabulaire d'effets des compétences
  (Sorcellerie, Mysticisme, Diplomatie, Économie…) : pas d'artefact « qui change
  une règle » au sens HoMM (Bourse sans fond, Orbe des tempêtes…).
- `buildArtifactCatalog` ne recopie pas `value` (prix marchand) : champ mort.
- Siège : un héros du propriétaire posté dans une ville à garnison **ne combat
  pas** (il n'apporte que ses bonus de mur) ; une ville sans garnison occupée par
  un héros donne un combat héros contre héros **en rase campagne** (pas de murs),
  puis une 2ᵉ commande pour prendre la ville.

## 2. Décisions de conception

### C3 — artefacts qui font rêver

- **Rareté 4 « relique »** (`rarity` 1–4 au schéma). Le loader pose
  `relic: true` sur l'`ArtifactDef` moteur. Une relique ne sort **que** de la
  grande banque : exclue du butin de gardien, du stock du marchand et du
  placement ordinaire du mapgen.
- **Effets de règle** : `effects?` sur l'artefact, même vocabulaire scalaire que
  les compétences (`SkillRankEffect`, champs numériques). Agrégés par
  `heroEffectTotal` (Sorcellerie, Intelligence, Résistance, Mysticisme,
  Artillerie, Premiers soins, Balistique, Diplomatie) et `heroGoldPerDay`
  (Économie) — mêmes points de lecture, aucun nouveau branchement de combat.
- `value` recopié par le loader (prix des artefacts à effets sans stats).
- Catalogue porté à ~40 : stats par rareté, artefacts à effet, 5 reliques,
  1 panoplie de plus.

### D3 — siège avec héros visiteur

- Opt-in `adventure.siegeVisitingHero: true` (absent ⇒ comportement actuel).
- Un héros **du propriétaire** posté sur sa ville la défend au siège :
  - camp défenseur = armée du héros + ses machines, puis les piles de garnison
    dans les emplacements libres (cap `heroArmyCap`), murs, douve et tour compris ;
  - piles de garnison marquées `fromGarrison` (jamais fusionnées avec celles du
    héros, pour savoir à qui rendre les survivants) ; le surplus reste en
    garnison hors combat.
- Conséquences :
  - l'assaillant gagne ⇒ conséquences héros contre héros (le défenseur meurt,
    dépouille) **et** la ville tombe avec tout ce qui restait en garnison ;
  - le défenseur gagne ⇒ l'assaillant meurt, le héros reprend ses survivants,
    la garnison ses survivants + le surplus ;
  - l'assaillant fuit ⇒ même répartition des restes.
- Marcher sur le héros posté dans sa ville (au lieu de `CaptureTown`) mène au
  même siège.
- IA : `townDefenseStrength` compte l'armée du héros posté quand la règle est
  active.

## 3. Étapes

1. [x] C3 moteur/contenu — `rarity` 4 + `relic`, `effects`, `value` ; exclusions
   (gardien, marchand, mapgen) ; tests (effet d'artefact agrégé, relique jamais
   au butin ni au marchand, mapgen : relique seulement en grande banque).
2. [x] C3 données — catalogue ~40, locales FR/EN, `content:check`.
3. [x] D3 moteur — config, siège avec héros, conséquences, fuite, déplacement,
   IA ; tests.
4. [x] Client : rien de spécifique (le rendu de combat lit déjà `defenderHeroId`) ;
   forge de test `startSiege({ defender: true })` + smoke.
5. [x] Docs 02 + CLAUDE.md ; mesures (bench IA, `faction:sim`) ; vérifications.

## 4. Mesures

**Bench IA** (jetable, non commité ; 2 IA, 64², 20 graines, 60 jours, normal ;
LE5 et LE6 actifs dans les deux colonnes ; « sans LE7 » = 16 artefacts d'origine
et règle de siège absente) :

| | Sans LE7 | **Avec LE7** |
|---|---|---|
| Artefacts détenus en fin de partie (20 parties) | 35 | 37 |
| … dont artefacts à effet de règle | — | 4 |
| … dont reliques | — | 0 |
| Villes de joueur prises | 0 | 0 |
| Combats de gardien (perdus) | 313 (21) | 313 (21) |
| Parties avec un combat entre joueurs | 7/20 | 7/20 |

Lecture :
- Effet quasi nul sur la partie IA contre IA : l'IA ne prend jamais de ville de
  joueur en 60 jours, donc le siège avec héros n'est pas exercé par l'IA (il
  l'est par les tests et le smoke) ; elle ne vide aucune grande banque, donc
  aucune relique. C3 et D3 servent surtout le joueur humain et la fin de partie.
- Les artefacts neufs remplacent des anciens au même rythme de ramassage.

**`faction:sim`** : 1 béance au duel, inchangé (les duels n'emploient ni artefact
ni siège).

## 5. Vérifications

- [x] `pnpm typecheck` · `pnpm lint` · `pnpm build` ; budget **384 530 o gzip**
- [x] `pnpm test` — moteur **1105** (+12), contenu 197 (+3), client 109, serveur 10 ; golden inchangé
- [x] `pnpm content:check` ; garde-fous faction et couleurs
- [ ] suite Playwright complète

## 6. Journal

- 2026-09-30 : plan ouvert. Panoplies déjà livrées ⇒ C3 se concentre sur la
  rareté, les effets de règle et le catalogue.
- 2026-09-30 : C3 et D3 livrés. Écarts et décisions :
  - les effets d'artefact sont restreints aux champs que le moteur lit déjà par
    `heroEffectTotal` / `heroGoldPerDay` (schéma strict) : pas de nouveau point de
    lecture en combat ;
  - un artefact doit garder un `bonus` non vide (règle de schéma existante) :
    chaque artefact à effet porte aussi un petit bonus de stat ;
  - D3 : les piles de garnison ne fusionnent pas avec celles du héros (pour rendre
    les survivants au bon propriétaire) ; la tour de tir est marquée comme
    garnison ;
  - D3 : pas de renforts ni de coop au siège avec héros (combat entre joueurs,
    `defenderHeroId` non nul) ;
  - ajouter du contenu d'artefact change les cartes générées à graine égale (la
    palette grandit) — comme tout ajout de contenu ; le code v1/v2 reste
    reproductible à contenu égal.
