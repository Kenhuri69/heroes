# Lot C-1 — grimoire de combat (C1 + C2)

Remédiation code↔docs, §3 (client/UI). Sous-lot « grimoire » (SpellBook), le
reste du Lot C (C3 sorts de départ, C4 brouillard/vision, C5 préviz de chemin)
en PR suivante.

## Correctifs

- **C1** — l'école `traque` (et toute future école de faction) était OMISE du
  grimoire (`SCHOOL_ORDER` codait en dur les 5 écoles universelles) : sorts
  connus, acceptés par le moteur, jamais affichés. Ordre désormais DÉRIVÉ des
  sorts connus (`orderedSchools` : 5 universelles d'abord, écoles de faction
  après). + texte de prévisualisation `applyMarks` (`spellbook.previewMarks`,
  locales FR/EN).
- **C2** — disponibilité/coût affichés sur `spell.manaCost` BRUT alors que le
  moteur encaisse `effectiveManaCost` (réduction Magie par école, A6) ⇒ un sort
  lançable pouvait s'afficher grisé et le coût était faux. Le grimoire lit
  désormais `effectiveManaCost(hero, skillCatalog, spell)` (export ajouté à
  `@heroes/engine`) pour le gating ET l'affichage.

## Vérification

- typecheck 5/5 · lint · moteur/contenu inchangés · content:check (locales) ·
  guards faction/couleur · budget < 800 Ko · smoke (flux de sort en combat =
  non-régression ; la visibilité de `traque` sera testable avec un héros AH une
  fois C3 livré — l'audit i18n couvre la nouvelle clé).

## Écarts

- Pas de nouveau cas smoke dédié à la visibilité `traque` : elle exige un héros
  d'Arcane Hunters ; aujourd'hui tout héros connaît les sorts de Traque (bug C3,
  corrigé dans la PR suivante), donc un tel test serait fragile au merge de C3.
