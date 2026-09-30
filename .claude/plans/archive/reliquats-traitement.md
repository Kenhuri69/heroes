# Traitement des reliquats différés

> **Demande utilisateur (2026-08-24, suite de la passe de clôture)** : « traite
> les chantiers possibles listés dans reliquats différés ». Source :
> `.claude/plans/reliquats-differes.md`.

## 1. Tri : ce qui est réellement faisable ici

| § | Reliquat | Verdict |
|---|---|---|
| 1 | Planches d'assets LLM (unités, avatars, vignettes, fonds de combat, tas de ressources) | **bloqué** — demande des images générées par l'utilisateur (Gemini) ; prompts déjà prêts, rien à coder |
| 2 | Ambiances par biome | **faisable** → Lot C (synthèse procédurale déterministe, cf. `gen_sfx.py` ; ffmpeg requis en local, comme les SFX existants) |
| 3 | Polish visuel du siège (Lot 3) | **4 items sur 5 déjà livrés** (vérifié, voir §2) ; le 5ᵉ (porte) → Lot A |
| 4 | Niceties écartées | 2 restent écartées **par arbitrage** (filtre par catégorie, « Équilibrer ») ; « crossfade / titre vivant » → Lot B |
| 5 | Lot 10 / `game-feature-gaps` | hors périmètre : décision de roadmap (doc 09) |

## 2. Vérification du §3 : le reliquat était partiellement périmé

Le texte du reliquat recopiait la case non cochée du plan archivé
(`siege-visual-overhaul` Lot 3, écrit avant les itérations de remédiation qui
ont suivi). Relecture du code livré, item par item :

| Item Lot 3 | État réel | Preuve |
|---|---|---|
| props d'obstacles **peints** | **livré** | `assets/combat/obstacle-rock-{1,2,3}.png` + `CombatScene.syncObstacles` (« item 4a ») ; `drawBoulder` n'est plus que le repli |
| **FX de bombardement** calés sur la scène | **livré** | `WallBombarded` ⇒ `spawnProjectile(shape:'boulder')` + `spawnRubbleImpact`, impact recalé sur `layout.wallX` (« item 3 ») |
| **tour de tir** intégrée à l'enceinte | **livré** | `siege-piece-arrow-tower[-<faction>]` + ruine `-razed` (« itération 9 »), `syncStructureRuins` |
| **machines de guerre** | **livré** | `assets/units/core/{catapulte,ballista,first-aid-tent,ammo-cart,arrow-tower}.png` via `unitSpriteUrl` (repli core) |
| **porte ouverte/brisée** | **manquant** | la porte est une tranche FIXE du tableau (`stateOf(row)==='gate'` ⇒ `useRun = true`) : quoi qu'il arrive à l'enceinte, le gatehouse reste intact |

⇒ Lot A ne traite que la porte ; les 4 autres items sont cochés dans le
reliquat avec leur preuve (pas de re-livraison).

## 3. Lot A — porte brisée (siège)

**Constat** : l'assaut peut raser des segments autour de la porte (catapulte,
`WallBombarded`) sans que le **gatehouse** ne change jamais d'aspect.

**Approche** (zéro moteur, zéro faction en dur, art dérivé de la matière peinte
existante — la recette du Lot 1 de `siege-visual-overhaul`) :

