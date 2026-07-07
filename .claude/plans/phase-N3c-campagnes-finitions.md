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

## Décisions / écarts

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
