---
name: ux-audit
description: Auditer l'ergonomie du client Heroes contre les principes du doc 08 (cibles tactiles ≥ 44 px, parité hover/appui long, pile de modales ≤ 2, jamais la couleur seule, prévisualisation avant action irréversible, 3 crans de police) et produire des captures Playwright par écran/viewport/cran de police. Utiliser au démarrage de chaque lot UX (§5 du plan de remédiation) pour établir un état de référence répétable et vérifier une correction (ex. CL7 : hexes de combat sous 44 px en mobile). Ne PAS utiliser pour produire des assets (skills asset-*) ni pour implémenter un écran (chaque écran a son plan .claude/plans/ux-<écran>.md).
---

# Audit ergonomique (ux-audit)

Source de vérité : **`docs/08-ui-ux.md`** (principes §1, écrans §2, navigation §3,
accessibilité §4). Cette skill rend l'audit **répétable** — on la relance à
chaque lot UX pour comparer avant/après, plutôt qu'un examen one-shot.

## 1. Checklist (dérivée du doc 08)

Chaque point cite l'exigence doc 08 et **comment le vérifier**. Un point en
échec = un constat à consigner (fichier:ligne + capture), pas à corriger dans la
passe d'audit.

| # | Exigence (doc 08) | Comment vérifier |
|---|---|---|
| A1 | **Cibles ≥ 44 px** (§1.1, §4) | Mesurer `getBoundingClientRect()` de tout élément interactif (boutons DOM + hexes/tuiles cliquables du canvas) au viewport mobile **360×640** ET aux 3 crans de police. Le hex de combat est le cas connu (CL7). |
| A2 | **Parité hover / appui long** (§1.1, §4) | Aucune info exclusive au `:hover` : tout tooltip/prévisualisation doit avoir un équivalent tap/appui long. Chercher les `title=`/`:hover` sans pendant tactile. |
| A3 | **Tap-tap avant action irréversible** (§1.3) | Déplacement, attaque, construction, recrutement, sort : 1er tap = sélection + **prévisualisation** (chemin/cible/coût/dégâts), 2ᵉ tap = confirmation. Vérifier qu'aucune action irréversible ne part au 1er tap. |
| A4 | **Pile de modales ≤ 2** (§3) | Compter les couches DOM `modal`/overlay simultanées ; le geste retour ferme celle du dessus. |
| A5 | **Jamais la couleur seule** (§4 accessibilité) | Toute information portée par la couleur (faction, camp, statut, atteignable/attaquable) a un **second canal** : motif (`FactionBadge`), libellé, icône, contour. |
| A6 | **3 crans de police** (§4) | Passer `fontScale` 1→2→3 (via Options) : le texte grandit partout (unités `rem`), aucune troncature ni chevauchement, cibles restent ≥ 44 px. |
| A7 | **Zoom/pan tactiles** (§1.1) | Carte : pinch-zoom + drag-pan présents. **Combat : constat CL7** — pas de zoom/pan, hexes fixes possiblement < 44 px. |
| A8 | **i18n complète** (§ général) | Aucune chaîne en dur : basculer FR↔EN (Options) et vérifier que tout l'écran change ; les `data-testid` restent stables. |

## 2. Procédure de captures (Playwright + Chromium préinstallé)

Les captures servent d'état de référence et de preuve avant/après. Le script
`capture.mjs` (à côté de ce fichier) pilote le **build de prod** servi par
`vite preview` (même artefact que la CI) et shoote chaque écran × viewport ×
cran de police dans un dossier de sortie.

```bash
# 1. Construire + lancer l'aperçu (port 4173, base /heroes/)
pnpm build
pnpm --filter @heroes/client preview &   # laisse tourner

# 2. Lancer les captures (sortie = 1er argument, défaut ./ux-captures)
#    PW_CHROMIUM_PATH : Chromium préinstallé (sandbox/conteneur) ; la CI n'en a pas besoin.
PW_CHROMIUM_PATH=$(ls /opt/pw-browsers/chromium*/chrome-linux/chrome | head -1) \
  node .claude/skills/ux-audit/capture.mjs ux-captures
```

Le script capture, pour **desktop (1280×800)** et **mobile (360×640 = Pixel 7
portrait)**, aux **3 crans de police** (l'état de chaque « flux » n'est préparé
qu'une fois ; seuls les crans re-photographient) :
- `menu` — écran d'accueil ; `newgame` — modale « Nouvelle partie » ;
  `options` — modale Options ;
- `adventure` / `town` / `hero` — partie `?seed=42` (chemin dev **test-faction**,
  rapide ; le tiroir héros n'est basculé qu'en mobile — colonne permanente
  ≥ 900 px) ;
- `prebattle` / `combat` — arène `/#arena` (l'écran pré-combat est capturé puis
  franchi via `pre-battle-fight`) ;
- `market` / `guild` — onglets conditionnels de la ville (bâtiments construits
  via le hook `__HEROES_TEST__.dispatch`, tours passés jusqu'au coût de la
  guilde) ;
- `adventure-real` / `town-real` / `hero-real` — **parcours joueur réel** :
  menu → Nouvelle partie → faction **Haven**, petite carte, seed 42 (noms de
  ville localisés, avatars peints — ce que `?seed=42` ne montre pas) ;
- `handoff` — hot-seat 2 humains, passage d'appareil à la fin de tour ;
- `quests` / `outcome` — scénario « survival » (journal de quêtes, puis victoire
  par `surviveDays` via la même boucle déterministe que le smoke).

Fichiers : `ux-captures/<écran>-<viewport>-font<1|2|3>.png`. Les inspecter à
l'œil pour A5/A6, et lire les mesures A1 imprimées par le script — cibles
< 44 px en `WARN`, **éléments interactifs seulement** (`button`, `a`,
`[role="button"]`, `input`, `select`). Une étape en échec marque `FAIL`, saute
la suite de son flux (`SKIP`) et met le code de sortie à 1.

## 3. Sortie de l'audit

Consigner les constats dans le plan du lot UX visé (`.claude/plans/ux-<écran>.md`),
chacun avec : id checklist (A1…A8), écran/viewport/cran, mesure ou capture,
fichier:ligne du code concerné. Toute **décision d'interaction** qui en découle
met à jour `docs/08-ui-ux.md` dans le même commit (docs = source de vérité).

> Rappel plan §5.3 — ordre du chantier : (1) cet audit de référence, (2) U2
> routeur d'écrans, (3) U1 combat mobile (min-scale 44 px + pan/pinch, corrige
> CL7/A7), (4) U3 feedback + journal, U4 multi-héros, U6 écrans manquants,
> (5) U5 DA / ville peinte.
