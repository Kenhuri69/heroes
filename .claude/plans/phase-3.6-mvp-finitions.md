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

- [ ] **Cadrage (principal)** : ce plan.
- [ ] **Lot V (sonnet) — client accessibilité + i18n** : audit `fontScale`
      (relatif partout), motifs de bannières de faction (déterministes, par id),
      audit i18n (0 chaîne en dur, clés fr+en complètes), cibles tactiles.
      Smoke : bascule des 3 crans de police visible sur un écran ; motif de
      bannière présent.
- [ ] **Lot W (sonnet) — perf + équilibrage** : étendre le smoke fps à la carte
      d'aventure (throttling ×4) ; test moteur de parité Haven/Necropolis
      (valeur égale, N seeds, winrate borné). (Peut être fait par la session
      principale si petit.)
- [ ] **Intégration + jalon (principal)** : vérif globale complète (typecheck/
      lint/tests/smoke desktop+mobile/bundle), docs — déclarer le **jalon MVP
      atteint** (CLAUDE.md, doc 01 §5 état, doc 09), garde-fou, PR, merge.

## Écarts assumés

- Vue de ville peinte, assets artistiques finaux : Beta (placeholders teintés).
- `faction:sim` complet (winrate 45–55 % par palier/semaine) : Alpha ; 3.6 ne
  fait qu'un sanity check de parité.
- Safari iOS réel non testable en CI headless (Chromium) : couverture mobile via
  l'émulation Pixel 7 de Playwright + budgets ; le critère « Safari iOS » est
  vérifié manuellement hors CI (noté).
