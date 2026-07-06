# Plan — Audit MVP 3.x (combler les écarts) puis ouverture Alpha 4.x

> Directive utilisateur : « tu as sous-estimé le plan d'implémentation 3.X,
> vérifie que tout est implémenté, sinon lance le plan 4.X, délégation aux
> sous-agents quand c'est possible. »

## Cadre
- **3.x = MVP** (doc 11, roadmap Phase 1). **4.x = Alpha** (doc 09 Phase 2) :
  Arcane Hunters 4.1→4.10 **livré** ; RESTE d'Alpha **sans plan** : upgrades
  d'unités ×3 factions, machines de guerre, sièges v1, escarmouche vs IA,
  hot-seat, sorts d'aventure, `faction:sim`, éditeur de carte.
- Distinguer **écart MVP réel** (à combler maintenant) vs **différé assumé à
  l'Alpha** (doc 09 L19-20 + doc 11 « Écarts assumés ») : sorts d'aventure,
  upgrades, capacités spéciales avancées, hot-seat, assets peints, faction:sim.

## Étape 1 — Audit (délégué, read-only) ✅ TERMINÉ
5 sous-agents Sonnet, un par tranche. Résultats :
- [x] 3.1 Villes — solide SAUF ❌ règle **7 jours de reprise** (élim. immédiate)
      + ⚠️ pas d'unicité Capitole (mono-ville, faible impact).
- [x] 3.2 Héros — 12 compétences **toutes câblées** ✅ ; ⚠️ **10 sorts / ~20** ;
      ⚠️ 4 artefacts / 10 slots + pas d'UI équiper/ramasser ; 🧹 commentaire
      périmé `hero/skills.ts`.
- [x] 3.3/3.4 Factions — **aucun écart MVP** ; manques (héros nommés, bonus,
      écoles affines, capacités spéciales) tous **différés-Alpha documentés** ;
      modularité vérifiée (grep faction vide, garde-fou CI robuste).
- [x] 3.5 Scénarios/IA — solide SAUF ❌ **triggers `onVisit`/`onDay` absents**
      (au périmètre 3.5) ; ⚠️ conditions collectArtifact/accumulateResource
      différées (auto-documentées).
- [x] 3.6 Finitions — critères MET (ville peinte, équilibrage `balance.test`,
      accessibilité, garde-fou faction, budget 225 Ko) ; ⚠️ 60 fps **mobile**
      non vérifié en CI (fps skip mobile, plancher ≥5 desktop) ; ⚠️ pas de garde
      anti-chaîne-en-dur (propre aujourd'hui) ; Safari iOS manuel.

## Étape 2 — Synthèse + tri ✅
**Écarts MVP réels (au périmètre du plan/design, non « différés-Alpha ») :**
1. **Triggers de carte `onVisit`/`onDay`** (3.5) — absents ; doc 11 §3.5 + doc 02.
   Le plus gros : schéma + type moteur + accroche (`DayStarted`/pas de héros) +
   interpréteur déclaratif + 1 donnée. Golden à re-fixer (évolution moteur).
2. **Règle 7 jours de reprise de ville** (3.1) — doc 02 §4.1 ; moteur
   (`scenario/outcome` + compteur d'état). Golden à re-fixer.
3. **Sorts 10 → ~20** (3.2) — doc 11 §3.2 + doc 09 ; **données pures** (cercles
   1–3 ; 4–5 restent différés). Aucun changement moteur → golden stable.

**Différés-Alpha légitimes (documentés, pas des trous) :** héros nommés, bonus
de faction, écoles affines, capacités spéciales/bâtiments spéciaux (3.3/3.4) ;
upgrades, sièges, escarmouche, sorts d'aventure, hot-seat, faction:sim, éditeur
de carte ; 60 fps mobile réel ; conditions collectArtifact/accumulateResource.

**Nettoyages triviaux (à fondre dans le lot qui touche la zone) :** commentaire
périmé `hero/skills.ts` ; note « trigger différé » manquante dans doc 02 État 3.5.

## Étape 3 — Combler les écarts MVP (décision user : ①②③ tous les 3)
Ordre/parallélisme :
- **Lot A — ③ Sorts (données pures)** : DÉLÉGUÉ Sonnet (disjoint du moteur).
  ~10 sorts de plus (cercles 1–3, écoles Feu/Eau/Terre/Air + neutres) dans
  `data/core/spells.json` + locales FR/EN ; `content:check` vert ; golden stable
  (moteur inchangé). Pilote intègre + smoke + PR.
- **Lot B — ①+② moteur (piloté)** : les deux touchent `core/{state,events,
  engine}.ts` → séquentiels dans un seul lot, **un seul re-fix golden**.
  - ① Triggers `onVisit`/`onDay` : nouveau point d'extension **générique**
    (jamais un nom de faction) — schéma contenu `trigger`, variante
    `MapObjectDef`/liste `onDay`, accroche visite (`advanceHeroAlongPath`) +
    `DayStarted`, interpréteur déclaratif d'effets + événement `TriggerFired`,
    1 donnée d'exercice, nettoyage note doc 02 État 3.5.
  - ② 7 jours de reprise : compteur d'état par joueur, décrément au `DayStarted`,
    défaite seulement à expiration sans ville reprise ; `scenario/outcome`.
  - Nettoyage : commentaire périmé `hero/skills.ts`.
  - Tests unitaires + property + re-fix golden + smoke + docs 02/11 + PR.
Invariants : moteur pur, zéro faction moteur, budget < 800 Ko, anti-gel ×4,
touch-first ; golden re-fixé **explicitement** (évolution moteur assumée).

## Étape 4 — Ouvrir l'Alpha 4.x
Selon le tri, démarrer les lots Alpha manquants (plan par lot), même méthode.

## Journal
- **2026-07-06** — Création. Base `32e92f2` (main, après #64). Audit 5 agents
  lancé.
- **2026-07-06** — Audit rendu (5/5). Décision user : combler ①②③. **Lot A ③**
  (sorts 10→20) délégué Sonnet, livré (données pures, content:check 22 sorts).
  **Lot B ①②** piloté : triggers de carte génériques (`AdventureMapDef.triggers`,
  `TriggerEffect`, `TriggerFired`, `adventure/triggers.ts`, accroche visite +
  `DayStarted`) ; grâce de reprise (`townlessDays` sentinelle -1/0/n,
  `RETAKE_GRACE_DAYS`, `tickTownGrace`) — correction clé : n'arme le minuteur
  qu'après avoir possédé une ville (préserve le scénario « survie » hero-only).
  Nettoyage commentaire périmé `hero/skills.ts`. `saveVersion`→4, golden re-fixé
  `347a584d`. Vérif : typecheck 4/4, lint, **252 engine + 70 content** (dont
  triggers.test ×3, town-grace ×4), content:check, build 71,4 Ko, **56 smoke**
  (dont trigger onDay + survie). Docs 02/07/11 à jour. Prêt PR.
- **Reste : Étape 4 (ouvrir l'Alpha 4.x)** après merge de ce lot.
