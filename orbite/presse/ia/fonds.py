"""ORBITE — fonds du kit tirés des images générées par IA (Higgsfield, Nano Banana 2.1).

Les images sources (ia/sources/) sont déjà en pixel art, mais leur grille n'est pas parfaitement
régulière. Pour chaque format, on recadre (ou on complète de noir spatial), puis :
- « grille » : réduction (moyenne) sur une grille de k pixels puis agrandissement entier au plus proche
  voisin : pixels nets et tous de la même taille, comme le moteur du jeu ;
- « doux » : simple réduction de qualité (Lanczos) quand aucune grille entière ne colle à l'image.
Aucune réduction de couleurs (elle faussait les teintes, ex. le cristal rose devenait beige).
Lancer : python3 presse/ia/fonds.py  (depuis orbite/) -> presse/ia/fonds/<format>.png
"""
import os
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ICI, 'sources')
OUT = os.path.join(ICI, 'fonds')

def charger(nom):
    return Image.open(os.path.join(SRC, nom + '.png')).convert('RGB')

def recadrer(im, w, h, cx=0.5, cy=0.5):
    """Plus grand recadrage au rapport w/h centré sur (cx, cy)."""
    W, H = im.size
    r = w / h
    cw, ch = (W, W / r) if W / H < r else (H * r, H)
    x0 = min(max(cx * W - cw / 2, 0), W - cw)
    y0 = min(max(cy * H - ch / 2, 0), H - ch)
    return im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch)))

def completer(im, w, h):
    """Toute l'image, mise à la largeur, complétée de noir en haut et en bas (rien n'est coupé)."""
    W, H = im.size
    ih = round(H * w / W)
    out = Image.new('RGB', (w, h), (0, 0, 0))
    out.paste(im.resize((w, ih), Image.BOX), (0, (h - ih) // 2))
    return out

def grille(im, w, h, k, mode='recadrer', cx=0.5, cy=0.5):
    lw, lh = w // k, h // k
    assert lw * k == w and lh * k == h, f'{w}x{h} n’est pas un multiple de {k}'
    bas = completer(im, lw, lh) if mode == 'completer' else recadrer(im, lw, lh, cx, cy).resize((lw, lh), Image.BOX)
    return bas.resize((w, h), Image.NEAREST)

def descendre(im, part):
    """Décale l'image vers le bas (part de sa hauteur) : du noir spatial en haut pour le titre, le bas
    coupé (la planète d'horizon reste une courbe en bas d'écran)."""
    W, H = im.size
    out = Image.new('RGB', (W, H), (0, 0, 0))
    out.paste(im, (0, round(H * part)))
    return out

def doux(im, w, h, cx=0.5, cy=0.5):
    return recadrer(im, w, h, cx, cy).resize((w, h), Image.LANCZOS)

FONDS = {
    # nom du fond : (source, fonction)
    'x-entete-1500x500': ('ia-deux-camps-4x1', lambda im: grille(im, 1500, 500, 4, 'completer')),
    'itch-banniere-960x300': ('ia-deux-camps-4x1', lambda im: grille(im, 960, 300, 2, 'completer')),
    'story-1080x1920': ('ia-piliers-vertical', lambda im: grille(descendre(im, 0.16), 1080, 1920, 4)),
    'fond-ecran-telephone-1170x2532': ('ia-piliers-vertical', lambda im: grille(im, 1170, 2532, 6)),
    'instagram-carre-1080x1080': ('ia-trou-noir-carre', lambda im: grille(im, 1080, 1080, 3)),
    'youtube-miniature-1280x720': ('ia-bataille-16x9', lambda im: doux(im, 1280, 720)),
    'x-publication-1600x900': ('ia-bataille-16x9', lambda im: doux(im, 1600, 900)),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for nom, (src, f) in FONDS.items():
        img = f(charger(src))
        img.save(os.path.join(OUT, nom + '.png'), optimize=True)
        print(nom, img.size)
