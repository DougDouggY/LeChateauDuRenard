# Le Château du Renard — La dernière veille

Prototype jouable de défense de château, TypeScript / Canvas 2D / Vite.

**Jouer : https://dougdouggy.github.io/LeChateauDuRenard/**

## Version 0.5 — tir chargé et visée directe

**Maintenir le clic gauche pour tendre l’arc, relâcher pour tirer.** La charge atteint son maximum après 0,95 s ; elle augmente la portée de 250 à 1 300 unités et les dégâts de 18 à 56 avant améliorations. Une jauge autour du viseur indique la tension, les poses de l’archer suivent la charge. Le maintien ne déclenche aucun tir automatique et ne réserve qu’une flèche. Pause et perte de focus annulent la charge et rendent cette flèche.

La flèche suit une trajectoire projetée passant par la souris au relâchement : pas d’accrochage automatique ni de suivi d’un ennemi qui se déplace. Les collisions des tirs manuels suivent le corps visible des ennemis. Les compagnons gardent leurs tirs automatiques ; les pouvoirs restent au clic droit, avec leurs coûts et délais propres. Les balistes gardent le tir immédiat.

**Shift** déclenche un dash bref dans la direction du déplacement, ou vers la visée à l’arrêt ; recharge de 1,5 s. Espace reste disponible comme raccourci alternatif. Les collisions avec les remparts s’appliquent pendant le dash.

La carte et les panneaux de santé à droite sont retirés. Les fronts attaqués restent éclairés sur la plateforme, avec des repères de direction et la vie directement sur les sections de rempart. Les monstres gardent leurs barres de vie et leurs dégâts affichés. **M**, ou le bouton « Vue d’ensemble » en bas, montre tout le château ; une seconde activation reprend le suivi de l’archer. Les vagues progressent du nord à est/ouest, puis nord/sud et les quatre fronts.

Le terrain et les remparts sont composités en cache, les sprites et leurs traitements de couleur sont précalculés, et les éléments hors champ sont écartés du dessin. La résolution de rendu s’adapte aux ralentissements. Les déplacements sur la plateforme ouverte évitent les recherches de chemin inutiles ; les trajets impossibles sont réessayés périodiquement.

Mesure locale Chromium sans accélération matérielle, 64 ennemis et densité de pixels fixée à 2 : temps moyen de dessin JavaScript passé de 196,55 à 1,79 ms ; intervalle moyen entre images passé de 611 à 40 ms. Ce scénario de charge compare la même machine et ne garantit pas une fréquence identique sur tous les appareils.

## Huit capuches, huit pouvoirs

Avant chaque partie, choisir le personnage J1 puis les deux compagnons IA parmi **huit archers à capuche**. Cliquer sur le membre de la garde à personnaliser, puis sur son archer. Les trois membres sont distincts : sélectionner un archer déjà attribué échange les deux places. Tous sont disponibles sans achat.

| Archer | Capuche   | Pouvoir au clic droit                                            | Recharge | Coût      |
| ------ | --------- | ---------------------------------------------------------------- | -------- | --------- |
| Aëlan  | Ambre     | Flèche explosive : explosion de zone à l’impact                  | 10 s     | 1 flèche  |
| Brune  | Verte     | Tir multiple : cinq flèches en éventail                          | 8 s      | 3 flèches |
| Nivéa  | Bleue     | Givre : ralentissement de zone pendant 4 s                       | 9 s      | 1 flèche  |
| Kaël   | Rouge     | Feu : brûlure pendant 5 s                                        | 9 s      | 1 flèche  |
| Osric  | Violette  | Trait perforant traversant jusqu’à six ennemis                   | 8 s      | 1 flèche  |
| Sélène | Ivoire    | Flèche lunaire : soigne le tireur et les alliés proches de 18 PV | 10 s     | 1 flèche  |
| Ronce  | Noire     | Poison : dégâts persistants pendant 6 s                          | 9 s      | 1 flèche  |
| Ilyas  | Turquoise | Foudre : jusqu’à quatre ennemis touchés et brièvement étourdis   | 11 s     | 1 flèche  |

Les compagnons utilisent leur propre pouvoir pendant les assauts. Le HUD affiche le nom, le coût en flèches, la disponibilité et le délai restant. Les pouvoirs ne fonctionnent pas en servant ou en transportant une baliste. Un clic droit pendant le choix d’un emplacement annule ce choix sans déclencher le pouvoir.

