# Fix — buildSpellCatalog propage area/chain

Bug de cohérence code↔données découvert au lot summon : `buildSpellCatalog`
(loader) sélectionne les champs de sort explicitement et OMET `area` et `chain`
⇒ le moteur ne voit jamais la zone d'effet (Boule de feu splash, Météore,
Armageddon) ni la chaîne (Chaîne d'éclairs) des données en jeu réel. Les tests
moteur (SpellDef inline) le masquaient.

Fix : propager `area`/`chain` dans `buildSpellCatalog`, + test de régression
content. Zéro faction, pas de bump save.

Vérif : golden INCHANGÉ (à confirmer — le golden charge-t-il le vrai catalogue ?).
