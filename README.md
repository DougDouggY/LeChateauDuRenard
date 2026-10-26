# Le Château du Renard — La dernière veille

Prototype vertical de défense de château, jouable sur ordinateur dans un navigateur. Un chevalier humain et deux compagnons autonomes défendent quatre fronts. Le jeu est implémenté en TypeScript et Canvas 2D, avec Vite. Il n’utilise pas Phaser : la simulation, les collisions, la navigation et le rendu sont de petits modules séparés et inspectables.

## Démarrer

Prérequis : Node.js 22.12+ (validé ici avec Node 24) et npm. Aucun compte, secret, service distant ou base de données n’est nécessaire. Les images et polices sont servies localement.

```sh
npm ci
npm run dev -- --port 5173
```

Ouvrir le serveur Vite dans un navigateur de bureau et choisir **Prendre la garde**. Une préparation de 25 secondes précède la première vague. L’atelier permet de déclencher l’assaut plus tôt.

```sh
npm run build          # Vérification TypeScript et bundle de production
npm test               # Tests de simulation, sans navigateur
npm run test:browser   # Tests d’interactions dans Chromium et captures réelles
npm run preview        # Servir le bundle de production après build
```

Les tests navigateur démarrent et arrêtent leur propre serveur sur le port 5174. Ils attendent Chromium à `/usr/bin/chromium` ; `CHROMIUM_PATH` permet de choisir un autre exécutable installé. Les captures et résultats courants sont écrits dans `artifacts/` (ignoré par Git). Le mode `?test` expose des accès de diagnostic destinés exclusivement aux tests ; ils ne sont pas présents en jeu normal.

## Commandes

| Action                                   | Commande                                                  |
| ---------------------------------------- | --------------------------------------------------------- |
| Déplacement                              | ZQSD, WASD ou flèches                                     |
| Visée / attaque                          | Souris / clic gauche ; maintenir pour enchaîner           |
| Épée / arc                               | 1 / 2                                                     |
| Esquive                                  | Espace ; recharge de 1,5 seconde                          |
| Prendre / quitter une baliste            | E à proximité                                             |
| Recharger la baliste                     | R ; coûte 2 bois                                          |
| Transporter la baliste utilisée          | F ; E pour la déposer                                     |
| Réparer un mur, une porte ou une baliste | Maintenir R à pied et à proximité                         |
| Remplir le carquois                      | E près d’une réserve de flèches                           |
| Ordres individuels aux compagnons        | Tab, puis ordre et front pour chacun                      |
| Améliorations                            | B ; disponibles entre les vagues                          |
| Aide / pause                             | H / Échap                                                 |
| Zoom                                     | Molette                                                   |
| Sons                                     | Bouton musical en haut à droite ; désactivés initialement |

## Boucle de jeu réellement implémentée

- Château de 1340 × 1220 unités dans une carte de 2400 × 2200 unités, cour, quatre chemins de ronde, quatre escaliers et huit balistes. Les petits murs intérieurs imposent le passage par les escaliers. Les balistes transportées ne peuvent emprunter que les escaliers larges est et ouest.
- Déplacements normalisés, collision segmentée sans traversée des murs à grande vitesse, obstacles de décor, caméra lissée et mini-carte des trois défenseurs, des ennemis, des brèches et du champ de vision.
- Épée en éventail, arc à munitions, esquive avec invulnérabilité courte et délai de recharge. Les projectiles infligent de vrais dégâts avec détection continue du segment parcouru.
- Balistes avec orientation dans huit directions illustrées, carreaux perforants, recul, rechargement manuel ou autonome, points de vie, transport et dépôt. Les projectiles suivent une hauteur visuelle : un tir depuis les remparts franchit le mur, une flèche trop basse depuis la cour est arrêtée.
- Gobelins archers, squelettes archers, lanceurs incendiaires, diablotins rapides et brutes résistantes. Les unités de tir approchent puis s’arrêtent pour lancer des projectiles ; les unités de mêlée attaquent la porte et peuvent entrer après une brèche.
- Compagnons avec cheminement A*, répartition des fronts, réservation des armes, tir, rechargement, gestion des flèches, mêlée et réparation. Les ordres suivre / défendre un front / réparer / servir une baliste sont individuels. En autonomie, un seul compagnon privilégie l’entretien pendant une petite attaque, l’autre conserve la pression de tir.
- Bois ramassable sur les ennemis et prime de vague ; réparation progressive, reconstruction de sections détruites et cinq améliorations à trois niveaux.
- Vagues infinies, pauses de 24 secondes, attaques successivement au nord, est/ouest, puis sur plusieurs fronts. Aucun boss. Les défenseurs à terre se relèvent après 12 secondes. Défaite si les trois sont simultanément à terre ou si l’intégrité totale descend sous 12 %.

