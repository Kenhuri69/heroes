# Lot — CAP-DATAFIX : réconciliation données ↔ doc (finition)

> **Travail documentaire** (aucun diff moteur, **aucun diff de données**). Suite
> de la demande utilisateur « go cap data fix » (2026-07-16). L'audit montre que
> **les données sont déjà correctes** (sim-tuned, lot A1/DOC-STATS) : les vrais
> écarts restants sont des **entrées de doc périmées**. On aligne la doc sur les
> données livrées (invariant #4 : docs = source de vérité, mais ici le design a
> tranché « stats = données font foi » ⇒ la doc doit refléter les données).

## Audit (données réelles vs doc 16 §4)

Vérifié unité par unité (`data/factions/vox-arcana/units/` vs table doc 16 §4) :

| Item backlog CAP-DATAFIX | État réel |
|---|---|
| `noMeleePenalty` Chasseresse AH (t6) | ✅ déjà en données (`shooter{ammo:8,noMeleePenalty}`) |
| `noMeleePenalty` Idole Vox (t4) | ✅ déjà en données (`shooter{ammo:7,noMeleePenalty}`) |
| Avatar Vox `flying`+`noRetaliation` | ✅ en données ET listés au doc (réconcilié A1) |
| Cavalier funeste Vit 9/10 | ✅ doc 04 §3 = **10**, données = **10** (déjà aligné) |
| Stats Vox T2/T3/T4/T5 | ✅ données == doc (réconcilié A1) |
| **Stats Vox T7 Phénix** | ❌ doc PV **142** / dmg **22–34** vs données **118** / **18–28** |

**Marqueurs « différé » périmés** dans la table doc 16 §4 (capacités désormais
LIVRÉES en moteur + données) :
- T1 Chœur `performer` (+1 Résonance/round) — livré (F-RESON.2).
- T4 Idole `performer` (+2 Résonance/round) — livré (F-RESON.2).
- T7 Phénix `rebirth(30 %)` (élite 35 %) — livré (CAP-LIFE.2).

**Façade inverse** : T6 Maître liste `spellcaster(...)` comme capacité **active**
alors que les données n'en ont **aucune** (câblage différé pour équilibrage,
CAP-CAST « factions fortes en sim »). → marquer « (différé) » dans la table.

## Étapes

1. `docs/16` §4 table :
   - T7 Phénix : PV 142 → **118**, Dégâts 22–34 → **18–28**.
   - T1 Chœur / T4 Idole : `performer` **sans** « différé ».
   - T7 Phénix : `rebirth(30 %)` **sans** « différé ».
   - T6 Maître : `spellcaster(…)` **(différé — équilibrage, CAP-CAST)**.
   - Mettre à jour la note 📊 DOC-STATS/CAP-DATAFIX (T7 corrigé ; performer +
     rebirth désormais live ; Maître spellcaster différé).
   → vérif : table == données pour les 8 tiers.
2. `.claude/plans/game-feature-gaps.md` : CAP-DATAFIX 🧩 → ✅ (données correctes ;
   doc réconciliée). DOC-STATS reste ✅ (complété).
   → vérif : plus d'item CAP-DATAFIX ouvert mensonger.
3. Gates rapides : typecheck, lint, `content:check` (inchangé), tests contenu +
   moteur (inchangés — aucune donnée touchée). Smoke : **N/A** (doc-only,
   guideline §7) — aucune surface runtime modifiée.

## Garde-fous

- **Aucun diff moteur, aucun diff de données** ⇒ pas de bump save, golden
  inchangé, garde-fous faction/couleurs non concernés, bundle inchangé.
- Décision assumée : ne PAS ajouter le `spellcaster` Maître ni rehausser le
  Phénix — ce serait toucher l'équilibre (CAP-CAST/sim), hors périmètre d'une
  réconciliation. Tracé pour plus tard.
