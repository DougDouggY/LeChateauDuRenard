# Assets du prototype

Images originales produites pour cette session avec l’outil de génération d’images, dans la direction donnée par la référence utilisateur. Elles sont utilisées dans le jeu ; les captures réelles sont créées séparément dans `artifacts/`.

- `hood-walk-a.png` : 4 × 4 poses de marche, archers à capuche ambre, verte, bleue et rouge.
- `hood-walk-b.png` : 4 × 4 poses de marche, archers à capuche violette, ivoire, noire et turquoise.
- `hood-shot-a.png`, `hood-shot-b.png` : les mêmes huit archers, chacun avec repos, début de tension, pleine tension et lâcher. Le lâcher du sprite est lié à l’émission réelle du projectile.
- `arrows-v3.png` : huit flèches horizontales (normale, explosive, feu, glace, perforation, lune, poison, foudre).
- `floor-props-v3.png` : coffre de ravitaillement et accès central de l’ouvrier, sur socles de pierre, avec ombres et lumière ajoutées au rendu.
- `worker-walk.png` : quatre poses de Gaspard transportant sa caisse.
- `characters.png` : les cinq familles d’ennemis. Les anciens personnages alliés de cet atlas ne sont pas utilisés.
- `props.png` : tours et forêt ; la forge contenue dans cet atlas n’est pas affichée.
- `ballistas.png` : huit orientations des balistes achetées, absentes au départ.
- `courtyard.png` : texture du plateau et de la pierre des remparts.

Le cadrage est effectué à l’exécution par Canvas. Les lignes transparentes et les positions des poses sont définies dans `src/animation.ts`. Les portraits sont mis en cache à partir de ces mêmes sprites. Les sources de génération sont conservées dans `/workspace/generated_images` pour la session.