## Architecture

| Module              | Responsabilité                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/types.ts`      | État sérialisable des entités, commandes et types                                                           |
| `src/map.ts`        | Carte, élévation, obstacles, collisions, navigation A*                                                      |
| `src/simulation.ts` | État de partie, combat, armes, dégâts, réparation, améliorations, vagues                                    |
| `src/strategy.ts`   | Décisions et déplacements des compagnons et ennemis                                                         |
| `src/renderer.ts`   | Projection trois-quarts, tri en profondeur, sprites, terrain mis en cache, éclairages, effets et mini-carte |
| `src/ui.ts`         | HUD, atelier, ordres, aide et écrans de partie                                                              |
| `src/main.ts`       | Entrées, boucle à pas fixe de 60 Hz, sons et orchestration                                                  |

La simulation ne dépend ni du DOM ni du rendu, ce qui permet les tests sans navigateur et une évolution vers un serveur autoritaire. **Le multijoueur n’est pas implémenté** : protocole de commandes par joueur, synchronisation, reconnexion et gestion du hasard restent à construire. Le moteur ne prétend pas fournir dès maintenant une simulation réseau déterministe.

## Graphismes et limites de cette version

Les atlas dans `public/assets/` ont été produits pour ce prototype avec un outil de génération d’images, dans la direction donnée par la référence fournie. Ils sont utilisés dans le jeu : il ne s’agit pas d’une illustration conceptuelle présentée comme une capture jouable. Le terrain, les murs, les escaliers, les réserves et les effets combinent ces images avec du dessin Canvas. Les polices Cinzel et DM Sans sont fournies par les paquets Fontsource (licences incluses dans ces paquets).

Le rendu est une projection 2D trois-quarts stylisée avec élévation des chemins de ronde ; ce n’est pas une reconstruction exacte du château de l’image. Les contours des murs, réserves et escaliers sont encore procéduraux, moins riches que les sprites illustrés.

Les animations sont procédurales (balancement de marche, orientation, esquive, recul, arc d’épée, dégâts, chute, particules et torches). **Il n’y a pas encore de planches dessinées image par image pour toutes les actions et orientations.** Les poses des personnages gardent les armes de leur illustration, même lorsque l’arme logique change. L’arc d’épée et les vrais projectiles indiquent l’action courante. L’atlas illustré des balistes représente une arme chargée ; le désarmement est indiqué par l’état assombri, le message et la barre de recharge plutôt que par une nouvelle pose dessinée.

Pour une finition proche de la référence, produire par un illustrateur ou un pipeline d’animation : huit orientations de chaque personnage, cycles de marche/course, attaques épée/arc, roulade, dégâts et mort ; variantes de balistes vides/chargées et treuil animé ; kit modulaire de murs, portes, escaliers, réparations et destructions ; sons de pas, armes, impacts et ambiance. Les petites tonalités synthétiques actuelles sont fonctionnelles, pas un habillage sonore final.

L’équilibrage de parties longues, l’accessibilité complète et les appareils tactiles restent hors de cette première validation. Les sprites changent de sens et bougent, mais une finition artistique complète reste nécessaire. La capacité des IA à survivre seules indéfiniment n’est pas garantie : le joueur doit défendre activement.

## Déploiement public

Le workflow `.github/workflows/deploy.yml` construit, teste et publie le jeu avec GitHub Pages à chaque push sur `main`, ainsi que sur déclenchement manuel. Dans les réglages GitHub du dépôt, **Pages → Build and deployment → Source** doit être **GitHub Actions**. Si le premier workflow a démarré avant cette activation, le relancer depuis l’onglet Actions.

L’adresse attendue après un déploiement réussi est `https://dougdouggy.github.io/LeChateauDuRenard/`. Sa présence dans cette documentation ne signifie pas que l’activation ou la publication distante a été vérifiée. L’état du workflow et une requête HTTP publique permettent de le confirmer.

Les chemins relatifs de Vite et des images permettent un hébergement à la racine ou dans un sous-répertoire. Aucun secret de déploiement n’est stocké dans les fichiers ; le workflow utilise le jeton éphémère GitHub Actions, avec permissions Pages limitées au job de déploiement.
