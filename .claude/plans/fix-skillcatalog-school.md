# Fix — buildSkillCatalog propage `school`

2e bug de la classe « le builder de catalogue jette un champ de schéma lu par le
moteur » (après area/chain de #379). `buildSkillCatalog` construit `{ id, ranks }`
et OMET `school` ⇒ les 4 compétences de magie par école (magic-fire/water/earth/
air) perdent leur `school` en jeu réel ; `heroManaCostReduction` (A6, doc 02 §1.3)
compare `def.school !== school` sur un `school` toujours `undefined` ⇒ la réduction
de mana par école ne s'applique JAMAIS. Masqué par les tests moteur (HeroSkillDef
inline).

Fix : propager `school` dans buildSkillCatalog + test de régression content.
Zéro faction, pas de bump save, golden inchangé (moteur indépendant du contenu).
