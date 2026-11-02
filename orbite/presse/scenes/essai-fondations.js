/* Essai temporaire de l'agent fondations (sera supprimé). */
Kit.scene({ nom: 'trous', largeur: 2000, hauteur: 1000, langues: [], fond: '#000',
  async dessiner(ctx, s) {
    const V = [['neant', { pixel: 5 }], ['neant', { pixel: 4, complet: true }], ['umbra', { pixel: 5, complet: true }], ['umbra', { pixel: 5 }],
               ['evenement', { pixel: 5 }], ['oeilvide', { pixel: 5, legendaire: false }], ['neant', { pixel: 5, phase: 0.6 }], ['abysse', { pixel: 5 }]];
    V.forEach(([id, o], i) => {
      const a = Kit.astreCadre(id, Object.assign({ largeur: 480, hauteur: 460 }, o));
      ctx.drawImage(a, (i % 4) * 500 + Math.round((500 - a.width) / 2), Math.floor(i / 4) * 500 + Math.round((500 - a.height) / 2));
      Kit.ecrire(ctx, id + ' ' + JSON.stringify(o), (i % 4) * 500 + 250, Math.floor(i / 4) * 500 + 490, { taille: 13, align: 'centre', couleur: '#f6c453' });
    });
  } });
