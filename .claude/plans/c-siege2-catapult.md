# Lot C-SIEGE2.2 — catapulte de siège (brèche le rempart)

> Suite de C-SIEGE2.1 (murs de grille avec porte). Incrément **(b)** du backlog
> §2.1 : « catapulte auto (machine de guerre, réutilise la Forge) » + brèche des
> murs. Doc 02 §5. Rend le rempart **franchissable au-delà de la porte** quand
> l'assaillant apporte une catapulte.

## Décision de portée (brèche au montage)

Modèle **simple, sûr et faithful** : la catapulte est une **machine de guerre**
(comme la Baliste — vendue par la Forge, portée par `hero.warMachines`, rejoint
le combat comme pile). Sa présence à un siège de ville **fortifiée** représente
le bombardement pré-assaut : au **montage du combat**, elle **élargit la brèche**
en retirant les segments de mur qui **flanquent la porte** (rangées adjacentes),
doublant l'ouverture. Marqueur de données `siegeBreaker` (comme `warMachine`,
non catalogué — les capacités de machine de guerre ne sont pas cross-validées).

Bombardement tour-par-tour (catapulte ciblant un segment chaque round) = refinement
ultérieur ; PV de segment / destruction par les unités = plus tard. Zéro nouvelle
action de combat, zéro changement d'IA, zéro ciblage client — la brèche est un
retrait de segments au montage (le rendu .1 des murs la reflète déjà).

## Changements

- **Données** : `data/core/war-machines.json` += `catapulte` (`warMachine` +
  `siegeBreaker`, stats d'engin de siège lent/tanky) ; Forge
  (`buildings.json warMachineVendor.units`) += `catapulte` ; locales FR/EN.
- **Moteur** : `buildSiegeWalls(fortLevel, breached)` — `breached` élargit la
  porte (retire les rangées flanquantes) ; `beginTownCombat` détecte un
  `siegeBreaker` dans `hero.warMachines` (`hasAbility`) ⇒ `breached`.
- Champ `CombatState.siegeWalls?` **inchangé** (`OffsetPos[]`) : la brèche = moins
  de segments. Pas de bump save, golden inchangé.
- Doc 02 §5 (état v2 .2) + backlog C-SIEGE2.

## Vérification

- tests moteur `town-siege` : catapulte ⇒ porte élargie (segments flanquants
  retirés) ; sans catapulte ⇒ rempart plein ; la catapulte rejoint bien la pile
  attaquante. typecheck 5/5 · lint · content:check (catapulte vendue par la Forge)
  · golden + save-shape inchangés · garde-fous · build + bundle · smoke non régressé.

## Journal

- 2026-07-12 — Plan créé, branche `claude/c-siege2-catapult` depuis main (@2b18fef).
- 2026-07-12 — **Implémenté**. Données : `catapulte` (war-machines.json,
  `warMachine`+`siegeBreaker`) + Forge vendor + locales FR/EN. Moteur :
  `buildSiegeWalls(fortLevel, breached)` (brèche élargie), détection `siegeBreaker`
  dans `hero.warMachines` (`hasAbility`) au montage. Doc 02 §5 (état v2 .2) +
  backlog. **Vérifs** : typecheck 5/5 ✅, lint ✅, engine **660** (+1 `town-siege`
  catapulte) ✅, golden + save-shape **inchangés** ✅, content 123 + content:check
  (catapulte vendue par la Forge) ✅, parité FR/EN ✅, garde-fous ✅, build + bundle
  307 Ko gzip ✅. Zéro client, pas de bump save. Smoke en cours (non régressé).
