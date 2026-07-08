# Base d'assets — faction Vox Arcana (Poudlard × KPop Demon Hunters)

> ⚠️ **Rédigé à la main** pour la **validation d'identité** de la faction
> (le paquet `data/factions/vox-arcana/` n'existe pas encore, donc `gen_prompts.py`
> ne peut pas encore émettre ces prompts). À **regénérer** par `gen_prompts.py`
> une fois le lineup en données. Conforme à `docs/12-assets-style-guide.md`.
>
> Nom de faction verrouillé : **Vox Arcana** (id `vox-arcana`). Titre à l'écran
> ex-« K-MAGIX / Demon Tour ».

## État du staging (planches générées + extraites, QC verte)

Les 3 planches ont été générées (Gemini) puis extraites via `sheet_extract.py`
(porte QC verte). **Stagé** (`assets/`) — base complète :
- `assets/heroes/vox-arcana-hermione.png`, `vox-arcana-rumi.png` (Règle B, fond
  contextuel sombre conservé — voulu).
- `assets/houses/vox-arcana/house-{lion,serpent,eagle,badger,venari}.png` (5 blasons).
- `assets/units/vox-arcana/t1..t8.png` — **8/8** (`t1-choeur`, `t2-duelliste`,
  `t3-hippogriffe`, `t4-idole`, `t5-sombral`, `t6-maitre`, `t7-phenix`, `t8-avatar`).

> Note : `t5-sombral` et `t7-phenix` ont été **regénérées** en images séparées
> sur fond gris clair `#c8c8c8` (la 1ʳᵉ planche les peignait sur fond sombre →
> caisson non détourable), puis extraites en 1×1 floodfill. `process_sprite.py`
> (rembg) reste indisponible dans l'environnement (modèle bloqué au proxy) ; le
> floodfill suffit pour un fond plat.

## Palette de faction (à ajouter à doc 12 §2.3 au verrouillage)

```
Dominante : pierre noire gothique, filigrane argent/or
Accent    : cyan électrique + magenta/violet néon, glycine (wisteria)
Ambiance  : académie gothique + toits de pagode coréens, masque d'oni,
            chouettes/corbeaux spectraux, lanternes, néon de concert
```
> Distincte d'Arcane Hunters (bleu nuit + violet arcane + runes cyan) : ici
> **néon pop + glycine + oni coréen**, registre « scène/concert » et non « traque ».

Suffixe universel (doc 12 §7) à coller à TOUS les prompts :
`no text, no watermark, no signature, no border frame, no ground line`

---

## 1. Avatars de héros — Hermione & Rumi (Règle B, 256²)

Planche **2×1**, bustes painterly isolés (fond gris clair pour détourage léger).

```
Portrait sheet, 2 heroic fantasy bust portraits in a 2x1 grid,
painterly digital painting (Heroes of Might and Magic style), NOT photorealistic,
bust shot, 3/4 face turn, determined expression,
warm key light upper-left, cool cyan rim light,
each bust fully isolated with clear empty space around head and shoulders,
each subject centered in its own cell, not touching cell edges,
cell 1: a young studious magic heroine of the Vox Arcana academy — brown wavy hair,
  black-and-violet school robes with silver house filigree, holding a glowing
  wand, wisteria and floating spellbook pages, midnight gothic library behind,
  electric-cyan magical glow
cell 2: a fierce idol demon-hunter heroine of the Vox Arcana academy — purple hair
  in a high braided bun, sleek black-and-violet hunter armor over a school-crest
  tabard, twin glowing neon blades, oni-mask charm, neon-lit gothic bridge with
  wisteria behind, cyan-and-magenta glow
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```
Extraction :
```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 2 --rows 1 --side 256 \
  --ids vox-arcana-hermione,vox-arcana-rumi \
  --out assets/raster_src --qc /tmp/qc-voxarcana-heroes.png
# puis copier vers assets/heroes/
```

---

## 2. Blasons des 5 Maisons (Règle C, planche d'icônes 512² / sujet)

Planche **5 sujets** (grille 3×2, 6ᵉ cellule laissée vide) — écus héraldiques.

```
Item sheet, 5 heraldic house crests in a 3x2 grid (last cell empty),
digital painting, painterly MTG illustration quality, ornate silver-and-gold
metal shield emblems with wisteria vine accents and subtle neon glow,
each crest centered in its own cell with clear spacing,
soft directional light from upper-left, rich material detail,
cell 1: crest of the House of the Lion — golden lion rampant, courage, warm amber glow
cell 2: crest of the House of the Serpent — coiled silver serpent, ambition, green glow
cell 3: crest of the House of the Eagle — spread-winged eagle, wisdom, cyan glow
cell 4: crest of the House of the Badger — badger, loyalty, violet glow
cell 5: crest of House Venari — stylized oni demon mask over crossed neon blades,
  the hunters' house, magenta-and-cyan neon glow, wisteria
flat uniform light grey background (#c8c8c8), no shadow,
no text, no watermark, no signature, no border frame
```
Extraction : `sheet_extract.py --cols 3 --rows 2 --ids house-lion,house-serpent,house-eagle,house-badger,house-venari` → dossier crests dédié au verrouillage.

---

## 3. Planche d'unités T1–T8 (Règle A, 512² RGBA, planche 4×2)

```
Character sheet, 8 fantasy creatures in a 4x2 grid,
digital painting, heroic fantasy concept art (Heroes of Might and Magic,
MTG illustration quality), painterly brush strokes,
each creature centered in its own cell, not touching cell edges,
dynamic action pose, 3/4 view, soft directional light from upper-left,
palette: black gothic + silver/gold filigree, electric cyan + neon magenta,
wisteria violet, Korean oni/pagoda accents, spectral owls,
cell 1: T1 Apprentice Choir — young robed students singing, glowing sound-runes,
  weak swarm, wands
cell 2: T2 Duelist — student duelist casting a wand bolt, defensive stance, ranged
cell 3: T3 Hippogriff — noble winged beast, melee flyer, feathers with cyan sheen
cell 4: T4 Idol Huntress — armored KPop-idol demon hunter, twin neon blades,
  performing pose, elite ranged
cell 5: T5 Thestral — skeletal winged horse, spectral, fear aura, dark flyer
cell 6: T6 Spellmaster — elder professor mage, staff, area magic, floating tomes
cell 7: T7 Phoenix — blazing rebirth bird, dominant, cyan-and-magenta flames
cell 8: T8 Honmoon Avatar — radiant fusion of mage and idol, neon barrier wings,
  apex form unlocked at max Resonance
flat uniform light grey background (#c8c8c8), no ground shadow,
no text, no watermark, no signature, no border frame, no ground line
```
Extraction :
```bash
python3 tools/assets/sheet_extract.py <planche.png> \
  --cols 4 --rows 2 --side 512 \
  --ids t1-choeur,t2-duelliste,t3-hippogriffe,t4-idole,t5-sombral,t6-maitre,t7-phenix,t8-avatar \
  --out assets/units/vox-arcana/
```
> T5 : Sombral (validé). Swap possible vers un esprit coréen (Kumiho/Haetae) plus tard.