Les projectiles et leurs effets sont réels : dégâts de zone, perforation, ralentissement, brûlure, poison, soin et rebonds de foudre sont exécutés par la simulation. Les brûlures et poisons expirent, et une élimination ne paie qu’une fois, même en cas d’effets cumulés.

## Pièces d’or et équipement

La garde gagne des **pièces d’or**, pas un score : 10 par ennemi vaincu, 20 pour une brute, puis 45 pour une manche terminée. Un gain apparaît près de l’ennemi et rejoint immédiatement la bourse commune. Le solde reste entier, y compris lors des réparations progressives. Les dépenses et récompenses sont limitées à la partie en cours ; aucun achat en argent réel.

Départ : **trois archers avec chacun 24 flèches, une réserve centrale, zéro baliste et zéro pièce**. La plateforme est entièrement au niveau des remparts, sans bâtiments ni obstacles intérieurs ; les tirs peuvent franchir les parapets depuis tout l’intérieur. Huit emplacements sont disponibles pour les futures balistes.

Après chaque manche, **Gaspard** monte par l’accès central pendant la pause de 60 secondes et propose ses services. E près de lui, ou B, ouvre son catalogue.

- **Baliste mobile : 90 pièces**. Choisir un emplacement marqué ; Gaspard rapporte la caisse, installe l’arme et revient.
- **Réserve de flèches : 40 pièces**. Choisir un emplacement de ravitaillement ; le nouvel accès aux flèches est utilisable après livraison.
- **Améliorations** : flèches, murs, réparations, puissance et rechargement des balistes. L’effet est appliqué à la livraison.

Une seule commande à la fois, paiement une seule fois à la confirmation ; annuler un placement ne coûte rien. Une livraison en cours et le retour de l’ouvrier se terminent avant le prochain assaut. Les réserves remplissent gratuitement les carquois à 24 flèches ; les IA vont se ravitailler seules. Le ravitaillement fait briller la réserve et anime des flèches vers le personnage.

## Alertes et présentation

Une annonce au **centre de l’écran** signale les fronts de chaque manche : « Des monstres arrivent du nord ! », « … de l’est et de l’ouest ! », ou « … de tous les côtés ! ». Elle est temporaire, non bloquante et suspendue pendant la pause. Les zones éclairées et la vue d’ensemble permettent de retrouver les fronts attaqués.

Les huit archers disposent chacun de quatre poses de marche et de quatre poses de tir : repos, début de tension, pleine tension, lâcher. Le joueur tend l’arc pendant le maintien et tire au relâchement ; les compagnons et pouvoirs gardent une encoche de 0,24 s. Les huit projectiles illustrés ont été régénérés, avec traînées et effets distincts.

La réserve est un coffre illustré à carquois sur un socle de pierre. L’accès central possède un encadrement en pierre, un volet animé, une lumière chaude sous les marches et une apparition/disparition de Gaspard découpée au niveau du sol. Ombres et pavage relient ces éléments au décor.

## Commandes

| Action                             | Commande                                            |
| ---------------------------------- | --------------------------------------------------- |
| Se déplacer                        | ZQSD, WASD ou flèches                               |
| Viser / tir normal                 | Souris / maintenir clic gauche, relâcher pour tirer |
| Pouvoir de l’archer                | Clic droit                                          |
| Dash                               | Shift (ou Espace)                                   |
| Reprendre 24 flèches               | E près d’une réserve                                |
| Parler à Gaspard                   | E près de lui entre les manches                     |
| Catalogue                          | B                                                   |
| Confirmer l’emplacement d’un achat | Clic gauche sur une marque éclairée                 |
| Annuler un placement sans payer    | Échap ou clic droit                                 |
| Prendre / quitter une baliste      | E                                                   |
| Recharger une baliste              | R ; 2 pièces                                        |
| Transporter / déposer une baliste  | F quand on la sert / E                              |
| Réparer                            | Maintenir R à pied ; consomme de l’or               |
| Ordres individuels aux compagnons  | Tab                                                 |
| Aide / pause                       | H / Échap                                           |
| Zoom                               | Molette                                             |
| Vue d’ensemble / retour au suivi   | M ou bouton en bas à droite                         |

