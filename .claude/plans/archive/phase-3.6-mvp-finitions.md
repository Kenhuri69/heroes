# Plan — Phase 3.6 : Finitions MVP & critères de sortie

Réf : doc 11 §Phase 3.6 ; doc 01 §5 (scope + critères de succès MVP). Dernière
sous-phase : **polissage** (aucun nouveau système) et déclaration du **jalon
MVP**. Petite phase diffuse — vérification + accessibilité + i18n + perf +
équilibrage grossier.

## Critères de sortie MVP (doc 01 §5) — état visé

1. **Partie complète jouable de bout en bout** (desktop + mobile) : ✅ déjà —
   carte, villes, combat, héros, 2 factions, scénarios, IA, victoire/défaite,
   sauvegarde. 3.6 vérifie et polit.
2. **3ᵉ faction sans diff moteur** : ✅ déjà prouvé (Haven 3.3 data-only,
   Necropolis 3.4 via 1 point d'extension générique ; `test-faction` chargée).
   Garde-fou CI actif.
3. **60 fps carte + combat sous throttling ×4** : smoke anti-freeze déjà en
   place (arène) — 3.6 **étend la garde à la carte d'aventure** et re-mesure.
4. **Chargement < 5 s / budget bundle** : budget < 800 Ko gzip déjà en CI —
   re-confirmé.

## Périmètre resserré 3.6

1. **Accessibilité** (doc 08, doc 01) :
   - **3 crans de police partout** : l'option `fontScale` existe (3.2/2.5) —
     auditer qu'elle s'applique à tous les écrans (menu, ville, combat, tiroir
     héros, overlay victoire, scénarios) via une unité relative héritée. Corriger
     les tailles en dur éventuelles.
   - **Motifs de bannières de faction** : distinction non chromatique (daltoniens)
     — chaque faction a un **motif/emblème** en plus de sa couleur (aujourd'hui
     rendu générique teinté). MVP minimal : un motif CSS/SVG par faction dérivé
     de `manifest.id` (déterministe), sans asset externe.
   - Cibles tactiles ≥ 44px re-vérifiées (touch-first, doc 08 §4).
2. **i18n complète** : audit — aucune chaîne visible en dur (tout via `t()` /
   locales fr+en). Les écrans 3.x récents (ville, sorts, compétences, scénarios,
   overlay) doivent avoir toutes leurs clés dans les 2 langues.
3. **Perf** : étendre le smoke fps à la **scène d'aventure** sous throttling ×4
   (anti-freeze ≥ 5 fps mesuré, log), en plus de l'arène.
4. **Équilibrage grossier** : test moteur de parité — Haven vs Necropolis à
   **valeur d'armée égale**, auto-combat déterministe sur N seeds, winrate dans
   une fourchette large (ex. 35–65 %) — sanity check anti-déséquilibre béant,
   pas un vrai `faction:sim`. Identifie les factions par propriété (garde-fou).
5. **Vue de ville peinte** (P2) : **différée** (placeholder teinté conservé) —
   hors critère de sortie, notée en écart.

## Décisions

- Pas de nouvelle surface moteur : 3.6 est client + tests + docs. Le garde-fou
  « 0 nom de faction dans le moteur » reste vert.
- L'équilibrage est un **test de sanity**, pas un outil de simulation complet
  (`faction:sim` = Alpha, doc 06 §5.6).
- Motifs de bannières : dérivés par code de `manifest.id` (hash → motif), zéro
  asset — cohérent avec « placeholders teintés jusqu'à la Beta » (doc 11 §3.3).

## Lots

- [x] **Cadrage (principal)** : ce plan.
- [x] **Lot V (sonnet) — client accessibilité + i18n** : audit `fontScale`
      (relatif partout), motifs de bannières de faction (déterministes, par id),
      audit i18n (0 chaîne en dur, clés fr+en complètes), cibles tactiles.
      Smoke : bascule des 3 crans de police visible sur un écran ; motif de
      bannière présent.
      - **Fait** : toutes les `font-size`/`font:` en `px` en dur des CSS `ui/*`
        converties en `rem` (audit exhaustif, ~50 déclarations sur 11 fichiers)
        — `fontScale` (`document.documentElement.style.fontSize` en %) s'applique
        donc bien à tous les écrans (menu, ville, combat, sorts, compétences,
        tiroir héros, overlay victoire, options). Titre du menu (`clamp(px,vw,px)`)
        converti aussi.
      - Cibles tactiles < 44px corrigées : `.town-garrison-slot button`
        (transfert garnison↔héros, 32→44px) et `.army-band-toggle` (bandeau
        armée mobile, 32→44px). Reste (stack-chip, army-slot, hero-inventory-slot)
        vérifié non interactif (pas de tap target) — laissé tel quel.
      - i18n : audit complet des 11 `.tsx` de `ui/` — **aucune chaîne visible en
        dur trouvée** (déjà 100% via `t()`/`resolve*`). Paire fr/en déjà complète
        (132/132 clés) avant ajout. 1 clé ajoutée pour le nouveau composant :
        `faction.badge` (fr+en).
      - `FactionBadge` (`ui/FactionBadge.tsx`) : motif (rayures/damier/losanges/
        points) + couleur dérivés par hash FNV-1a déterministe de `factionId`
        (opaque, aucun littéral de faction), SVG inline sans asset. Monté dans
        l'en-tête de l'écran de ville (`TownScreen`) via `town.factionId`. Liste
        de joueurs de scénario : n'existe pas encore côté UI (menu ne liste que
        les scénarios, pas leurs joueurs/factions) — badge non branché là,
        écart noté ci-dessous.
      - Smoke ajoutés : bascule fontScale (mesure `getComputedStyle` sur
        `calendar`, cran 1→3, ratio ≈1.25) ; `faction-badge` visible dans
        l'écran de ville (étend le test ville existant).
