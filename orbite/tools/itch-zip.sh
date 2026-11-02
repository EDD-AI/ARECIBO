#!/usr/bin/env bash
# ORBITE — fabrique le paquet HTML5 pour itch.io.
#
# itch.io attend un ZIP avec index.html À LA RACINE (pas dans un sous-dossier). Le paquet ne
# contient que ce que le jeu charge pour tourner : les trois pages (index.html, et les outils
# atelier.html et batisseur.html, mis hors ligne par sw.js), le manifeste, le service worker,
# version.json, et les dossiers css/, js/ (avec js/lang/ et js/batiments/), fonts/, icons/ et
# audio/. Restent dehors : presse/, tests/, tools/, firebase/, les *.md et les fichiers cachés.
# Les deux textes de licence des polices (fonts/OFL.txt, fonts/PIXEL-FONTS.txt) sont gardés :
# la licence SIL OFL demande qu'ils accompagnent les polices distribuées.
#
# Usage : tools/itch-zip.sh [chemin du zip]
#   (par défaut : /tmp/claude-0/-home-user-ARECIBO/1d7da9a2-c3f8-504a-9072-7cedcb27a51d/scratchpad/itch/orbite-itch.zip)
# Se lance depuis n'importe où ; n'écrit rien dans le dépôt. Outils demandés : bash, find, sort,
# grep, sed, zip (présents sur Linux et macOS).

set -euo pipefail

# Dossier du jeu (orbite/), quel que soit l'endroit d'où l'on lance le script.
JEU="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SORTIE="${1:-/tmp/claude-0/-home-user-ARECIBO/1d7da9a2-c3f8-504a-9072-7cedcb27a51d/scratchpad/itch/orbite-itch.zip}"

command -v zip >/dev/null || { echo "Erreur : la commande zip est introuvable." >&2; exit 1; }

# Chemin absolu du zip (on se déplace ensuite dans le dossier du jeu).
mkdir -p "$(dirname "$SORTIE")"
SORTIE="$(cd "$(dirname "$SORTIE")" && pwd)/$(basename "$SORTIE")"

cd "$JEU"

# ─── 1. La liste des fichiers ─────────────────────────────────────────────
# Fichiers à la racine, puis dossiers parcourus en entier, sans fichiers cachés ni *.md.
RACINE=(index.html atelier.html batisseur.html manifest.webmanifest sw.js version.json)
DOSSIERS=(css js fonts icons audio)

LISTE="$(mktemp)"
trap 'rm -f "$LISTE"' EXIT
{
  printf '%s\n' "${RACINE[@]}"
  find "${DOSSIERS[@]}" -type f ! -name '.*' ! -path '*/.*' ! -name '*.md' | LC_ALL=C sort
} > "$LISTE"

ERREURS=0
manque() { echo "  MANQUE : $1 (demandé par $2)" >&2; ERREURS=$((ERREURS + 1)); }
dans_liste() { grep -qxF "$1" "$LISTE"; }

# ─── 2. Vérifications : tout ce que le jeu demande est dans le paquet ─────
echo "Vérifications…"

# 2a. Les fichiers de la racine existent.
for f in "${RACINE[@]}"; do [ -f "$f" ] || manque "$f" "la liste du script"; done

# 2b. La copie hors ligne de sw.js (tableau SHELL) : chaque fichier doit être présent,
#     sinon l'installation du service worker échoue (addAll refuse tout en bloc).
while IFS= read -r f; do
  [ -z "$f" ] && continue
  dans_liste "$f" || manque "$f" "sw.js (SHELL)"
done < <(sed -n '/const SHELL = \[/,/\];/p' sw.js | grep -oE "'\./[^']*'" | sed -E "s#^'\./##; s#'\$##")

# 2c. Les src="…" et href="…" relatifs des pages HTML.
for page in index.html atelier.html batisseur.html; do
  while IFS= read -r f; do
    f="${f%%[?#]*}"
    [ -z "$f" ] && continue
    dans_liste "$f" || manque "$f" "$page"
  done < <(grep -oE '(src|href)="[^"]+"' "$page" | sed -E 's/^(src|href)="//; s/"$//' | grep -vE '^(https?:|data:|mailto:|#|//)' || true)
done

