# Plan — U4 : Multi-héros / multi-villes (doc 08 §2.1)

> Lot U4 du chantier UX (plan de remédiation §5.3, étape 4). Le HUD suppose
> aujourd'hui **1 héros + 1 ville** : `heroes.find(playerId === human)` (le
> premier) et `firstOwnedTown`. Or le joueur humain peut posséder **plusieurs
> villes** (capture, scénario conquête) → la 2ᵉ ville capturée est **inaccessible**
> depuis le HUD (trou réel). Le moteur supporte déjà **N héros** par joueur (tableau
> `heroes` filtré), même si le contenu MVP n'en donne qu'un (pas de recrutement de
> héros). doc 08 §2.1 prévoit portraits héros + liste de villes.

## Décision de périmètre (cadrée avec l'utilisateur)

**Option retenue : multi-villes complet + multi-héros HUD** (AskUserQuestion,
2026-07-05). Multi-villes : liste de toutes les villes possédées, chacune ouvre
son écran. Multi-héros : `selectedHeroId` + bandeau de portraits listant tous les
héros humains, pilotant tiroir/armée/carte + **un sprite par héros** sur la carte.
Avec 1 héros = comportement identique ; généralise proprement à N (doc 08 §2.1).
Transfert d'armée/artefacts entre héros = **différé à U6** (fiche héros).

## 1. Objectif & critères de succès

- **Multi-villes** : le HUD liste toutes les villes du joueur humain ; taper une
  ville ouvre **son** `TownScreen` (via la pile de modales, `openModal({ kind:
  'town', townId })`). Une 2ᵉ ville capturée devient accessible.
- **Multi-héros** : `selectedHeroId` (repli = 1er héros humain) ; **bandeau de
  portraits** (tap = sélectionner) ; tiroir/armée/MP/centrage/déplacement carte
  suivent le héros **sélectionné** ; `AdventureScene` rend **un sprite par héros
  humain** (le sélectionné mis en évidence).
- Invariants : moteur pur intact (aucun changement moteur), budget bundle,
  golden stable, cibles ≥ 44 px.

Vérif : typecheck 4/4 + lint + test + content:check + build + smoke (multi-villes :
capture → 2 villes → les deux ouvrables ; bandeau héros rendu + sélection).

## 2. Contrat figé (pilote)

- `store.ts` : `selectedHeroId: string | null` (défaut `null` → résolu au 1er).
- `app/game.ts` (helpers purs, réutilisés carte + HUD) :
  - `humanHeroes(game): HeroState[]` — héros du joueur humain.
  - `resolveSelectedHero(game, selectedHeroId): HeroState | undefined` —
    `selectedHeroId` parmi les héros humains, sinon le premier.
  - `humanTowns(game): TownState[]` — villes du joueur humain.

## 3. Découpage (fan-out Sonnet, fichiers disjoints)

- **Pilote** : `store.ts` (`selectedHeroId`), `app/game.ts` (3 helpers). Contrat.
- **S-scene (Sonnet)** : `scenes/adventure/AdventureScene.ts` — Map<heroId,
  sprite> (un sprite par héros humain, sélectionné mis en évidence) ;
  `handleTap`/centrage/animation/déplacement pilotés par le héros **sélectionné**
  (`resolveSelectedHero` + `store.selectedHeroId`). Fog déjà multi-héros.
- **S-hud (Sonnet)** : `ui/shell.tsx` (+ `ui/styles.css`) — bandeau de portraits
  héros (sélection → `selectedHeroId`), liste de villes (chacune → `openModal`
  town) remplaçant le bouton `firstOwnedTown` ; tiroir/armée/MP suivent le héros
  sélectionné.
- **Pilote (après intégration)** : locales (aria portraits/villes), smoke
  (multi-villes ouvrables via capture + bandeau héros), `docs/08-ui-ux.md` §2.1.

## 4. Journal
- **2026-07-05** — Création. Périmètre cadré (option A). Contrat à figer, fan-out
  S-scene/S-hud à lancer.
- **2026-07-05** — Contrat figé (store `selectedHeroId`, helpers
  `humanHeroes`/`resolveSelectedHero`/`humanTowns`). Fan-out Sonnet : S-scene
  (AdventureScene → Map<heroId,sprite> + anneau de sélection + héros sélectionné)
  et S-hud (bandeau portraits + liste de villes). Typecheck 4/4 vert.
- **2026-07-05** — **Bug d'intégration attrapé au smoke** : le premier passage
  crashait le renderer au boot (canvas absent, `READY` jamais posé, **zéro erreur
  JS** = mort du process, pas une exception). A/B strict main vs U4 (même env,
  workers=1) : **main OK, U4 CRASH** ⇒ bug U4 réel. Cause : `HeroStrip` et
  `TurnBar` faisaient `useApp((s) => humanHeroes(s.game))` / `humanTowns(s.game)`
  — ces helpers `.filter(...)` renvoient un **NOUVEAU tableau** à chaque appel, donc
  `useSyncExternalStore` voyait le snapshot changer à chaque check → **boucle de
  rendu infinie** → renderer tué. **Fix** : sélectionner `s.game` (réf stable) puis
  dériver la liste dans le corps du composant. Après fix : `READY=true, CANVAS=true`.
  Leçon : un sélecteur `useApp` ne doit jamais renvoyer un tableau/objet frais.