- [x] **Lot W (partiel, sonnet, fait dans le lot V)** — perf : smoke fps étendu
      à la **carte d'aventure** (`?seed=42`, throttling ×4, même protocole que
      l'arène, helper `measureFpsUnderThrottle` extrait et partagé) : ≥ 5 fps
      anti-gel, loggé (~17-18 fps mesuré en CI logicielle). Le test moteur de
      parité Haven/Necropolis (équilibrage) est un fichier `packages/content/
      test/balance.test.ts` déjà présent (non touché, hors périmètre lot V —
      `packages/engine`/`packages/content` interdits) : à finaliser par le lot W
      (import `Command` inutilisé actuellement en échec de lint, à sa charge).
- [x] **Équilibrage (principal)** : `packages/content/test/balance.test.ts` —
      deux factions à 7 tiers (par propriété), armées de valeur or égale,
      auto-combat déterministe sur plusieurs seeds et les deux rôles ; assertion
      anti-blowout (aucune ne gagne > 85 %). Vert.
- [x] **Intégration + jalon (principal)** : vérif globale (typecheck 4 pkgs,
      175 moteur + 54 contenu, lint, content:check, **36/2 smoke desktop+mobile**,
      bundle 60 Ko gzip, garde-fou). **Jalon MVP déclaré** (CLAUDE.md, doc 01 §5,
      doc 09). PR + merge.

## Écarts assumés

- Vue de ville peinte, assets artistiques finaux : Beta (placeholders teintés).
- `faction:sim` complet (winrate 45–55 % par palier/semaine) : Alpha ; 3.6 ne
  fait qu'un sanity check de parité.
- Safari iOS réel non testable en CI headless (Chromium) : couverture mobile via
  l'émulation Pixel 7 de Playwright + budgets ; le critère « Safari iOS » est
  vérifié manuellement hors CI (noté).
- `FactionBadge` pas branché sur une liste de joueurs de scénario : cet écran
  n'existe pas encore (le menu ne liste que des scénarios, pas leurs joueurs) —
  seul l'en-tête de l'écran de ville le porte pour l'instant (couvre le
  minimum demandé).
- Observation (hors périmètre client, non corrigée) : `manifest.name` de
  chaque paquet de faction pointe vers la même clé locale `faction.name`
  (`@loc:faction.name`) — `resolveLoc` fusionne les locales de tous les
  paquets chargés dans un seul objet plat, donc avec ≥ 2 factions chargées
  simultanément (le cas normal), le nom résolu est celui du dernier paquet
  chargé, pas celui de la faction demandée. `FactionBadge` évite le problème
  (aria-label générique `faction.badge` par id, pas de nom résolu). À
  investiguer côté `packages/content`/`data/factions` si un nom de faction
  lisible est requis ailleurs (hors lot V).
