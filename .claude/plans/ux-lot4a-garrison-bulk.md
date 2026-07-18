# Lot 4a (P1) — Confort de gestion : garnison « tout transférer » (E5)

> Plan `game-ergonomics-immersion-review.md` §5 Lot 4, item 1 (E5 🟠). La garnison
> se transfère **slot par slot** (un bouton par pile) ⇒ préparer une armée avant
> bataille est laborieux. **Client uniquement — zéro moteur** (compose la commande
> `GarrisonTransfer` existante), pas de bump save.
>
> Note : Lot 3 tail (E8 confirmer attaque perdue, E14 filtres de journal — 🟡, avec
> plomberie disproportionnée) DIFFÉRÉ au profit de ce lot plus utile.

## Changement (client)
- `GarrisonTab` : deux boutons globaux — **« Tout vers le héros »** (from `town`) et
  **« Tout vers la garnison »** (from `hero`). Chacun boucle sur l'**état frais**
  (transfère la 1ʳᵉ pile restante jusqu'à épuisement — évite le bug « boucle sur un
  état périmé » de HeroSwap B14), s'arrête sur erreur (destination pleine) avec
  message localisé. Grisés si le héros est absent ou la source vide.
- « Équilibrer » (split HeroSwap) : différé (plus lourd — nécessite la logique de
  répartition ; les deux « tout transférer » couvrent le gros de la friction E5).

## Vérification
- Smoke @core (ville) : construire/recruter puis **« Tout vers le héros »** ⇒ la
  garnison se vide dans l'armée du héros en UN geste (assertion sur les comptes).
- typecheck · lint · content (i18n) · build · bundle · smoke @core+@mobile · gardes.

## Journal
- [x] `transferAll('town'|'hero')` : boucle sur l'état frais (`findIndex` 1ʳᵉ pile,
      le handler moteur `splice` compacte ⇒ termine), stop sur erreur. 2 boutons
      `garrison-all-to-hero`/`-to-town` (grisés si source vide) + i18n + CSS.
      Confirmé moteur : pas de règle « garder la dernière pile » (héros videable).
- [x] Smoke @core (E5 aller-retour : héros 2 piles → garnison → héros, en 1 clic
      chacun). Recette : typecheck · lint · content 152 · engine 890 (non touché) ·
      client 13 · build · bundle 334 162 ≤ 819 200 · smoke @core 31 + mobile 13 ·
      gardes faction/couleurs.
- [ ] « Équilibrer » (split HeroSwap) : différé.
