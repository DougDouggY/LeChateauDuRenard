# Assets du prototype

Images originales produites pour ce projet avec l’outil de génération d’images de la session, en s’appuyant sur la direction artistique de la référence fournie par l’utilisateur.

- `characters.png` : atlas de 4 colonnes × 2 lignes, chevalier, rôdeuse, soldat, gobelin, squelette, incendiaire, diablotin, brute. Poses uniques, pas un cycle d’animation complet.
- `props.png` : atlas de 2 colonnes × 2 lignes, tour, baliste, forge, arbres.
- `ballistas.png` : atlas de 4 colonnes × 2 lignes, huit directions de la même baliste (N, NE, E, SE, S, SO, O, NO).
- `courtyard.png` : texture de sol pavé, utilisée en motif répété et pour texturer la pierre des remparts.

Le cadrage est fait à l’exécution par `drawImage`, sans modifier les images sources. Les copies originales de génération sont également conservées dans `/workspace/generated_images` pour cette session. Les captures de gameplay sont produites séparément par `npm run test:browser` dans `artifacts/`.
