# Lot M-TAVERN.4 — Pool de taverne exclusif + IA recruteuse

> Plan vivant (guidelines §5). Source : doc 02 §1.5 (« héros vaincu re-recrutable »),
> §4.1 (Taverne). Backlog `game-feature-gaps.md` M-TAVERN.4.

## Objectif

1. **Pool exclusif inter-joueurs** : un héros du roster ne peut être **vivant que
   chez UN joueur à la fois**. Un héros **mort** (retiré de la partie) redevient
   recrutable par tous.
2. **IA recruteuse** : l'IA d'aventure recrute un héros quand elle est **riche**
   (or ≥ marge) et **sous le cap**, à une ville dotée d'une Taverne.

## Invariants (guidelines §8)

- Zéro faction moteur (garde-fou CI).
- RNG seedé uniquement (aucun RNG ajouté).
- Moteur sans rendu.
- **Bump save** : ajout de `HeroState.rosterId` (id du roster d'origine, '' sinon)
  — nécessaire pour connaître l'origine roster d'un héros VIVANT (y compris un
  héros nommé de DÉPART, cf. H-NAMED.2 à venir). `CURRENT_SAVE_VERSION` 25→26,
  save-shape mise à jour, **golden re-fixé** (forme seule — le hash inclut les
  héros). Justifié, non contestable (l'exclusivité a besoin de cette donnée).

## Étapes

1. Moteur — `HeroState.rosterId` (state.ts, bump 25→26 + doc). Posé par
   `StartGame` (`p.startingHeroId ?? ''`) et `RecruitHero` (`cmd.heroId`).
2. Moteur — `validateRecruitHero` : exclusivité = aucun héros VIVANT avec
   `rosterId === cmd.heroId` (remplace le check « déjà recruté par ce joueur »,
   qu'il subsume). Un héros mort libère l'entrée.
3. Moteur — IA : `tryRecruitHero` (town-ai.ts) appelé dans `playTownTurn` —
   Taverne bâtie, or ≥ `recruitCost` + marge, héros < cap, 1er roster hero
   éligible (faction de la ville, non pris) ; réutilise `validate/handleRecruitHero`.
4. Tests moteur : exclusivité (p1 recrute ⇒ p2 refusé ; p1 mort ⇒ p2 OK),
   IA recrute quand riche + Taverne (property IA vs IA toujours verte, save-shape,
   golden re-fixé).
5. Client : rien de neuf requis (l'onglet Taverne existe) — la carte « Recruté »
   reflétera l'exclusivité via `validateRecruitHero`. Smoke : couvrir
   l'exclusivité via le hook (recruter chez p1 ⇒ recrutement chez p2 refusé).
6. Docs : doc 02 §1.5/§4.1 (état livré), backlog. Vérif complète + PR + merge.

## Journal

- Moteur : `HeroState.rosterId` (save 25→26, doc 07 implicite via state.ts) posé
  par StartGame (`startingHeroId ?? ''`) et RecruitHero (`cmd.heroId`).
  `validateRecruitHero` : exclusivité = aucun héros vivant `rosterId===heroId`.
  IA `tryRecruitHero` (town-ai.ts, marge or ×2, sous cap). Golden re-fixé
  22d88254→15b26649 (forme). save-shape 25→26. 12 fixtures de test complétées
  d'un `rosterId: ''`. 573 tests verts (dont property IA vs IA).
- Client : onglet Taverne — `rosterId` distingue « Recruté » (mien) /
  « Indisponible » (rival) ; locale `town.tavernUnavailable` FR/EN.
- Smoke : hot-seat haven vs haven, p1 recrute « anton » ⇒ p2 refusé + pas d'anton
  chez p2. Desktop + mobile verts.
