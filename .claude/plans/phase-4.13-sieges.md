# Plan — Alpha 4.13 : sièges v1 (fondation : combat de ville + murs)

> Item roadmap suivant (doc 09 Phase 2). **Constat de cadrage** : le combat
> contre une ville **défendue** n'existe pas — `CaptureTown` rejette une ville à
> garnison (« la prise par combat arrive en 3.5 », jamais livrée). C'est le
> prérequis des sièges. Ce lot livre la **fondation** : attaquer une ville
> défendue ⇒ combat contre sa garnison ⇒ victoire = capture. Plus une
> représentation **minimale des murs** (bonus de défense de Fort). Tour de garde
> + catapulte = tranche tactique suivante (v2).

## Conception (générique, réutilise le moteur de combat)
- `CombatState.townId: string | null` (+ `wallDefenseBonus: number`).
- `beginTownCombat(draft, heroId, townId, events)` (jumeau de `beginGuardianCombat`) :
  attaquant = armée du héros **+ machines de guerre** ; défenseur = **garnison** de
  la ville ; terrain = `terrainAt(townPos)` ; `wallDefenseBonus` dérivé du niveau
  de Fort construit (données core `config`… ou constante) — **générique**.
- `CaptureTown` : une ville défendue (garnison > 0), héros présent, ne rejette
  plus → **démarre le combat de ville** (au lieu de capturer). Ville sans garnison
  = capture immédiate (inchangé).
- `applyConsequences` (fin de combat) : victoire de l'attaquant avec `townId` ⇒
  **capture** (transfert de propriété, garnison vidée), survivants → armée du
  héros ; défaite ⇒ héros retiré (inchangé). `evaluateOutcome` derrière.
- **Murs** : `wallDefenseBonus` ajouté à la défense effective des piles
  défenseure dans `combat/damage.ts` (bonus plat, généralisable à tout combat
  avec murs). Un Fort niveau N ⇒ +k·N défense.

## Lots (piloté — surfaces interdépendantes)
- [x] Moteur : `CombatState.townId`/`wallDefenseBonus`, `beginTownCombat`,
  rewire `CaptureTown`, capture dans `applyConsequences`, bonus mur dans le calcul
  de dégâts. Tests unitaires (`town-siege.test.ts`, 5 cas : combat + bonus mur ;
  victoire ⇒ capture + garnison vidée ; défaite ⇒ héros retiré + survivants
  réécrits ; ville sans garnison ⇒ capture immédiate ; armée vide ⇒ `invalidArmy`).
  Golden **inchangé** (état de combat transitoire, nullifié en fin de replay).
- [x] Client : villes rendues sur la carte (`TownsLayer`, liseré doré =
  assiégeable) ; marcher sur une ville non possédée dispatch `CaptureTown` ⇒
  siège si défendue (`tryCaptureTownAt` dans le tap-handler) ; toast capture
  existant. Villes **neutres** de la carte matérialisées depuis les objets `town`
  (schéma `factionId`/`garrison` optionnels ; `newGameCommand`/`scenarioStartCommand`).
- [x] Smoke : marcher sur une ville neutre défendue ⇒ combat ⇒ auto ⇒ capture
  (desktop + mobile). Docs 02 §4.1 + roadmap 09. Plan à jour.

## Écarts / décisions constatés
- **Prérequis manquant confirmé** : le humain n'avait **aucun** chemin de capture
  de ville côté client (seules ses villes de départ étaient affichées, via le
  shell). Le lot livre donc aussi le rendu des villes sur la carte + la capture
  par déplacement (générique humain ; l'IA garde son chemin `captureTown` direct).
- **Pas de bump `CURRENT_SAVE_VERSION`** : `townId`/`wallDefenseBonus` sont de
  l'état de combat transitoire ; une ville neutre est un `TownState`
  (`ownerPlayerId: null`) — forme déjà couverte. Golden vert, 274 tests moteur.
- **Position de la ville neutre de test** : `(6,2)` sur proto-01 (au clair du
  bandeau d'armée DOM en bas d'écran ; `(5,6)` tombait sous le HUD → tap perdu).
- **`TownsLayer.eventMode = 'none'`** : couche décorative, ne capte jamais le
  pointeur (sinon un tap sur le donjon n'atteindrait plus le handler de scène).

## Invariants
Moteur pur, RNG seedé, **zéro nom de faction**, golden re-fixé explicitement,
budget < 800 Ko, anti-gel ×4, garde-fou faction vérifié localement.

## Journal
- **2026-07-06** — Création. Base `08129c4` (main, après #69). Cadrage : combat
  de ville = prérequis manquant des sièges → fondation d'abord + murs minimaux.
- **2026-07-06** — Implémentation complète. Moteur + client + smoke + docs verts :
  typecheck 4/4, lint, 274 tests moteur, 70 contenu, `content:check`, build
  (~230 Ko gzip < 800), smoke desktop + mobile (dont le nouveau cas de siège),
  garde-fou faction vérifié localement (statut grep 1 = propre).
