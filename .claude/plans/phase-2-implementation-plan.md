# Plan — Rédaction du plan d'implémentation Phase 2

> Changement **purement documentaire** (guideline §7 : pas de test headless requis,
> aucun code exécutable n'est encore livré — le plan arme précisément ce test
> pour le premier lot de code).

## Objectif

Produire `docs/10-plan-phase-2-implementation.md` : plan d'implémentation
complet (structure projet, architecture, phases MVP, build Vite, déploiement
GitHub Pages, code de base prioritaire) pour obtenir un prototype jouable
accessible via une URL GitHub Pages, en respectant scrupuleusement la spec
Phase 1 (docs 01–09).

## Étapes

- [x] Lire l'intégralité des docs Phase 1 (01, 02, 05, 06, 07, 08, 09 lus en détail ;
      03/04 couverts via 02 et le README) → vérif : contraintes clés identifiées.
- [x] Identifier les écarts entre la demande et la spec → vérif : consignés ci-dessous.
- [x] Rédiger `docs/10-plan-phase-2-implementation.md` → vérif : couvre les 6 volets
      demandés (structure, architecture, phases, build/deploy, code prioritaire, exemples).
- [x] Mettre à jour `README.md` (table des docs) et `CLAUDE.md` (structure des fichiers)
      → vérif : le nouveau doc est référencé.
- [x] Commit + push sur `claude/mm-heroes-phase-2-plan-rht00n`, PR draft
      → vérif : PR ouverte (guideline §6 : pas de PR existante sur cette branche —
      vérifié avant push) — PR #2.
- [x] (Demande utilisateur post-PR) Ajouter le workflow de déploiement Pages
      **bootstrap** (`.github/workflows/deploy.yml` + `site/index.html`) : la
      version cible du doc 10 §4.2 build `packages/client` qui n'existe pas
      encore → on publie une page d'attente pour valider la chaîne Pages sans
      CI rouge. Doc 10 §4.2 annoté en conséquence (invariant « docs = source
      de vérité »). → vérif : run `deploy.yml` vert sur `main` après merge.
- [ ] Merger la PR #2 sur `main` (demande utilisateur) puis vérifier le run
      de déploiement et l'URL `https://kenhuri69.github.io/heroes/`.

## Écarts constatés / décisions

1. **« Hex Map + mouvement héros »** (demande) contredit `docs/02` §2.1
   (carte d'aventure = grille **carrée**, hex réservé au combat).
   → Décision : suivre la spec. Mouvement héros sur grille carrée ;
   l'**arène de combat hex** est livrée tôt (sous-phase 2.4), conformément
   au risque n°1 de la roadmap (« combat testable seul dès la semaine 2 »).
2. **Arcane Hunters « prêt à charger »** : la faction complète est planifiée
   en Alpha (docs 05 & 09). → Décision : le plan prévoit un **paquet de données
   squelette** `arcane-hunters` (manifeste + T1 + locales) chargé par le
   pipeline dès la Phase 2 comme démonstration de modularité, sans anticiper
   la production complète (qui reste en Alpha).
3. **« Preview URL après chaque push sur main »** : GitHub Pages ne fournit
   qu'une seule URL live par dépôt. → Décision : déploiement officiel
   `actions/deploy-pages` avec l'URL exposée dans l'environnement `github-pages`
   de chaque run ; les previews par PR sont notées comme extension possible,
   hors scope.
4. Le plan couvre la **Phase 0 de la roadmap + la tranche « arène de combat »
   de la Phase MVP**, rebaptisées « Phase 2 (implémentation) » côté projet —
   la numérotation est explicitée dans le doc pour éviter toute confusion
   avec les phases de la roadmap (doc 09).
