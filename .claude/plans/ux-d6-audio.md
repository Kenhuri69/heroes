# Plan — UXD-6 : ambiance sonore

> Lot 6 du plan maître `.claude/plans/ux-design-overhaul.md` (§3). Traite le
> constat §1.5 (« aucun audio dans le client — plus gros écart d'immersion vs
> HoMM/HO ; l'option audio promise doc 08 §2.5 n'existe pas »). Découpé comme
> UXD-3 : **6A** cadrage + prompts (ce lot), **6B** intégration à la réception
> des fichiers audio.

## Décision de sourcing (utilisateur)

Génération via **Gemini** (comme les images). ⚠️ L'utilisateur signale que
Gemini **ne respecte pas les durées** → retravail obligatoire (trim, points de
boucle, normalisation, encodage) inscrit dans les fiches de prompt et la
Règle F (doc 12).

## Étapes

- [x] **Règle F (audio)** dans `docs/12` : cadre sonore, familles & cibles,
      formats (`.ogg` + repli `.m4a`), budgets, staging `assets/audio/`,
      convention de nommage, note « durées Gemini non fiables ».
- [x] `tools/assets/gen_audio_prompts.py` → `assets/prompts/audio-music.md`
      (6 pistes) et `audio-sfx.md` (10 effets), avec commandes ffmpeg de
      retravail.
- [x] **Utilisateur** : générer les musiques dans Gemini, fournies (5 pistes)
      → retravaillées + déposées (6C ci-dessous). SFX à suivre.
