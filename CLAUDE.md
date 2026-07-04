@.claude/guidelines.md

# Heroes — Mémoire Projet

Recréation navigateur du gameplay de *Might & Magic: Heroes Online* :
exploration par héros sur carte d'aventure, gestion de villes, armées et
combats tactiques tour par tour sur grille hexagonale.
Cible desktop + mobile (touch-first), architecture data-driven modulaire.

> 📐 **Phase actuelle : Phase 1 — spécification.** Le dépôt ne contient que
> la documentation de design (`docs/`). Aucun code exécutable pour l'instant ;
> la stack pressentie est TypeScript strict + PixiJS 8 (voir
> `docs/07-architecture.md`).

---

## Structure des fichiers

```
README.md                        Vue d'ensemble + principes non négociables
docs/
  01-gdd-overview.md             Vision, core loop, piliers, monétisation, scope MVP
  02-mechanics.md                Héros, carte d'aventure, ressources, combat hex, town building
  03-faction-haven.md            Faction Haven : lore, unités T1–T7, bâtiments, bonus, héros
  04-faction-necropolis.md       Faction Necropolis : idem + Nécromancie
  05-faction-arcane-hunters.md   Faction Arcane Hunters : nouvelle maison, 8 tiers, mécaniques uniques
  06-modularity.md               Plan data-driven : dossiers, interfaces, checklist d'intégration de faction
  07-architecture.md             Frontend TS/PixiJS, state management, backend Node.js, sauvegardes, réseau
  08-ui-ux.md                    Écrans principaux, wireframes, adaptation mobile
  09-roadmap.md                  Phases MVP → Alpha → Beta → Live
  10-plan-phase-2-implementation.md  Plan Phase 2 : structure, architecture, build Vite, déploiement GitHub Pages, code prioritaire
  templates/faction-template.md  Gabarit pour spécifier une nouvelle maison
.claude/
  guidelines.md                  Règles de travail (incluses ci-dessus)
  plans/                         Plans vivants par changement (règle §5 des guidelines)
```

---

## Architecture cible (résumé — détail dans `docs/07-architecture.md`)

- **Moteur de règles pur** : TypeScript strict, déterministe (RNG seedé
  injecté), zéro dépendance au rendu ou au DOM. Testable en unitaire.
- **Rendu** : PixiJS 8 (WebGL/WebGPU, fallback canvas), consomme l'état du
  moteur — jamais l'inverse.
- **Contenu 100 % data-driven** : unités, bâtiments, héros, bonus décrits en
  JSON + manifeste de faction, validés par schémas. Le moteur ne connaît
  aucune faction (checklist d'intégration : `docs/06-modularity.md`).
- **Sauvegarde** : locale (IndexedDB) au MVP ; backend Node.js + WebSocket
  pour l'asynchrone/PvP post-MVP.

---

## Conventions de travail

- **Langue** : documentation et discussions en français ; identifiants de
  code en anglais.
- **Branche par défaut** : `main`. Travailler sur des branches `claude/…`,
  PR ouverte en draft (voir guidelines §6 avant tout push).
- **Toute évolution de design** passe par la mise à jour du document
  `docs/0X-*.md` concerné — les docs sont la source de vérité en Phase 1.
- **Nouvelle faction** : partir de `docs/templates/faction-template.md` et
  suivre la checklist de `docs/06-modularity.md` ; ne jamais introduire de
  cas particulier de faction dans le futur moteur.
- **Plans** : chaque changement non trivial a son plan vivant dans
  `.claude/plans/<feature>.md` (guidelines §5).
