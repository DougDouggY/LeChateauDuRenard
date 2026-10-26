# Assets du prototype

Images produites pour ce projet avec l’outil de génération d’images de la session, en s’appuyant sur la direction artistique de la référence utilisateur.

- `archers-walk.png` : quatre colonnes × trois lignes, un cycle de quatre poses de marche pour chacun des trois archers bleu, vert et violet. Le cadrage de chaque ligne et le cycle sont définis dans `src/animation.ts`. Personnages sans épée ni bouclier, quiver et arc visibles.
- `worker-walk.png` : quatre poses de marche du même ouvrier Gaspard, en tablier, portant sa caisse de livraison. Une ligne de quatre cellules.
- `characters.png` : ancien atlas de personnages, toujours utilisé pour les cinq familles d’ennemis. Ses trois anciens défenseurs ne sont plus rendus.
- `props.png` : atlas de tours, baliste, forge et arbres. Seuls les éléments nécessaires à la scène actuelle sont utilisés ; la forge n’apparaît plus dans le château.
- `ballistas.png` : huit orientations (N, NE, E, SE, S, SO, O, NO) des balistes achetées ; aucune n’est présente au départ.
- `courtyard.png` : texture de la plateforme surélevée et de la pierre des remparts.

Les sprites sont cadrés à l’exécution par Canvas `drawImage`, sans modifier les images sources. Les originaux de génération restent dans `/workspace/generated_images` pour cette session. Les captures de jeu réel sont produites séparément dans `artifacts/` par les tests navigateur.
