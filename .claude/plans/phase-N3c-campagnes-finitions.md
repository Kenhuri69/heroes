# Plan — Lot N3c : finitions des campagnes (doc 13 §6.3, §5.4)

Dernier lot des campagnes fondatrices. Livré « in full » en **3 increments**
vérifiés (chacun une PR verte) :

- **N3c.1 — Cutscenes caméra** : système de cinématique **scriptée par la
  caméra** (doc 13 §6.3), pas de vidéo. Séquence déclarative
  `[panTo(tuile), wait(ms), dialog(id)]` jouée par la scène d'aventure Pixi,
  letterbox léger, **skippable au tap** (≥ 44 px), touch-first. Zéro diff moteur
  (pure présentation). Cutscene d'ouverture sur un chapitre Haven.
- **N3c.2 — Choix, drapeaux & arcs de héros** : `choices` de dialogue avec
  `setFlag`/`next` câblés (le schéma les a déjà) ; `campaignState.flags`
  (localStorage, relu entre campagnes) ; quêtes `kind: personal` ; **un arc
  personnel de héros nommé** en 3 étapes avec choix binaire final posant un
  drapeau. Zéro/minimal diff moteur (`personal` est un label client ; le
  drapeau est client).

### N3c.2 — détail

- **Client (zéro diff moteur)** :
  - `app/campaign.ts` : drapeaux globaux (localStorage `heroes.flags`,
    **relus entre campagnes**) — `setCampaignFlag`/`campaignFlags`, miroir
    store `campaignFlags` chargé au boot.
  - `app/narrative.ts` : `chooseDialogueOption(choice)` — `setFlag` pose le
    drapeau, `next` saute au nœud cible, sinon enchaîne la file ; `kind`
    porté dans le catalogue + l'entrée de journal.
  - `ui/DialogueBox.tsx` : à la dernière ligne d'un nœud avec `choices`,
    boutons de choix empilés (≥ 44 px) au lieu de « toucher pour continuer ».
  - `ui/QuestJournal.tsx` : badge « Personnel » pour `kind: personal`.
  - `main.ts` : hook de test `campaignFlags()`.
- **Données** : arc personnel d'**Aldric** (`haven-ch2`) en 3 étapes ; le
  nœud final offre un **choix binaire** (clément / implacable) posant l'un de
  deux drapeaux. Locales fr/en.
- **Smoke** : démarrer `haven-ch2` → dérouler l'arc jusqu'au nœud de choix →
  les 2 boutons de choix apparaissent → cliquer → le drapeau est posé
  (hook `campaignFlags`) et persiste.
- **N3c.3 — 3ᵉ chapitre Haven + cartes dédiées** : la campagne Haven passe à 3
  chapitres ; ≥ 1 carte dédiée (proto-02) au lieu de tout réutiliser proto-01.

## N3c.1 — détail

- **Contenu** : `cutsceneStepSchema` (`panTo{x,y,ms?}` | `wait{ms}` |
  `dialog{dialog}`), `cutsceneSchema` ; scénario gagne `cutscenes?` +
  `openingCutscene?`.
- **Client** :
  - `app/camera-control.ts` : `registerCamera(cam, app)` + `panCameraTo(x,y,ms)`
    (anime `camera.world.position`, `requestAnimationFrame`, easing) — la
    présentation peut utiliser `performance.now`/rAF (hors moteur déterministe).
  - `app/cutscene.ts` : `playCutscene(steps)` (pan/wait/dialog séquentiels via la
    file de dialogues N2b) + `skipCutscene()` + état `cutsceneActive`.
  - `ui/CutsceneOverlay.tsx` : letterbox + bouton **Passer** (≥ 44 px).
  - Câblage : au démarrage d'un scénario avec `openingCutscene`, jouer la
    cinématique avant la boucle de jeu ; enregistrer la caméra dans `main.ts`.
- **Données** : cinématique d'ouverture sur `haven-ch2` (pano sur la carte +
  dialogue existant en étape `dialog`).
- **Smoke** : démarrer `haven-ch2` → letterbox/Passer visibles → Passer → la
  partie est jouable (`end-turn` visible, plus de letterbox).

## Vérification par lot (chaque increment)

