# Fonds de combat — SIÈGE de ville (S4, Règle D — pièces uniques)

> **Style validé** (réf. capture du jeu d'origine, 2026-07) : **vraie vue
> cinématique large** d'une cité assiégée — remparts/guérites/flèches au
> milieu-droite, **champ de bataille boueux dégagé** au premier plan, ciel d'orage
> percé de rayons, fumées. Affichés en fond DOM quand `combat.townId != null`
> (`siegeBackgroundUrl()` : `backgrounds/siege-<factionId>` → `siege` → repli
> terrain). **Art à générer** — code câblé, repli gracieux au terrain sans JPEG.
> Staging `assets/backgrounds/siege-<id>.jpg`, 1920×1080, q80-85 (< 500 Ko).

## siege (générique)
```
A besieged medieval fantasy walled city seen across a battlefield — wide cinematic matte painting, Might & Magic Heroes Online concept-art style, semi-realistic and painterly.
A long grey stone curtain wall with battlements, round towers and a fortified gatehouse runs across the middle and right distance; pointed castle spires and rooftops rise behind it; columns of dark smoke drift up from fires on the ramparts.
The foreground and left are a wide churned muddy battlefield — puddles, cart ruts, scattered broken timber — open and empty, ready for troops.
Heavy overcast sky with dramatic shafts of light breaking through the clouds, atmospheric haze and depth, muted grey-brown-green palette.
16:9 (1920x1080), horizon in the upper third, foreground kept clear.
No text, no watermark, no UI, no characters, no hex grid.
```

## Par faction — garder le prompt ci-dessus, remplacer la phrase du mur
- **siege-haven** : `a long white-stone wall with a gilded gatehouse and holy banners; blue-roofed spires; warmer sunlit haze`
- **siege-necropolis** : `a long bone-white and blackened wall with a skull-carved gatehouse; spectral green mist and cold fires; dead grey ground`
- **siege-arcane-hunters** : `a long dark-blue stone wall etched with glowing cyan runes and a rune-lit gatehouse; violet dusk`
- **siege-sylvan-court** : `a long living wall of grown timber and mossy stone with a vine-wreathed gatehouse; golden-leaf canopies; verdant green`
- **siege-vox-arcana** : `a long scholarly grey wall with tall arched stained-glass windows and a collegiate gatehouse; clock towers; drifting light motes`
- **siege-dungeon** : `a long jagged black-obsidian wall lit by sulfurous red glow with a spiked gatehouse; cave-mouth spires; ash-grey ground`

> Astuce : si le générateur accepte une **image de référence**, lui passer la
> capture « cité assiégée » du jeu d'origine (image-to-image) — le rendu colle mieux.
