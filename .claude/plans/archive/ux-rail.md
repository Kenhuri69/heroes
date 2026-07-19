# UX-RAIL — Revenu « +X/j » inline dans la barre de ressources (backlog §UX, 🧩 S)

Doc 08 §2.1 (note M6) : la barre haute affiche les stocks de ressources SANS
le revenu quotidien inline ; le revenu n'est visible qu'en ouvrant la fiche
`ResourceDetail` (tap). Le wireframe desktop attend le revenu « +X/j » à côté
de chaque stock (arbitrage UXD-8 : livrer l'inline plutôt qu'un rail droit
séparé — le rail droit existe déjà pour héros/mini-carte, dédoubler les
ressources y serait redondant).

## Décision

Ajouter un petit « +N » (revenu quotidien projeté) à côté de chaque stock de
ressource dans `ResourceBar` (`shell.tsx`), via le helper moteur pur existant
`dailyIncome` (déjà consommé par `ResourceDetail`, pattern R7). Visible sur
desktop (la barre a la place) ; **masqué en portrait compact** (≤ 640 px, la
barre tient sur une ligne à défilement — le détail reste au tap). Client pur,
zéro moteur, zéro save.

## Étapes

1. [x] `ResourceBar` : `dailyIncome(game, player.id)` calculé une fois ; par
   ressource commune à revenu > 0, rendre `<span class="resource-income"
   data-testid="resource-income-<id>">+N</span>` dans le bouton.
2. [x] CSS `styles.css` : `.resource-income` (petit, teinté positif, insécable) ;
   masqué sous 640 px (`display: none`) pour préserver la rangée compacte.
3. [x] Backlog UX-RAIL ✅ ; doc 08 §2.1 note « revenu inline livré (desktop) ».
   → vérif : typecheck/lint/build + smoke (barre de ressources rendue,
   nouveau testid présent quand revenu > 0 ; le détail au tap inchangé).
