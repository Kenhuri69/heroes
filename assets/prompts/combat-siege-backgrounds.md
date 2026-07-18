# Fonds de combat — SIÈGE de ville (S4, Règle D — pièces uniques)

> Toiles de fond DOM affichées quand `combat.townId != null` (siège réel), à la
> place du fond de terrain (`combat-<terrain>`). Résolveur : `siegeBackgroundUrl()`
> — chaîne de repli `backgrounds/siege-<factionId>` → `backgrounds/siege` →
> fond de terrain. **Aucun asset ⇒ repli gracieux au terrain** (le client tourne
> déjà sans ces images ; les déposer améliore la cohérence sans changement de code).
>
> Staging : `assets/backgrounds/siege-<id>.jpg` (et `siege.jpg`), 1920×1080,
> JPEG q80-85 (< 500 Ko, hors bundle). Cadrage doc 08 §2.4 : **champ de bataille
> devant des murailles**, silhouette de la ville de la faction assiégée à
> l'horizon, tiers inférieur/premier plan dégagés pour la grille hex et les
> jetons. Gouache du projet (Heroes of Might & Magic concept art).

## siege (générique — repli toutes factions)

```
Epic painterly fantasy battlefield seen from a low angle just outside a besieged walled town: tall grey stone ramparts and a gatehouse fill the upper-right background, a wide trampled open field in the foreground and lower half kept empty for a hex battle grid, distant town towers and rooftops rising behind the walls, siege atmosphere with smoke haze, overcast dramatic sky, Heroes of Might and Magic concept art,
wide 16:9 composition (1920x1080), focal point upper-right ramparts,
darker vignetted edges, lower half and foreground kept open and uncluttered for the hex grid and unit tokens,
atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame, no hex grid drawn, no soldiers, no decorative sparkles, no lens flare
```

## siege-haven

```
Epic painterly fantasy battlefield outside a besieged Haven town: gleaming white-stone ramparts with a gilded gatehouse upper-right, holy banners, distant cathedral spires and blue-roofed keeps behind the walls, sunlit but tense siege atmosphere, off-white masonry, sky-blue and gold accents, Heroes of Might and Magic concept art,
wide 16:9 composition (1920x1080), focal point upper-right ramparts,
darker vignetted edges, lower half and foreground kept open and uncluttered for the hex grid and unit tokens,
atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame, no hex grid drawn, no soldiers, no decorative sparkles, no lens flare
```

## siege-necropolis

```
Epic painterly fantasy battlefield outside a besieged Necropolis town: cracked bone-white and blackened ramparts upper-right, a skull-carved gatehouse, distant crypt spires and mausoleums under necrotic green mist, dead grey ground, tattered black banners, ominous siege atmosphere, Heroes of Might and Magic concept art,
wide 16:9 composition (1920x1080), focal point upper-right ramparts,
darker vignetted edges, lower half and foreground kept open and uncluttered for the hex grid and unit tokens,
atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame, no hex grid drawn, no soldiers, no decorative sparkles, no lens flare
```

## siege-arcane-hunters

```
Epic painterly fantasy battlefield outside a besieged Arcane Hunters town: midnight-blue stone ramparts inlaid with glowing cyan runes upper-right, a rune-lit gatehouse, distant silver-trimmed towers behind the walls, arcane violet dusk sky, tense siege atmosphere, Heroes of Might and Magic concept art,
wide 16:9 composition (1920x1080), focal point upper-right ramparts,
darker vignetted edges, lower half and foreground kept open and uncluttered for the hex grid and unit tokens,
atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame, no hex grid drawn, no soldiers, no decorative sparkles, no lens flare
```

## siege-sylvan-court

```
Epic painterly fantasy battlefield outside a besieged Sylvan Court town: living green ramparts of grown timber and mossy stone upper-right, a vine-wreathed gatehouse, distant treetop spires and golden-leaf canopies behind the walls, verdant forest siege atmosphere, emerald and amber accents, Heroes of Might and Magic concept art,
wide 16:9 composition (1920x1080), focal point upper-right ramparts,
darker vignetted edges, lower half and foreground kept open and uncluttered for the hex grid and unit tokens,
atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame, no hex grid drawn, no soldiers, no decorative sparkles, no lens flare
```

## siege-vox-arcana

```
Epic painterly fantasy battlefield outside a besieged Vox Arcana town: scholarly grey-stone ramparts with arched stained-glass windows upper-right, a grand collegiate gatehouse, distant clock towers and banners of five houses behind the walls, magical dusk with drifting light motes, tense siege atmosphere, Heroes of Might and Magic concept art,
wide 16:9 composition (1920x1080), focal point upper-right ramparts,
darker vignetted edges, lower half and foreground kept open and uncluttered for the hex grid and unit tokens,
atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame, no hex grid drawn, no soldiers, no decorative sparkles, no lens flare
```

## siege-dungeon

```
Epic painterly fantasy battlefield outside a besieged Dungeon town: jagged black-obsidian ramparts upper-right lit by sulfurous red glow, a barbed spiked gatehouse, distant spire-fangs and cave mouths behind the walls, ash-grey ground, dark-elf banners, menacing subterranean siege atmosphere, Heroes of Might and Magic concept art,
wide 16:9 composition (1920x1080), focal point upper-right ramparts,
darker vignetted edges, lower half and foreground kept open and uncluttered for the hex grid and unit tokens,
atmospheric depth, volumetric light,
no text, no watermark, no signature, no border frame, no hex grid drawn, no soldiers, no decorative sparkles, no lens flare
```

## Extraction au retour (JPEG opaque, pas de détourage)

```bash
# Redimensionner/compresser vers le staging (hors bundle, budget < 500 Ko).
python3 tools/assets/process_background.py --src <img> --id siege-necropolis --dest assets/backgrounds
# → assets/backgrounds/siege-necropolis.jpg (résolveur siegeBackgroundUrl(), drop-in)
```
