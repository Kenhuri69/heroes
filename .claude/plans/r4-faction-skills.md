# R4 — Deux compétences de faction : Sylve et Chasse rituelle

> Lot R4 du plan `game-experience-enrichment.md` (§5bis.2), amendé par l'expert
> (§5bis.4) et tranché par l'utilisateur le 2026-10-08 (§5bis.5) : D-R4a paliers
> de départ, D-R4b toute victoire, D-R4c Rumi +25 % de Résonance ; valeurs de
> Chasse rituelle estimées en équivalent or avant d'être figées.

## 1. Constat

- Sylvan Court et Arcane Hunters n'ont aucune compétence de faction
  (`manifest.heroSkills` vide), quand Haven a la Prière et Necropolis la
  Nécromancie.
- `startingSymbiosisStacks` (Faelar) n'est lu que sur Maison, spécialité et
  archétype (`sumHeroEffectField`), pas sur les rangs de compétence.
- Le gain d'Essence/Résonance après victoire est un montant plat : aucun champ
  ne le module. Rumi porte `rangedDamagePct 10` alors que le doc 16 §6 annonce
  « +25 % de gain de Résonance ».

## 2. Décisions

- **Sylve** (`woodland-bond`, Sylvan) : `startingSymbiosisStacks` 1 / 2 / 3 ;
  `applyStartingSymbiosis` lit le total compétences + Maison + spécialité
  (`heroEffectTotal`), toujours borné par `maxStacks` de l'unité (4).
- **Chasse rituelle** (`ritual-hunt`, Arcane Hunters) : nouveau champ d'effet
  générique `factionResourceGainPct` 20 / 40 / 60, appliqué à chaque
  `gainFactionResourceOnVictory` du vainqueur, **arrondi vers le haut**, sur
  toute victoire. Clause « Maître : 1ʳᵉ consommation de Marques gratuite »
  écartée (second point d'extension).
- **Rumi** : spécialité `factionResourceGainPct 25` (au lieu de `rangedDamagePct 10`).
- Valeurs de Chasse rituelle — estimation en équivalent or (journal) ⇒ 20/40/60
  plutôt que 10/20/30 (doc 05 §7, amendé).

## 3. Étapes

1. [ ] Moteur : champ `factionResourceGainPct` (types, schéma), gain arrondi haut, Sylve sur les rangs ; tests
2. [ ] Données : 2 compétences (`skills.json`), `heroSkills` des 2 manifestes, Rumi, locales FR/EN
3. [ ] Docs 05 §7, 14 §6, 16 §6, 02 (compétences), CLAUDE.md, plan d'enrichissement
4. [ ] Vérifications

## 4. Vérifications

- [ ] typecheck (sans `-s`), lint, build ; garde-fous faction et couleurs ; `content:check`
- [ ] tests moteur, contenu, client, serveur ; golden inchangé
- [ ] Playwright comme en CI

## 5. Journal

- 2026-10-08 : plan ouvert.
- 2026-10-08 : valeur de Chasse rituelle en équivalent or.
  - L'Essence ne sert qu'au Pénitent (T8 : 40, élite 72), dont la croissance de
    1/semaine est partagée avec la Manticore (`sharedGrowthGroups`). À 10 par
    victoire, un héros qui gagne ~1 combat par jour couvre déjà le Pénitent de
    base ; l'Essence ne devient rare que pour l'élite (72/semaine).
  - Écart de valeur entre un Pénitent élite et une Manticore élite de l'ordre de
    3 000 or ⇒ ~40 or par Essence quand elle est rare.
  - À 10/20/30 % (+1/2/3 par victoire, ~7 victoires par semaine) : ~40/80/120 or
    par jour, loin d'Économie (250/500/1000) ⇒ la compétence ne serait jamais
    prise. À 20/40/60 % (+2/4/6) : ~80/160/240 or par jour, encore sous
    Économie mais utile à une armée qui vise le Pénitent élite. Retenu.
