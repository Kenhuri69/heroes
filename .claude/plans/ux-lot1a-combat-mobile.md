# Lot 1a (P0) — Combat mobile : rendre le plateau au joueur (DOM/CSS)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 1, items **1-3** (le camera
> clamp E10/item 4 = Lot 1b séparé, sous-système CombatScene). **Client + locales
> uniquement — zéro moteur, pas de bump save.** Constats E1 🔴 (barre qui dévore
> l'écran), E3 🟠 (file d'initiative tronquée sans affordance).

## Items

1. **E1 — barre d'action compacte.** `.combat-actions` scindée en **primaires**
   toujours visibles (Attendre, Défendre, Attaque héros, Sort héros, Auto) et
   **secondaires** (Prière, Sort d'unité, Fuir, Se rendre, Journal, vitesses).
   Sur mobile (≤ 640 px) les secondaires sont repliés derrière un bouton **« ⋯ »**
   (tiroir), sur desktop elles restent inline (zéro régression desktop). Cible :
   barre repliée ≤ ~2 rangées. → verif : mesure de hauteur en smoke @mobile +
   capture avant/après ; cibles ≥ 44 px maintenues.
2. **E1 — bandeau d'aide.** La préviz/consigne (`.damage-preview`) est déjà ancrée
   au-dessus de la barre (UXD-0 R5a) : on la garde **sur une ligne tronquée** sur
   mobile (jamais de retour sur le plateau). → verif : capture, pas de
   chevauchement.
3. **E3 — affordance de défilement de l'initiative.** `.combat-order` défile déjà
   (overflow-x) : ajout d'un **dégradé de fondu** au bord droit + **auto-scroll**
   de la puce active dans la vue. → verif : la puce active est visible après
   changement de tour (assertion smoke), capture du fondu.

## Vérification

- typecheck · lint · content (i18n parité) · build · bundle · smoke @core+@mobile
  · gardes faction/couleurs · captures combat desktop+mobile. Doc 08 §2.4 alignée.

## Journal
- [x] Item 1 (barre compacte + ⋯) — `.combat-actions` scindée primaires/secondaires ;
      « ⋯ » (`combat-more`, locale `combat.more`) masqué desktop (CSS), révèle le
      tiroir sur mobile. **Mesuré : barre 116 px = 18 % du viewport 640** (avant ~50 %),
      cibles ≥ 44 px tenues, desktop inchangé (tout inline).
- [x] Item 2 (bandeau une ligne) — `.damage-preview` déjà ancrée au-dessus de la
      barre ; ellipsis 1 ligne sur mobile ⇒ jamais de retour sur le plateau.
- [x] Item 3 (fondu + auto-scroll initiative) — masque dégradé au bord droit de
      `.combat-order` (`black`/transparent, pas de hex ⇒ garde couleurs vert) +
      `scrollIntoView(inline:center)` de la puce active à chaque changement de tour.
- [x] Recette : typecheck · lint · content 152 · build · bundle 330 529 ≤ 819 200 ·
      **smoke @core 27 (nouveau test « barre compacte mobile ») + mobile 13** ·
      gardes faction/couleurs. Test existant `combat-victoire` mis à jour (Journal
      = action secondaire ⇒ ouvrir « ⋯ » d'abord). Captures mobile repliée/dépliée
      + desktop. Item 4 (camera pan borné) = Lot 1b séparé.
