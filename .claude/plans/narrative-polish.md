# Plan vivant — Plan de Polishing Narratif & Storytelling (doc 13)

## Objectif

Rédiger `docs/13-plan-narrative-polish.md` : le plan de polishing narratif à
exécuter **après** les mécaniques core (post-Alpha 4.x), fidèle à l'esprit de
*Might & Magic: Heroes Online* (Flash, 2014-2020), intégrant la faction
Arcane Hunters dans le lore d'Ashan, et compatible avec les invariants du
projet (moteur pur data-driven, touch-first, budget bundle).

Changement **purement documentaire** (guideline §7 : smoke test omis, justifié —
aucun code touché).

## Étapes

- [x] Lire le dépôt : doc 01 (GDD), 03/04/05 (factions + lore), 09 (roadmap),
      schéma scénarios (`data/scenarios/`, `packages/content/loader.ts`),
      locales `@loc:` → vérifié : narration devra être data-driven + i18n.
- [x] Recherche web sur la narration de Heroes Online original (cadre Ashan,
      campagne, quêtes, ton) → rapport agent, à croiser avec le wiki M&M.
- [x] Rédiger `docs/13-plan-narrative-polish.md` avec les livrables demandés :
      vue d'ensemble narrative, structure de campagne, système de quêtes,
      lore (3 factions + Arcane Hunters intégrés), implémentation technique
      (dialogues/cutscenes PixiJS, journal de quêtes, JSON data-driven),
      roadmap de polishing (N1→N4), exemples concrets (intro, quêtes, dialogue).
      → vérifier : chaque livrable de la demande a sa section.
- [x] Référencer le doc 13 dans `CLAUDE.md` (structure des fichiers).
- [x] Commit + push sur `claude/heroes-narrative-polish-plan-o4td5z`, PR draft
      (#66).
- [x] Retour utilisateur : approfondir l'**intégration narrative d'une faction
      custom** → doc 13 §8 refondu (5 blocs narratifs obligatoires, garde-fous
      alignés doc 06 §5.8, exemple filé Sylvan Court), §6.1 révisé (la campagne
      d'une faction vit dans `data/factions/<id>/story/`, `data/story/` =
      transverse), gabarit de faction +§8 « Lore & storytelling », doc 06 §5
      +étape 9 (narratif).

## Décisions prises

- Le doc prend le numéro **13** (suite de 12-assets-style-guide).
- La narration est spécifiée **data-driven dès le design** (paquets de
  dialogues/quêtes JSON validés Zod, clés `@loc:`, événements moteur comme
  déclencheurs) pour respecter le principe « zéro contenu en dur dans le
  moteur » — le moteur ne connaîtra aucune quête, comme il ne connaît aucune
  faction.
- Fidélité HO : cadre Ashan post-Heroes VI, ton « conte sombre accessible »,
  quêtes principales/annexes/journalières, chapitres par zones — sans
  reproduire le F2P (interdits doc 01 §4).
- Écart assumé vs HO original : pas de MMO/serveur au MVP narratif — les
  « événements serveur » deviennent des **événements temporaires locaux**
  (scénarios datés), architecturés pour un futur backend (doc 07 §5).
