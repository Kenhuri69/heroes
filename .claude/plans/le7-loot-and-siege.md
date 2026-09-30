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

1. [ ] C3 moteur/contenu — `rarity` 4 + `relic`, `effects`, `value` ; exclusions
   (gardien, marchand, mapgen) ; tests (effet d'artefact agrégé, relique jamais
   au butin ni au marchand, mapgen : relique seulement en grande banque).
2. [ ] C3 données — catalogue ~40, locales FR/EN, `content:check`.
3. [ ] D3 moteur — config, siège avec héros, conséquences, fuite, déplacement,
   IA ; tests.
4. [ ] Client : rien de spécifique attendu (vérifier siège avec héros en smoke).
5. [ ] Docs 02 + CLAUDE.md ; mesures (bench IA, `faction:sim`) ; vérifications.

## 4. Mesures

_À remplir._

## 5. Vérifications

- [ ] `pnpm typecheck` · `pnpm lint` · `pnpm build` (client, `exactOptionalPropertyTypes`)
- [ ] `pnpm test` ; golden inchangé
- [ ] `pnpm content:check` ; garde-fous faction et couleurs
- [ ] suite Playwright complète

## 6. Journal

- 2026-09-30 : plan ouvert. Panoplies déjà livrées ⇒ C3 se concentre sur la
  rareté, les effets de règle et le catalogue.