# 2d. Les url(…) des feuilles de style (polices, curseurs), relatives au dossier css/.
for css in css/*.css; do
  while IFS= read -r f; do
    case "$f" in data:*|http*|'') continue ;; esac
    case "$f" in ../*) f="${f#../}" ;; *) f="css/$f" ;; esac
    dans_liste "$f" || manque "$f" "$css"
  done < <(grep -oE 'url\([^)]*\)' "$css" | sed -E "s/^url\(['\"]?//; s/['\"]?\)\$//" | grep -v '^data:' || true)
done

# 2e. Les icônes du manifeste.
while IFS= read -r f; do
  dans_liste "$f" || manque "$f" "manifest.webmanifest"
done < <(grep -oE '"src": *"[^"]+"' manifest.webmanifest | sed -E 's/^"src": *"//; s/"$//')

# 2f. Un seul numéro de version partout : sinon la page se recharge au lancement (game.js
#     compare sa VERSION à la balise orbite-version) et la mise à jour se croit en retard.
V_JSON="$(grep -oE '[0-9]+' version.json | head -n 1)"
V_SW="$(grep -oE "orbite-v[0-9]+" sw.js | head -n 1 | sed 's/orbite-v//')"
V_JS="$(grep -oE 'const VERSION = [0-9]+' js/game.js | head -n 1 | grep -oE '[0-9]+')"
V_HTML="$(grep -oE 'name="orbite-version" content="[0-9]+"' index.html | grep -oE '[0-9]+')"
if [ "$V_JSON" != "$V_SW" ] || [ "$V_JSON" != "$V_JS" ] || [ "$V_JSON" != "$V_HTML" ]; then
  echo "  VERSIONS DIFFÉRENTES : version.json=$V_JSON sw.js=$V_SW game.js=$V_JS index.html=$V_HTML" >&2
  ERREURS=$((ERREURS + 1))
fi

if [ "$ERREURS" -gt 0 ]; then
  echo "Paquet NON fabriqué : $ERREURS problème(s) ci-dessus." >&2
  exit 1
fi
echo "  OK : pages, sw.js, styles, manifeste et version $V_JSON cohérents."

# ─── 3. Le ZIP ────────────────────────────────────────────────────────────
# On part d'un zip vide (zip ajouterait sinon aux anciens fichiers). Les chemins sont relatifs au
# dossier du jeu : index.html se retrouve bien à la racine du ZIP. -X : sans attributs propres au
# système (propriétaire, droits étendus), -9 : compression maximale, -q : sans bavardage.
rm -f "$SORTIE"
zip -X -9 -q "$SORTIE" -@ < "$LISTE"

# ─── 4. Bilan ─────────────────────────────────────────────────────────────
NB="$(wc -l < "$LISTE" | tr -d ' ')"
OCTETS="$(wc -c < "$SORTIE" | tr -d ' ')"
BRUT=0
while IFS= read -r f; do BRUT=$((BRUT + $(wc -c < "$f"))); done < "$LISTE"

# index.html doit être à la racine du ZIP (vérifié dans le ZIP lui-même quand unzip est là).
if command -v unzip >/dev/null && ! unzip -Z1 "$SORTIE" | grep -qx 'index.html'; then
  echo "Erreur : index.html n'est pas à la racine du ZIP." >&2
  exit 1
fi

echo
echo "Paquet itch.io : $SORTIE"
echo "  fichiers       : $NB"
echo "  taille du ZIP  : $OCTETS octets ($(awk -v o="$OCTETS" 'BEGIN { printf "%.1f Mo", o / 1048576 }'))"
echo "  décompressé    : $BRUT octets ($(awk -v o="$BRUT" 'BEGIN { printf "%.1f Mo", o / 1048576 }'))"
for d in "${DOSSIERS[@]}"; do
  printf '  %-14s : %s fichiers\n' "$d/" "$(grep -c "^$d/" "$LISTE")"
done
# Limite d'itch.io pour un jeu HTML (1000 fichiers au plus dans le ZIP, d'après leur aide en ligne).
[ "$NB" -le 1000 ] || echo "ATTENTION : plus de 1000 fichiers, itch.io risque de refuser le ZIP." >&2
echo
echo "Sur itch.io : Kind of project = HTML, téléverser ce ZIP, cocher « This file will be played in the browser »."
