ARECIBO audio structure

This folder is the shared landing zone for music, ambience, and effects.

Folders
- `music/`
- `effects/`
- `ambience/`

Current expected main menu track
- `music/arecibo-menu-main.ogg`
- optional fallback: `music/arecibo-menu-main.mp3`

Recommended export
- music: `.ogg` + optional `.mp3` fallback
- ambience: `.ogg`
- effects: `.ogg` or `.wav`

Suggested naming
- `music/arecibo-menu-main.ogg`
- `music/arecibo-intro-boot.ogg`
- `ambience/sas-hum-loop.ogg`
- `ambience/quarters-roomtone-loop.ogg`
- `ambience/planet-hover-dust-loop.ogg`
- `effects/ui-hover.ogg`
- `effects/ui-confirm.ogg`
- `effects/ui-warning.ogg`
- `effects/airlock-shield.ogg`
- `effects/landing-thrusters.ogg`

Volume intent
- master default: `80`
- music default: `60`
- effects default: `60`

Notes for integration
- the menu is already prepared to autoplay the main theme after first user interaction
- mute state is stored in `localStorage` with key `areciboAudioMuted`
- slider values are stored with keys:
  - `areciboAudioVolume:master`
  - `areciboAudioVolume:music`
  - `areciboAudioVolume:effects`