- [x] **6B — architecture client** (peut démarrer AVANT les fichiers, jouable
      silencieux) :
  - `render/audio.ts` : registre (`import.meta.glob ?url`, hors bundle, lazy) +
    lecteur Web Audio ; déblocage à la 1ʳᵉ interaction (autoplay policy).
  - Volumes musique/SFX (0-100) persistés `localStorage`, **coupé/modéré par
    défaut** ; section Audio des Options (doc 08 §2.5).
  - Mapping : contexte → musique (`menu`/`adventure`/`combat`/`town`), event
    moteur → SFX (via `eventBus` existant). Le son double un feedback visuel
    (A5), jamais seul.
  - Repli gracieux : fichier absent = silence (pas d'erreur).
- [x] Vérif : smoke « pas d'erreur autoplay », volumes persistés, budget JS
      intact (audio hors bundle), jouable coupé sans perte d'info.

## Ordre

6A (ce lot) est autonome (prompts + spec). L'**architecture 6B** est du code
indépendant des fichiers (tout est silencieux tant qu'aucun `.ogg` n'est
présent) — peut être livrée en parallèle de la génération audio.

## Livraison 6B (2026-07-07)

- `app/audio.ts` : registre hors bundle (`import.meta.glob '…/assets/audio/**/*.{ogg,m4a}' ?url`,
  OGG prioritaire, repli M4A) + lecteur `HTMLAudioElement` (musique bouclée +
  SFX jetables) ; **déblocage à la 1ʳᵉ interaction** (pointerdown/keydown) —
  aucun autoplay ; volumes musique/SFX **persistés** (`localStorage`), modérés
  par défaut (0,35 / 0,6).
- Musique par contexte (abonné store) : `menu`/`combat`/`town`(modale)/`adventure`.
  SFX par événement (abonné bus) : combat-hit/spell/death, end-turn/map-step/
  map-pickup **gardés au joueur humain**. Le son **double** un feedback visuel (A5).
- Options : section **Audio** (2 sliders ≥ 44 px, accent doré), i18n FR/EN ;
  `initAudio()` au bootstrap.
- **Jouable silencieux** : aucun fichier ⇒ no-op, zéro erreur. Intégration =
  déposer les `.ogg` nommés par convention.
- Vérif : capture Options, persistance (music=0 relu), smokes **100 verts +
  2 skipped** (pas d'autoplay), typecheck/lint/build verts, garde-fou couleurs.

## Livraison 6C — musiques déposées (2026-07-07)

Première fournée de fichiers de l'utilisateur : **5 musiques** générées via
Gemini. Les métadonnées `creation_time` sont vides et l'upload a aplati les
mtime dans la même seconde (ordre = ordre d'upload, non fiable) ; de plus aucun
fichier n'est un one-shot ~6 s ⇒ ce ne sont pas les prompts 1-5 dans l'ordre,
mais **les 4 boucles + 1 variante**. Mapping retenu par **nom + durée**
(cohérent avec la sémantique des emplacements ; les 2 pistes longues ~3 min
vont sur menu/aventure) :

| Emplacement | Fichier source | Retravail |
|---|---|---|
| `music/menu` | `kingdom_at_first_light` (177 s) | trim silence → **boucle 64 s** (micro-fades anti-clic) + loudnorm |
| `music/adventure` | `dawn_at_the_stone_ramparts` (179 s) | idem, boucle 64 s |
| `music/combat` | `vanguard_s_decree` (31 s) | trim silence + loudnorm (durée conservée) |
| `music/town` | `morning_at_the_citadel` (31 s) | idem |
| *(réserve, non déposé)* | `a_kingdom_awakened` (30 s) | — |

- **Budget règle F (< 800 Ko/boucle, par format)** : les 2 pistes de 3 min
  crevaient le plafond (2,6 Mo) → **tronquées à 64 s** et encodées à 96 kbps →
  menu 656/768 Ko, adventure 668/768 Ko (ogg/m4a) ; combat 456/492, town
  480/488. Tous < 800 Ko. Encodage **OGG (Vorbis) + repli M4A (AAC)**.
- Staging : `assets/audio/music/{menu,adventure,combat,town}.{ogg,m4a}`.
- **Vérif runtime** (build de prod, Chromium) : aucun fetch audio avant la 1ʳᵉ
  interaction (autoplay respecté) ; après clic **menu → `menu.ogg` fetché** ;
  en arène **→ `combat.ogg` fetché** ; **0 erreur console**. Budget JS/CSS
  inchangé (252 Ko gzip, audio hors bundle).
- **Reste** : SFX (10) + fanfares victoire/défaite + `combat-shoot` + sons d'UI
  = fournée suivante ; couture de boucle des 2 pistes tronquées à peaufiner si
  l'oreille l'exige (retravail annoncé « après » par l'utilisateur).

## Livraison 6D — SFX procéduraux (2026-07-07)

Décision utilisateur : le modèle *musique* de Gemini produit des lits
mélodiques (ex. un « SFX » rendu = 30 s continu), inadapté aux one-shots courts
et secs → génération **procédurale déterministe** (« Freesound en autonomie ou
son procédural » ; procédural retenu : sans licence tierce, sans réseau, sous
contrôle total, cohérent avec la Règle P).

- `tools/assets/gen_sfx.py` (nouveau) : synthèse pur stdlib (sine/chirp/noise +
  filtres 1-pôle + enveloppes exponentielles) puis encodage ffmpeg
  **OGG (Vorbis) + repli M4A**. RNG seedé ⇒ reproductible.
- **6 SFX câblés** générés : `combat-hit` (impact métal+thud), `combat-spell`
  (balayage montant + shimmer), `combat-death` (chute descendante + clatter),
  `end-turn` (appel de cor 2 notes E→A, adouci), `map-step` (thud + herbe),
  `map-pickup` (cloche inharmonique brillante). Tous **< 10 Ko/format** (budget
  Règle F : SFX < 60 Ko).
- **Vérif runtime** (build de prod, arène) : l'auto-combat déclenche
  **`combat-hit.ogg` et `combat-death.ogg`** (même chemin `playSfx` que
  map-step/pickup/end-turn côté carte) ; **0 erreur console** ; build vert,
  budget JS/CSS inchangé (audio hors bundle).
- **Reste** : `combat-shoot` + sons d'UI (tap/confirm/erreur) — non câblés
  (nécessitent des hooks client) ; fanfares victoire/défaite — à sourcer ; la
  fonction de synthèse UI est prête à ajouter au générateur si on ouvre le
  câblage.

## Livraison 6E — jingles victoire/défaite + câblage (2026-07-07)

Fanfares de fin de partie, générées **procéduralement** (même approche que 6D)
et **câblées** sur l'écran de fin.

- `tools/assets/gen_sfx.py` étendu : `jingle_victory` (fanfare majeure do,
  arpège cuivré + basse + éclat de cymbale, ~3,2 s) et `jingle_defeat`
  (glissando descendant + accord la mineur + cor grave, assombri, ~3,5 s),
  écrits en **`assets/audio/music/{victory,defeat}.{ogg,m4a}`** (128 kbps).
  Poids : victory 24/49 Ko, defeat 16/54 Ko — sous le budget jingle (< 150 Ko).
- **Câblage client** (`app/audio.ts`) : `playJingle(id)` joue `music/<id>` en
  **one-shot** (pas de boucle) au volume musique ; déclenché sur l'événement
  moteur **`GameEnded`** (`status: 'won'` → victory, `'lost'` → defeat, du point
  de vue du joueur humain). `musicContextKey` renvoie **null quand
  `game.outcome` est posé** ⇒ la boucle de fond se coupe pour laisser respirer
  le jingle.
- **Vérif runtime** (build de prod, scénario « survie » gagné via le harnais de
  test) : séquence musicale menu → aventure → combat, puis **`victory.ogg`
  joué à la victoire** ; boucle de fond coupée ; **0 erreur console**. Defeat =
  même chemin `playJingle` (fichier présent). Typecheck/lint/build verts,
  budget JS/CSS inchangé (253 Ko gzip, audio hors bundle).
- **Reste** : `combat-shoot` + sons d'UI (tap/confirm/erreur) — non câblés.

## Livraison 6F — son de tap d'interface (2026-07-07)

Retour tactile audio à l'appui des boutons d'UI (pur client).

- `gen_sfx.py` : `ui-tap` (tap bois/parchemin sourd ~120 ms, discret) → `sfx/`.
- `app/audio.ts` : écouteur `pointerdown` global qui joue `ui-tap` **uniquement
  si la cible est un `button`/`[role="button"]`** — jamais sur le canvas de jeu
  (les taps carte/combat ont déjà leurs propres SFX).
- **Vérif runtime** (build de prod) : clic dans le vide (déblocage) ⇒ 0 tap ;
  clic sur un bouton de menu ⇒ **1 `ui-tap.ogg`** ; 0 erreur console. Typecheck/
  lint/build verts, budget JS/CSS inchangé (253 Ko gzip).
- **Reste** : `combat-shoot` (tir à distance) — demande un champ `ranged` sur
  l'événement moteur `StackAttacked` (impact golden replay) : différé, gain
  marginal ; `ui-confirm`/`ui-error` — demandent un typage des toasts : différés.