1. `tools/assets/gen_siege_gate_broken.py` (nouveau, déterministe, PIL) : dérive
   des variantes **brisées** depuis l'art peint existant, pour les 7 déclinaisons
   (générique + 6 maisons — géométries identiques, vérifié par diff d'alpha) :
   - `siege-run-band-gate-broken[-<faction>].png` : bande des 2 rangées de porte
     **découpée au même rect** que les tranches du run (continuité pixel garantie)
     ⇒ vantail défoncé (ouverture sombre échantillonnée dans le tunnel du même
     tableau + montants d'ébrasement conservés), tablier de pont brisé (planches
     manquantes), gravats **copiés de la zone rasée du même tableau** (matière et
     lumière cohérentes par construction).
   - `siege-piece-gate-broken[-<faction>].png` : même traitement sur l'art de
     porte du mode « pièces » (chemin de repli).
   → verify: PNG produits, diff visuel relu, aucune couleur inventée.
2. `render/assets.ts` : `siegeRunBandUrl` accepte l'état `gate-broken` ;
   `siegeGatePieceUrl(factionId, broken)` — **repli gracieux** sur l'art intact
   si la variante manque (patron des assets peints).
   → verify: unitaire de résolution d'URL.
3. `CombatScene` : `gateBroken` = « une rangée qui portait un mur au **premier
   sync** de ce combat n'en porte plus » (l'assaut a réellement percé — pas les
   rangées ouvertes au setup par la catapulte). Mémorisé par combat
   (`initialWalledRows`, vidé en fin de combat comme `structureSpots`), injecté
   dans la **signature** des tranches ⇒ bascule au moment où le segment tombe.
   Les 2 rangées de porte sont alors découpées dans la bande brisée (mêmes
   `zIndex` qu'aujourd'hui : l'occlusion des unités ne change pas).
   → verify: smoke siège existant + unitaire du prédicat.

## 4. Lot B — fin de partie vivante

`OutcomeOverlay.css` n'a **aucune** animation : le fond victoire/défaite et le
titre apparaissent d'un coup. Ajout d'un **fondu enchaîné** du fond et d'une
**montée** du titre/panneau, coupés en `prefers-reduced-motion` (doc 08 §4).
CSS seul, tokens seuls (garde-fou couleurs), zéro logique.
→ verify: garde-fou couleurs vert, smoke victoire existant inchangé.

## 5. Lot C — ambiances par biome

`musicContextKey` renvoie `music/adventure` sur la carte, sans égard au terrain.
Ajout d'une **couche d'ambiance** distincte de la musique (2ᵉ canal, volume
dérivé, coupée par le mute), clé `ambience/<terrain>` résolue **avec repli
gracieux** (aucun fichier ⇒ silence, comme aujourd'hui), terrain lu **sous le
héros actif** du joueur humain. Pistes synthétisées par
`tools/assets/gen_ambience.py` (nouveau, même moule que `gen_sfx.py` : stdlib
`wave` + ffmpeg, RNG seedé ⇒ PCM reproductible).
→ verify: unitaires du résolveur (terrain → clé, repli, mute), poids des OGG
mesuré sous le budget images.

## 6. Journal d'exécution

- **Lot A livré** — `gen_siege_gate_broken.py` (7 déclinaisons : générique + 6
  maisons) ; `isGateBroken` pur + 4 unitaires ; bascule des tranches de porte
  dans `CombatScene` (bande redécoupée en deux moitiés ⇒ `zIndex` inchangés).
  *Écart au plan* : la rupture du **tablier du pont-levis** a été essayée puis
  **abandonnée** — la découpe des planches se lisait comme un accident de rendu
  (le défaut que le plan de refonte reprochait aux itérations précédentes) ; le
  vantail défoncé + les gravats portent le message. *Limite assumée* : la bascule
  d'art est du rendu canvas ⇒ non assertable en smoke (le prédicat, lui, est
  testé ; le smoke siège garde la non-régression).
- **Lot B livré** — 4 keyframes dans `OutcomeOverlay.css` (art, voile, panneau,
  titre) + gardes `prefers-reduced-motion` **et** `[data-reduce-motion]`.
  *Écart* : le zoom léger du fond a été retiré — `background-size: 108% → cover`
  n'est pas interpolable (saut au lieu d'un mouvement), le fondu suffit.
- **Lot C livré** — `gen_ambience.py` : 5 nappes (forest/snow/sand/swamp/river),
  ~22 s bouclées (queue fondue dans la tête), crête 0.22, encodage 64 kbps ⇒
  ~195 Ko/OGG. Contrôle objectif faute d'écoute possible : RMS 0.02–0.06 et
  brillance (ZCR) 0.13 (vent) → 0.34 (eau vive) ⇒ les 5 nappes sont bien
  distinctes et discrètes. Client : 2ᵉ canal + `ambienceKey` pur (3 unitaires).
  *Choix* : l'ambiance suit le volume MUSIQUE (×0.45) au lieu d'un 3ᵉ réglage —
  un curseur de plus pour une nappe à −7 dB ne se justifiait pas.

## 7. Vérification (rejouée en entier)

- [x] typecheck (5 projets) / lint verts
- [x] tests **935 moteur / 165 contenu / 81 client** (+7 nouveaux : 4 `isGateBroken`,
      3 `ambienceKey`)
- [x] `content:check` vert (7 paquets, 2 cartes, 16 scénarios)
- [x] garde-fous faction & couleurs verts
- [x] build + budget bundle **365 969 o gzip** (cap 819 200) — les OGG/M4A
      d'ambiance sont hors bundle (`?url`), comme les images
- [x] budget images : `dist/assets` **82 Mio** (cap 96) — +1,9 Mio d'ambiances ;
      chemin critique **242 604 o** (cap 307 200)
- [x] smoke `@core` desktop + mobile **55/55** (2 exécutions intermédiaires ont
      perdu 1 test chacune — `ville` mobile puis `tap-tap` desktop — par
      dépassement de timeout sous contention CPU du conteneur : chacun **rejoué
      seul est vert** (22,1 s / 5,0 s), et la 3ᵉ exécution complète passe 55/55)
- [x] golden inchangé (aucun fichier moteur touché)
- [x] `reliquats-differes.md` mis à jour (§2 et §3 traités, §4 crossfade livré,
      §1/§5 inchangés avec leur motif de blocage)
