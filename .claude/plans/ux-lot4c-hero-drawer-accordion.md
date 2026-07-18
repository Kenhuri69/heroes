# Lot 4c (P1) — Confort de gestion : tiroir héros repliable (E7)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 4, item 3 (E7 🟡). Le tiroir
> héros empile armée / équipement / compétences / grimoire / quêtes en **une
> colonne à défilement** non repliable (`hero-real-mobile-font1.png`). On rend
> chaque section **repliable** (accordéon), **état persisté localement**.
> **Client uniquement — zéro moteur, pas de bump save.**
>
> Note : E12 (équiper/déséquiper interactif) est **déjà livré** dans
> `HeroInventory.tsx` (taps sac↔poupée) ⇒ hors périmètre de ce lot.

## Changement (client)
- Nouveau `CollapsibleSection.tsx` : hook `useCollapsed(id, defaultCollapsed?)`
  (persiste `heroes.section.<id>` en `localStorage`, repli gracieux navigation
  privée) + composant `SectionToggle` (bouton titre + chevron `▾/▸`,
  `aria-expanded`, cible ≥ 44 px).
- Les 5 sections du tiroir consomment le hook : le `<h3>` de titre devient le
  **toggle**, le corps se masque quand replié. Ordre inchangé (armée,
  équipement, compétences, grimoire, quêtes). **Ouvertes par défaut** (aucune
  perte de contenu à la 1ʳᵉ ouverture ; le choix du joueur persiste).
  - `shell.tsx` : bloc **armée** (titre + `ArmySlots` + `HeroSwapButton`).
  - `HeroInventory.tsx` (équipement), `HeroSkills.tsx` (compétences),
    `AdventureSpellbook.tsx` (grimoire d'aventure), `QuestJournal.tsx` (quêtes).
- CSS `.hero-section-toggle` (bouton pleine largeur, ≥ 44 px, chevron), réutilise
  les tokens existants — zéro couleur littérale (garde-fou).

## Vérification
- Smoke @core : tiroir héros desktop ⇒ replier « Compétences » masque son corps,
  le rouvrir le réaffiche ; l'état survit à une fermeture/réouverture du tiroir
  (persistance localStorage).
- typecheck · lint · content (i18n) · build · bundle · smoke @core · gardes
  faction/couleurs.

## Journal
- [x] `CollapsibleSection.tsx` (hook `useCollapsed` persistant + `SectionToggle`
      chevron/aria) + `CollapsibleSection.css` (bouton ≥ 44 px, tokens only).
- [x] 5 sections câblées : armée (shell.tsx : `ArmySlots` + `HeroSwapButton`),
      équipement (`HeroInventory`), compétences (`HeroSkills`), grimoire
      (`AdventureSpellbook`), quêtes (`QuestJournal`). Toutes ouvertes par
      défaut ; hook posé avant tout `return null` (règle des hooks).
- [x] Smoke @core (replier ⇒ corps masqué + `aria-expanded=false` +
      `localStorage['heroes.section.skills']==='1'` ; déplier ⇒ corps rétabli).
      Recette : typecheck · lint · engine 890 (golden inchangé) · content 154 ·
      client 13 · build · bundle 334 801 ≤ 819 200 · smoke @core 26 + mobile 13 ·
      gardes faction/couleurs propres.
- Note : E12 (équiper/déséquiper interactif) déjà livré dans `HeroInventory`
      (H-ARTEQUIP) ⇒ hors périmètre de ce lot.