Les défenseurs à terre reviennent après 12 s. Défaite s’ils sont tous simultanément à terre ou si l’intégrité tombe sous 12 %. Vagues infinies, aucun boss. Gobelins et squelettes archers, incendiaires, diablotins rapides et brutes attaquent progressivement différents fronts. Les tireurs s’arrêtent pour lancer des projectiles esquivables ; les unités de mêlée peuvent entrer après une brèche.

## Développement et validation

Node.js 22.12+ et npm ; validation avec Node 24. Aucune clé, base de données ou API distante n’est nécessaire au jeu. Les images et les polices sont locales.

```sh
npm ci
npm run dev -- --port 5173
npm test                 # 43 tests : simulation, pouvoirs, fronts, charge, visée et dash
npm run build            # TypeScript et bundle de production
npm run test:browser     # Sélection, contrôles, pouvoir, alertes, une manche réelle et livraisons
npm run test:production  # Bundle servi sous /LeChateauDuRenard/
npm run preview
```

Les tests navigateur utilisent `/usr/bin/chromium` ou `CHROMIUM_PATH`. Le parcours principal démarre son propre serveur sur 5174 et l’arrête après les tests. Captures réelles et résultats dans `artifacts/`, ignoré par Git. Le paramètre `?test` expose l’état de diagnostic ; le mode normal ne l’expose pas.

| Module                | Rôle                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `src/heroes.ts`       | Huit profils, palettes, pouvoirs, coûts et délais                   |
| `src/powers.ts`       | Impacts, zones, soins, foudre et effets visuels de simulation       |
| `src/simulation.ts`   | État, encoche/lâcher, projectiles, or, dégâts, manches et placement |
| `src/workshop.ts`     | Arrivée de Gaspard, commandes, livraison et installation            |
| `src/map.ts`          | Plateforme, remparts, emplacements, collisions et navigation A*     |
| `src/strategy.ts`     | Compagnons et ennemis, pouvoirs IA et statuts de contrôle           |
| `src/animation.ts`    | Poses de marche/tir et cadrage des atlas                            |
| `src/combat.ts`       | Hauteur des projectiles partagée entre rendu et collisions          |
| `src/fronts.ts`       | Menaces, intégrité par front et priorité de défense                 |
| `src/render-cache.ts` | Cache des sprites précadrés et traitements de couleur               |
| `src/renderer.ts`     | Sprites, terrain, lumière, effets, portraits et vue d’ensemble      |
| `src/ui.ts`           | Sélection de la garde, HUD, annonce centrale, catalogue et ordres   |
| `src/main.ts`         | Entrées, boucle fixe à 60 Hz et sons                                |

## Hébergement gratuit

GitHub Pages sur ce dépôt **public**, avec les exécuteurs GitHub Actions standards, est gratuit dans la configuration actuelle, sans essai de 30 jours ni abonnement Enterprise/Copilot à activer. Aucun achat payant n’a été ajouté pour les archers ou leurs pouvoirs. Les conditions futures du fournisseur ne peuvent pas être garanties ; voir [les offres actuelles](https://github.com/pricing).

Le jeu reste accessible quand le chat ou l’environnement cloud est fermé. Actions ne tourne pas en permanence : `.github/workflows/deploy.yml` construit, teste et publie uniquement lors d’un push sur `main` ou d’un lancement manuel. Dans **Settings → Pages → Source**, conserver **GitHub Actions**. Les chemins relatifs de Vite permettent le sous-répertoire du site.

## Assets et limites

Les atlas sont produits pour ce prototype par génération d’images, dans la direction artistique de la référence fournie, et intégrés à la scène réellement jouable. Ils ne remplacent pas le jeu par une image conceptuelle. Les polices Cinzel et DM Sans sont servies via Fontsource avec leurs licences.

Les cycles ont quatre poses et une vue trois-quarts commune, avec symétrie horizontale ; pas encore huit animations directionnelles complètes. Les attaques possèdent désormais leurs poses illustrées d’arc, tandis que l’esquive, les dégâts, les morts et les effets de pouvoir restent partiellement procéduraux. La simulation commande les dégâts et le moment réel du lâcher. La fidélité exacte à la référence, le son final, les commandes tactiles et l’équilibrage de longues parties restent à améliorer.

Le multijoueur n’est pas implémenté. Les modules de simulation sont indépendants du rendu, mais un serveur autoritaire, le protocole, la synchronisation et la reconnexion restent à construire.
