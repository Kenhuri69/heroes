# Lot D-data — décisions design données (D8, D12)

Sous-lot de `code-doc-coherence-remediation.md` (Lot D). Deux écarts
code↔doc résolus **côté données / docs** (aucun diff moteur).

## Portée

- **D8** — Prérequis « Château » (fort@3) des dwellings sommets absent des
  données. Les docs le spécifient déjà :
  - doc 03:76 (Haven) : « (+ Château requis pour T7) »
  - doc 04:69 (Necropolis) : « (+ Château requis pour T7) »
  - doc 05:217 (Arcane Hunters) : Portail de l'Abîme (T8) requiert
    « Habitation T7 + Château »
  Seules les données de dwelling ne portaient que le tier précédent. Le
  tier sommet (T7 Haven/Necropolis, T8 AH) doit exiger `fort@3` en plus.
- **D12** — Aucune table des unités élites (variantes niveau-2 de dwelling)
  dans les docs pour arbitrer les coûts. Déliverable : **documenter** la
  table (nom/stats/coût) par faction (docs 03/04/05). L'arbitrage des coûts
  (« élite moins chère que la base chez Haven/Necro, 2-3× plus chère chez
  AH ») réclame un `faction:sim` — **différé**, on ne devine pas les coûts.

## Étapes & vérification

1. **D8** — ajouter `{ "building": "fort", "level": 3 }` au `requires` du
   niveau 1 des dwellings sommets, en gardant la dépendance de chaîne :
   - `haven/buildings.json` : `haven-dwelling-t7` lvl1.
   - `necropolis/buildings.json` : `necropolis-dwelling-t7` lvl1.
   - `arcane-hunters/buildings.json` : `arcane-hunters-dwelling-t8` lvl1
     (l'apex AH est le T8 ; le T7 Fauconnerie reste gaté par T6, conforme
     doc 05 où seul le Portail T8 exige le Château).
   → vérif : `content:check` OK ; `balance.test.ts` / `faction-recruit.test.ts`
   re-passent (les stats d'unités sont inchangées ⇒ pas de régression
   d'équilibrage) ; aucun smoke ne bâtit un dwelling sommet via
   `BuildStructure` (recrutements de test posent `buildings` en dur).
2. **D12** — ajouter une table « Unités élites » aux docs 03/04/05
   (nom localisé, stats, coût de recrutement, croissance), extraite des
   données `units.json`. Noter explicitement le report de l'arbitrage des
   coûts à un futur `faction:sim` (E5/roadmap).
   → vérif : parité doc↔données (chiffres extraits des JSON, pas inventés).

## Invariants (rappel guidelines §7/§8)

- Zéro diff moteur (données + docs seulement). Golden **inchangé**.
- Garde-fou faction vert (aucun nom de faction dans le moteur/tests).
- typecheck 5/5, `pnpm lint`, engine + content, content:check, color guard,
  build < 800 Ko gzip, smoke desktop + mobile.

## État : livré.

- D8 : `fort@3` ajouté aux dwellings sommets (haven-t7, necropolis-t7,
  arcane-hunters-t8). content:check OK, balance + faction-recruit verts.
- D12 : tables élites §3bis (03/04) et §4bis (05) ; mécanisme corrigé
  (dwelling niveau 2) ; asymétrie chiffrée, arbitrage coûts différé sim.
- E5 hérite du reste (F1 capacités count, F6/F5/F8/F9/F3/F15…).

