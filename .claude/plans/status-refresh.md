# Sorts de statut : relancer rafraîchit, sans cumul

> Reliquat relevé au journal du lot R1 (`r1-sim-unit-spells.md`) ; choix de
> l'utilisateur le 2026-10-28 : « statuts qui se cumulent », à traiter.

## 1. Constat

- `castSpellEffect` (`combat/spell-effect.ts`) fait `t.statuses.push(...)` pour
  tout buff, débuff ou silence. Relancer le même sort sur la même pile **ajoute**
  un second statut, et les modificateurs se somment (`statusModSum`) : deux
  Malédictions = −2× l'attaque, sans limite.
- Les malédictions et le poison d'unité (`damage.ts`) rafraîchissent déjà le
  statut existant (même `spellId`). Seuls les sorts empilent.
- HoMM : relancer un sort déjà actif remplace l'effet et repart pour une durée
  pleine ; deux sorts **différents** coexistent.

## 2. Décision

- Même `spellId` déjà présent sur la pile ⇒ le statut est **remplacé** (mods du
  nouveau lancer, durée pleine), comme les malédictions. Sorts différents :
  inchangé, ils coexistent.
- L'IA garde sa règle (elle ne relance pas un débuff posé).
- Pas de champ nouveau ⇒ pas de bump `CURRENT_SAVE_VERSION`.

## 3. Étapes

1. [x] Moteur : remplacement par `spellId` dans `castSpellEffect` ; test
2. [x] Docs 02 (sorts/statuts), CLAUDE.md
3. [ ] Vérifications (golden, `faction:sim`, Playwright)

## 4. Vérifications

- [x] typecheck (sans `-s`), lint, build ; garde-fous ; `content:check` ; budget 389 726 o gzip
- [x] tests : moteur 1133 (+2), contenu 206, client 113, serveur 10 ; golden inchangé
- [ ] Playwright comme en CI

## 5. Journal

- 2026-10-28 : plan ouvert.
- 2026-10-28 : moteur, test, docs 02 et CLAUDE.md livrés.
  - Le test échoue sur `main` (deux statuts) et passe avec le correctif.
  - `faction:sim` : sortie **identique à l'octet** avant/après — l'IA ne relance
    jamais un débuff posé, et un buff n'est relancé que sur une autre cible ;
    aucun re-tuning.
