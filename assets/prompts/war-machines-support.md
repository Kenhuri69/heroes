# Planche — machines de guerre de soutien (S5a : tente & chariot)

> **Art LIVRÉ** (réf. captures du jeu d'origine, 2026-07). Style peint semi-réaliste
> *Might & Magic Heroes Online*, planche 2 sujets sur **fond gris plat** `#c8c8c8`.
> Split au milieu → `assets/units/core/first-aid-tent.png` (gauche) &
> `ammo-cart.png` (droite). Mêmes clés ⇒ substitution par dépôt de PNG ; le
> registre auto-découvre, `unitSpriteUrl` retombe sur `units/core/<id>`.

## Prompt
```
Two medieval war-machine support units for a strategy game — painterly game-asset sheet, Might & Magic Heroes Online concept-art style, semi-realistic, 2 subjects side by side, clear spacing.
Left: a First Aid Tent — a small deployed canvas field tent on a wooden frame, open flap showing medical supplies, a pennant on a pole, guy-ropes and stakes.
Right: an Ammo Cart — a two-wheeled wooden supply wagon loaded with crates, barrels and bundled bolts under a tied canvas, a brake chock at the wheel.
3/4 view, soft directional light, crisp readable silhouettes, weathered wood-canvas-iron palette, no faction markings.
Each fully inside its own area with generous margin, nothing cropped. Flat uniform light grey background (#c8c8c8), no cast shadow.
No text, no watermark, no border, no ground line.
```

## Extraction
Split au milieu, détourage fond-connecté + plus grande composante par moitié
(jette le sparkle), trim, cap 512 px → `assets/units/core/{first-aid-tent,ammo-cart}.png`.
Aucun code à changer.