typecheck 4/4 · moteur (golden inchangé) · content · content:check ·
garde-fou faction (grep local) · build < 800 Ko · smoke desktop + mobile.

### N3c.1 — vérifié ✅

- [x] typecheck 4/4
- [x] moteur 321 (golden **inchangé** — zéro diff moteur : cutscenes = présentation pure)
- [x] content 77 + `content:check` (7 scénarios, 2 campagnes, parité fr/en)
- [x] garde-fou faction (grep local : propre)
- [x] lint propre · build client (246 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile (nouveau test cutscene + N2b/N3a/N3b non régressés)

### N3c.2 — vérifié ✅

- [x] typecheck 4/4
- [x] moteur 321 (golden **inchangé** — `kind`/drapeaux = client, zéro diff moteur)
- [x] content 77 + `content:check` (arc `aldric-serment` résolu, parité fr/en)
- [x] garde-fou faction + garde-fou couleurs (grep local : propres)
- [x] lint · build client (248 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile (nouveau test choix/drapeau + N2b/N3a/N3b/N3c.1 non régressés)

### N3c.3 — vérifié ✅

- [x] typecheck 4/4
- [x] moteur 321 (golden **inchangé** — carte/scénario/campagne = données pures)
- [x] content 77 + `content:check` (2 cartes, 8 scénarios, campagne Haven à 3 chapitres)
- [x] garde-fou faction + garde-fou couleurs (grep local : propres)
- [x] lint · build client (248 Ko gzip < 800 Ko)
- [x] smoke desktop + mobile (nouveau test : 3ᵉ chapitre démarre sur `proto-02` 24×24 ; suite complète 92 ✓)

**N3c complet** (N3c.1 + N3c.2 + N3c.3) — campagnes fondatrices finies « in full ».

## Décisions / écarts

- **N3c.3** — carte dédiée `proto-02` (24×24, terrain/route/objets propres) au lieu
  de rejouer proto-01 ; la ville de départ vient des données de scénario
  (`cmd.towns`), pas d'un objet `town` de carte → proto-02 n'en embarque pas.
  Servie automatiquement (`publicDir = data/`), zéro câblage client.
- **N3c.3** — le hook de test `startCampaignChapter` démarre un chapitre par index
  sans passer par le déverrouillage du menu → le smoke teste le chargement du 3ᵉ
  chapitre (carte `proto-02`) sans avoir à gagner les 2 premiers.
- **N3c.2** — drapeaux persistés dans un stockage **propre** (`heroes.flags`),
  séparé de `heroes.campaigns`, pour rester **globaux et relus entre campagnes**
  (méta-jeu), indépendamment des sauvegardes de partie.
- **N3c.2** — arc d'Aldric : les 2 premières étapes (`ownUnits` conscrits/archers)
  sont satisfaites par l'armée de départ → l'arc atteint son nœud de choix binaire
  dès l'ouverture (front-loaded), ce qui le rend testable en smoke sans dérouler
  toute la partie ; l'étape finale (`defeatHero`) laisse le choix être le dernier
  geste narratif avant la résolution mécanique.
- **N3c.2** — au nœud de choix, le tap sur la boîte n'avance plus et le bouton
  « Passer » disparaît : une décision est **requise** (les deux choix posent des
  drapeaux distincts, sans branche `next` — l'effet narratif est différé aux
  futurs chapitres).
- **N3c.1** — cinématique jouée en **arrière-plan** (fire-and-forget après
  `navigate`), pas en bloquant : le pas `dialog` attend l'interaction du joueur,
  bloquer le démarrage figerait aussi le hook de test. La cinématique reste
  skippable (bouton **Passer**) et n'empêche pas le HUD sous-jacent (letterbox
  `pointer-events:none`, seul le bouton capture le tap).
- **N3c.1** — `haven-ch2` : l'`openingDialog` N2b devient un pas `dialog` DANS la
  cinématique d'ouverture (`openingCutscene`) — évite le double affichage.
- **N3c.1** — pan caméra réutilise la formule exacte de `centerOnHero`
  (`app.screen.width/2 − (x+0.5)·TILE·scale`) via `app/camera-control.ts`
  (enregistré à la création de la scène, retiré à sa destruction).
