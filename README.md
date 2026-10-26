# Le Château du Renard — La dernière veille

Jeu de défense de château sur navigateur de bureau, en TypeScript / Canvas 2D avec Vite. Version 0.2 : trois archers, une plateforme entièrement au niveau des remparts, et un ouvrier qui livre les équipements achetés entre les manches.

**Jouer : https://dougdouggy.github.io/LeChateauDuRenard/**

## Hébergement et gratuité

Cette configuration utilise GitHub Pages sur un dépôt public et des exécuteurs GitHub Actions standards. Ces services sont gratuits dans cette configuration, sans essai de 30 jours ni abonnement à activer. Le site reste accessible entre les déploiements : aucun workflow ne tourne en continu pour permettre de jouer. Un workflow ne démarre que lors d’un push sur `main` ou d’un lancement manuel.

L’encart d’essai de 30 jours proposé par GitHub concerne des offres payantes telles qu’Enterprise/Copilot, qui ne sont pas requises ici. Cette affirmation concerne les offres actuelles, dans les limites d’usage du service ; elle n’est pas une promesse que GitHub ne changera jamais ses conditions. Voir [les offres GitHub](https://github.com/pricing).

Le premier déploiement public de la version 0.1 a été vérifié : HTTPS 200 et fichiers identiques au bundle testé. Le workflow dans `.github/workflows/deploy.yml` teste et publie les versions suivantes automatiquement. Dans **Settings → Pages → Source**, conserver **GitHub Actions**.

## Démarrer en local

Node.js 22.12+ et npm ; validation avec Node 24. Aucun compte, clé d’API, base de données ou serveur de jeu distant n’est nécessaire. Les images et les polices sont locales.

```sh
npm ci
npm run dev -- --port 5173
```

Puis choisir **Prendre la garde** dans le jeu.

```sh
npm test                 # Tests de simulation : gameplay, marche, commandes et livraisons
npm run build            # Vérification TypeScript et bundle de production
npm run test:browser     # Parcours fonctionnel complet dans Chromium
npm run test:production  # Bundle réel testé sous /LeChateauDuRenard/
npm run preview          # Servir le bundle de production
```

Les tests navigateur utilisent Chromium à `/usr/bin/chromium` (ou `CHROMIUM_PATH`). Le parcours fonctionnel démarre son propre serveur sur le port 5174 et l’arrête ensuite. Les captures réelles et les résultats sont dans `artifacts/`, ignoré par Git. Le paramètre `?test` expose l’état de diagnostic destiné aux tests ; il est absent du mode de jeu normal.

## Commencer simplement, s’équiper ensuite

Au départ : **trois archers avec chacun 24 flèches, une seule réserve centrale, zéro baliste et zéro point**. Huit marques de placement indiquent les futurs emplacements de balistes. Il n’y a ni bâtiment, ni jardin, ni séparation de niveau dans l’espace de combat. La plateforme entière est à la hauteur des remparts : les flèches peuvent franchir les parapets depuis tout l’intérieur.

Les archers défendent contre les gobelins et squelettes tireurs, les lanceurs incendiaires, les diablotins rapides et les brutes. Les tireurs approchent puis s’arrêtent pour attaquer à distance. Les unités de mêlée attaquent les portes et entrent après une brèche. Les impacts, collisions, dégâts et morts sont réels.

Chaque élimination rapporte immédiatement **10 points**, ou **20 pour une brute**. Finir une manche ajoute **45 points**. Les points sont partagés par la garde ; les réparations et rechargements des balistes achetées peuvent également en consommer.

Après chaque manche, une pause de **60 secondes** permet de s’équiper. **Gaspard, l’ouvrier**, monte par l’escalier central et dit : « Dites-moi de quoi vous avez besoin, je vous prépare ça rapidement ! » Approcher et appuyer sur **E**, ou ouvrir son catalogue avec **B**.

- **Baliste mobile — 90 points** : choisir un emplacement marqué ; Gaspard revient à l’escalier, apporte la caisse, installe l’arme puis retourne au comptoir. Elle apparaît seulement après livraison.
- **Réserve de flèches — 40 points** : choisir l’un des quatre points de ravitaillement supplémentaires ; elle devient utilisable après la même livraison.
- **Améliorations** : puissance et recharge des balistes, flèches, murs et réparations. Leur effet est appliqué à la livraison, pas au clic d’achat.

Une seule commande est traitée à la fois. Les points sont débités une seule fois, à la validation d’un emplacement valable ou d’une amélioration. Annuler le choix d’un emplacement ne coûte rien. Une livraison active et le retour de l’ouvrier se terminent avant le prochain assaut, même si le compte à rebours expire. Gaspard repart par l’escalier au début de la manche suivante.

Les réserves remplissent gratuitement le carquois à 24 flèches. Les alliés vont se réapprovisionner seuls lorsqu’ils sont à sec. En début de partie, ils combattent à l’arc ; ils peuvent servir les balistes une fois achetées. Les fronts, les armes et les commandes sont réservés pour éviter que les deux compagnons se disputent le même poste.

## Commandes

| Action                                | Commande                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| Déplacement                           | ZQSD, WASD ou flèches                                         |
| Viser / tirer à l’arc                 | Souris / clic gauche, maintenir pour enchaîner                |
| Esquive                               | Espace                                                        |
| Reprendre 24 flèches                  | E près d’une réserve                                          |
| Parler à Gaspard                      | E près de lui entre les manches                               |
| Catalogue de l’ouvrier                | B                                                             |
| Choisir l’emplacement d’un achat      | Clic sur une marque éclairée                                  |
| Annuler le choix sans payer           | Échap ou clic droit                                           |
| Prendre / quitter une baliste achetée | E                                                             |
| Recharger une baliste                 | R ; 2 points                                                  |
| Transporter / déposer une baliste     | F quand on la sert / E                                        |
| Réparer                               | Maintenir R à pied près d’une structure ; consomme des points |
| Ordres individuels aux compagnons     | Tab                                                           |
| Aide / pause                          | H / Échap                                                     |
| Zoom                                  | Molette                                                       |

Les personnages à terre reviennent après 12 secondes. La partie est perdue si tous les défenseurs sont simultanément à terre ou si l’intégrité passe sous 12 %. Vagues infinies, aucun boss. La première manche attaque au nord, la deuxième à l’est et à l’ouest, puis les fronts se combinent.

## Architecture et assets

| Module              | Rôle                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| `src/simulation.ts` | État de partie, arcs, munitions, dégâts, points, vagues et placement         |
| `src/workshop.ts`   | Arrivée de l’ouvrier, commandes, trajet de livraison, installation et départ |
| `src/map.ts`        | Plateau surélevé continu, remparts, emplacements, collisions et A*           |
| `src/strategy.ts`   | Compagnons archers et comportements des ennemis                              |
| `src/combat.ts`     | Hauteur de projectile commune au rendu et aux collisions                     |
| `src/animation.ts`  | Cycle de marche commandé par la distance réellement parcourue                |
| `src/renderer.ts`   | Projection trois-quarts, sprites, terrain, torches, effets et mini-carte     |
| `src/ui.ts`         | HUD, catalogue de Gaspard, ordres, aide et écrans                            |
| `src/main.ts`       | Entrées, boucle fixe 60 Hz et sons synthétiques                              |

Les trois défenseurs possèdent de nouveaux sprites d’archers sans épée ni bouclier. Chaque archer dispose de **quatre poses de marche réellement distinctes** dans `public/assets/archers-walk.png`. Le cycle avance avec le déplacement réel et s’arrête lorsqu’on lâche les touches, rencontre un mur, sert une baliste ou tombe à terre. Gaspard dispose également de quatre images de marche avec sa caisse.

Les images ont été produites pour ce prototype avec l’outil de génération d’images, dans la direction de la référence fournie, et sont utilisées dans le jeu. Elles ne sont pas présentées comme une capture conceptuelle remplaçant un jeu jouable. Cinzel et DM Sans sont servies localement via Fontsource, avec leurs licences incluses.

Limites artistiques : les cycles illustrés montrent une vue trois-quarts commune, avec symétrie horizontale ; ce ne sont pas huit animations directionnelles complètes. Attaques, esquives, dégâts et morts gardent des effets procéduraux. Les balistes ont huit orientations, mais pas encore un atlas séparé pour chaque état de charge. Le terrain, les murs et les réserves combinent textures et dessin Canvas. La fidélité exacte à la référence, le son final et l’équilibrage de longues parties restent à améliorer.

Le multijoueur n’est pas implémenté. Les modules de simulation indépendants du DOM permettent son évolution, mais protocole réseau, serveur autoritaire, reconnexion et synchronisation restent à construire.
