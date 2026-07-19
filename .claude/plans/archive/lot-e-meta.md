# Lot E-meta — CLAUDE.md + hygiène des commentaires (E7, E8)

**Dernier** sous-lot du Lot E (et du plan de remédiation code↔doc). E8
touche du **code** (commentaires) → vérification complète, golden inchangé.

## E7 — CLAUDE.md (mémoire projet)
- `CURRENT_SAVE_VERSION` 3 → **8** + historique v5→v8.
- Liste des factions : ajout **sylvan-court** (arbo `data/factions/`).
- Liste des scénarios : prologue + chapitres de campagne + événements
  (12 scénarios), pas seulement tutorial/survival/conquest.
- Note « systèmes livrés depuis » (marché, machines de guerre, upgrades,
  contrats, hot-seat, quêtes/campagnes N1→N3c, objets de carte en passant).
- Bloc « Remédiation cohérence code ↔ doc » (renvoi au plan A→E).

## E8 — Commentaires menteurs (CODE) — corrigés après vérif du code réel
- `hero/skills.ts` : Recherche (vision) et Économie (or/jour) disaient
  « hors périmètre » alors que **branchés** (`revealAround` / `core/engine.ts`) ;
  Commandement (moral) disait « NON branché » alors que **branché** via
  `moraleOf` (`state-helpers.ts:70,95` ⇒ `heroMoraleForSide` ⇒ `heroMorale`).
- `combat/damage.ts` : morale « PAS branché / hors périmètre lot K » → reformulé
  (traité dans `moraleOf`, pas dans damage.ts).
- `town/types.ts` : effet `none` listait la **Forge** « sans effet » alors
  qu'elle porte `warMachineVendor` (Alpha 4.12) → Taverne seule en exemple.
- `adventure/config.ts` : « classes au MVP » → profil unique livré, classes
  différées.
- `adventure/movement.ts:33` : fausse citation doc **déjà corrigée en D6** —
  revérifiée, OK (ramassage en passant).

## Vérification (E8 = code ⇒ suite COMPLÈTE)
typecheck 5/5 · `pnpm lint` · **golden INCHANGÉ** (commentaires seuls) ·
engine+content · content:check · garde-fous faction/couleur · build < 800 Ko ·
smoke desktop+mobile.

## État : livré. **Clôt le plan de remédiation code↔doc (Lots A→E).**
