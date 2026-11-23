# music_game_web

Web version of [music_game](https://github.com/pablonm3/music_game), a Windows console game from 2019, playable in a browser as *Programmer Save Humanity*, with a start menu, a shared top-10 leaderboard and touch controls for phones. It keeps the original's board, scoring, chase rule and music, and adds lives, more enemies, shooters and bombs. `PLAY` first shows the game's legend (2027, the world taken by AI, the mushrooms that bring humanity back), written letter by letter: Enter starts the game, Escape goes back to the menu. `HOW TO PLAY` opens on the same legend, with the rules one Enter away.

The pieces are photo-like images that glide from cell to cell over a moving picture of the Amazon rainforest, with monkeys, birds and flies in it: a bald guy in a white t-shirt (the player, whose feet move while he walks), three shrooms that are photos of three real mushrooms, and skeleton robots. Under the frame, one heart for each life left and one bomb for each held bomb (from 6 bombs on, one bomb and the number). The frame, the score and the text screens keep the terminal look.

A voice names a colour (red, blue or cyan) that is never shown on screen: take the shroom of that colour for +5, any other shroom costs 15. Shrooms and bombs are picked up from close by, up to 2 columns and 1 row from you (when two shrooms are in reach at once and one of them is the named one, the move counts as right). Robots chase you; one more arrives after one and after two minutes, then one every 20 seconds, and every other one from the third on shoots. You have 3 lives: a robot, a shot or your own bomb costs one, and you reappear elsewhere, safe for 3 seconds. The first bomb comes with the second robot, after one minute, then one every 20 seconds; pick it up within 12 seconds and throw it to blow up the robots and shots around where it lands. Until the first bomb of a game is thrown, a line under the frame tells how to throw it. The edges wrap around. Sound is required.

## Run it

Node 22 or later. There are no dependencies, so there is nothing to install.

```bash
npm start            # http://localhost:8130 — the game and the leaderboard API, one process; Ctrl-C stops it
npm test             # unit tests (node --test)
```

Environment variables:

| variable | default | |
|---|---|---|
| `PORT` | `8130` | |
| `HOST` | `127.0.0.1` | `HOST=0.0.0.0` lets a phone on the same network open the game |
| `LEADERBOARD_FILE` | `data/leaderboard.json` | the stored top 10; delete the file to empty the leaderboard |

URL switches:

- `?debug=1` test mode: the game clock stands still, a status line shows the game state, and the browser console has `mg.advance(ms)` to run the clock (and with it every timed effect: shots, bombs, the safe time; on the legend, its writing) and `mg.game` for the state of the current game. On the legend the status line shows `written=<n>/<total>`. The status line shows `lives=`, `bombs=` (held), `player=`, `safe=` (while the player flickers), `enemies=` (a shooter's cell ends in `s`), `shrooms=`, `lying=` (bombs on the board, `f` when flickering), `thrown=` (landing cells of bombs in the air) and `projectiles=`; `-` is an empty list.
- `?touch=1` the phone layout on any device: the board fills the screen, with a joystick and the `ESC`, `ENTER` and `BOMB` buttons laid over its bottom corners, see-through. It is on by itself on touch devices.

## Controls

Arrow keys, and `q` `e` `a` `d` for the diagonals; a held key repeats after 180 ms. Space throws a bomb 14 cells in the direction of your last move (`BOMB` on a phone), or to the last cell before the frame; its blast reaches 12 columns and 7 rows around the cell it lands on, so a throw to the side leaves you clear unless the frame stops the bomb short. Enter and Escape in the menus. On a phone, a joystick: push it for one step, hold it to keep walking, slide it to turn. A name for the leaderboard is one to five letters: type it, or use up and down to change the selected letter (past `Z` or `A` on the last letter removes it) and left and right to move.

## Layout

- `server/` — the HTTP server: static files with byte ranges (`static.js`), the leaderboard API (`app.js`) and its rules and JSON file (`leaderboard.js`). Node built-ins only.
- `public/` — the game: one page and plain JavaScript modules, no build step. The rules are in `js/game.js`, with no DOM, audio or timers.
- `public/img/` — the images of the game screen (see "Images and sounds").
- `public/audio/` — MP3 files (128 kbit/s): copies of the original WAV files, same folders and names, plus the new voice in `voice/` and four effects made for this repo, the sound of a robot's arrival among them.
- `test/` — unit tests.

The original audio was converted from the `music/` folder of the original repo with:

```bash
SRC=<path to music_game>/music
for f in background/b1 background/b2 background/b3 background/b4 background/b5 background/b6 \
         goal/g1 goal/g2 goal/g3 goal/g4 nextGoal/error record; do
  ffmpeg -nostdin -loglevel error -i "$SRC/$f.wav" -codec:a libmp3lame -b:a 128k "public/audio/$f.mp3"
done
```

## Images and sounds

Every image and sound that is not from the original game was made for this repo or carries a licence that allows publishing it here. Photos were edited (cut out, colour, size); CC BY asks for the credit, the licence and a note of the changes, given below. Files under `/img/` and `/audio/` are cached by browsers for a day, so a changed file needs a new name.

| file in `public/img/` | shows | source | licence | edits |
|---|---|---|---|---|
| `player-walk.png` | the player: a bald guy with glasses, a white t-shirt, khaki shorts and sandals, three poses side by side: standing, then a stride with each foot lifted | rendered for this repo: a 3D model made for this game, no photo of a person | made for this repo | three renders of one model (in a stride one knee lifted, the arms swung against the legs, the body leaning 5° over the standing leg), all cut with the box of the standing pose, 384 × 128 px with a see-through background |
| `robot.png` | a robot that does not shoot: a steel skeleton with red eyes, two poses side by side | rendered for this repo: this game's own 3D model | made for this repo | two renders of one model with different arm and leg angles, 256 × 128 px |
| `robot-shooter.png` | a robot that shoots: the same skeleton in rust, with a crest of spikes and a cannon arm, two poses | rendered for this repo | made for this repo | as `robot.png` |
| `mushroom-red.png` | the red shroom: a young fly agaric, *Amanita muscaria* | photo 161856644 of [iNaturalist observation 97332092](https://www.inaturalist.org/observations/97332092) by Sigrid Jakob, [photo page](https://www.inaturalist.org/photos/161856644) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | cropped, background removed, the lowest 4.5% cut off, 16% darker, a little more colour and contrast, sharpened at 128 px, a soft dark edge |
| `mushroom-blue.png` | the blue shroom: a sky-blue mushroom, *Entoloma hochstetteri* | photo 14551993 of [iNaturalist observation 10469319](https://www.inaturalist.org/observations/10469319) by Mike Bowie, [photo page](https://www.inaturalist.org/photos/14551993) | CC BY, "(c) Mike Bowie, some rights reserved (CC BY)"; iNaturalist's CC BY is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | cropped (the stem's cut end fades out), background removed, 12% lighter, sharpened at 128 px, a soft dark edge |
| `mushroom-cyan.png` | the cyan shroom: a verdigris agaric, *Stropharia aeruginosa* | ["Stropharia aeruginosa in nature park Jesenicko in 2014"](https://commons.wikimedia.org/wiki/File:Stropharia_aeruginosa_in_nature_park_Jesenicko_in_2014.JPG) by Chmee2, Wikimedia Commons | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | cropped, background removed, hue moved 12° toward green (cap from 193° to 181°), 30% more colour, 5% darker, a little more contrast, sharpened at 128 px, a soft dark edge |
| `bomb.png` | a steel ball mine with horns and a glowing ember; also the icon of a held bomb under the frame | rendered for this repo | made for this repo | rendered at 128 px |
| `life.png` | a glossy red heart, the icon of a life under the frame | rendered for this repo: a rounded heart shape under the bomb's lights | made for this repo | rendered at 128 px with a see-through background |
| `projectile.png` | a glowing shot, white, yellow and orange | drawn for this repo (a script) | made for this repo | none |
| `explosion.png` | a fireball | ["Explosion"](https://www.flickr.com/photos/29105521@N02/7999746744) by Freidwall, Flickr | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | cropped, the brightness of the flame turned into its opacity so only the fire shows, 512 × 512 px |
| `background.jpg` | the Amazon rainforest: a river bend with an island, mist and cloud | ["Ecuadorian Amazon, Tena"](https://commons.wikimedia.org/wiki/File:Ecuadorian_Amazon,_Tena.jpg) by Dallas Krentzel ([Flickr](https://www.flickr.com/photos/31867959@N04/7429245768/)) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | cut to 1960 × 1000 px; graded (the forest a deep green, the cloud a dark grey, the river a dark olive); a warm light, light shafts and a soft bloom drawn in; darker corners; eight dark, blurred palm fronds drawn into three corners |
| `monkey.png` | a monkey in mid-leap | ["Squirrel Monkey Crossing"](https://www.flickr.com/photos/63154739@N00/2686866092) by Anthony Patterson, Flickr | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | cut out, darkened nearly to black |
| `bird.png` | a macaw from below with spread wings | ["Scarlet Macaw flying overhead"](https://www.flickr.com/photos/34073237@N04/3631529485) by Christian Haugen, Flickr | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | cut out, colour taken down to 45% and darkened |
| `flies.png` | seven dark specks with a pale wing each | drawn for this repo (a script) | made for this repo | none |

Licences read at their source on 2026-11-22; for the two iNaturalist photos in iNaturalist's own record of the photo (`api.inaturalist.org`), as its pages refuse scripts. The tools that made the images (rembg for the cut-outs, three.js for the renders, Pillow for the edits) are not part of the repo.

| file in `public/audio/` | what | how it was made | licence |
|---|---|---|---|
| `voice/red.mp3`, `voice/blue.mp3`, `voice/cyan-v2.mp3` | a bright female voice saying the colour, with a light echo | the [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) speech model (weights Apache-2.0) through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT), voice `af_heart`, speed 1.1, the words `Red!` and `Blue!`; then the `ffmpeg` command below. Cyan is given as the sounds `sˈaɪjæn!` ("SIGH-yan") at speed 1.0, as the model's own reading of `Cyan!` stresses the second syllable and was hard to understand over the music; its command adds a high shelf before the echo, so the "s" is heard, and cuts at 0.95 s | made for this repo |
| `life-lost.mp3` | a short falling synth sweep | `ffmpeg`, below | made for this repo |
| `explosion.mp3` | a deep boom with a noise tail | `ffmpeg`, below | made for this repo |
| `bomb.mp3` | a DJ riser when a bomb appears: a band of noise that climbs from 500 Hz to 8.9 kHz and grows louder, cut short, with two echoes | `ffmpeg`, below | made for this repo |
| `enemy-v2.mp3` | a bass dive when a robot arrives: two detuned sawtooth waves falling two octaves (260 to 65 Hz), bright at the hit and dark in the tail | `ffmpeg`, below | made for this repo |

```bash
# the voice, from the model's WAV output; <gain> sets the mean level to about -13 dB
ffmpeg -i red.wav -af "silenceremove=start_periods=1:start_threshold=-40dB,highpass=f=150,aecho=0.8:0.5:110:0.25,atrim=0:0.90,afade=t=out:st=0.75:d=0.15,volume=<gain>dB,alimiter=limit=0.85:attack=2:release=30:level=0" \
  -ar 44100 -ac 1 -codec:a libmp3lame -b:a 128k public/audio/voice/red.mp3      # gain 23.3; blue 20.5
ffmpeg -i cyan.wav -af "silenceremove=start_periods=1:start_threshold=-40dB,highpass=f=150,highshelf=f=3500:g=7,aecho=0.8:0.5:110:0.25,atrim=0:0.95,afade=t=out:st=0.80:d=0.15,volume=20.1dB,alimiter=limit=0.85:attack=2:release=30:level=0" \
  -ar 44100 -ac 1 -codec:a libmp3lame -b:a 128k public/audio/voice/cyan-v2.mp3

ffmpeg -f lavfi -i "aevalsrc='0.6*sin(2*PI*(880*t-520*t*t))+0.3*sin(2*PI*(1320*t-780*t*t))':d=0.6:s=44100" \
  -af "afade=t=in:d=0.01,afade=t=out:st=0.35:d=0.25,aecho=0.8:0.4:60:0.3,volume=8dB" \
  -ac 2 -codec:a libmp3lame -b:a 128k public/audio/life-lost.mp3

ffmpeg -f lavfi -i "anoisesrc=d=1.1:c=brown:r=44100:a=1" -f lavfi -i "aevalsrc='sin(2*PI*(90*t-25*t*t))*exp(-3.5*t)':d=1.1:s=44100" \
  -filter_complex "[0]lowpass=f=700,volume='exp(-4.5*t)':eval=frame[n];[1]volume=0.9[s];[n][s]amix=inputs=2:normalize=0,afade=t=in:d=0.005,afade=t=out:st=0.8:d=0.3,volume=2dB" \
  -ac 2 -ar 44100 -codec:a libmp3lame -b:a 128k public/audio/explosion.mp3

# the bomb's riser: low-passed white noise multiplied by a sine that sweeps from 500 Hz to 8.9 kHz,
# a crescendo, a cut and two echoes
ffmpeg -f lavfi -i "anoisesrc=d=1.2:c=white:r=44100:a=0.9:seed=7" \
  -f lavfi -i "aevalsrc='sin(2*PI*500*(exp(2.4*t)-1)/2.4)':d=1.2:s=44100" \
  -filter_complex "[0]lowpass=f=700[n];[n][1]amultiply,volume=30dB,alimiter=limit=0.85:attack=2:release=30:level=0,volume='0.25+0.75*pow(t/1.2,1.5)':eval=frame,afade=t=in:d=0.02,afade=t=out:st=1.17:d=0.03,apad=pad_dur=0.4,aecho=1:0.8:110|220:0.4|0.2,highpass=f=300,atrim=0:1.55,afade=t=out:st=1.4:d=0.15,volume=5dB,alimiter=limit=0.85:attack=2:release=30:level=0" \
  -ac 1 -ar 44100 -codec:a libmp3lame -b:a 128k public/audio/bomb.mp3

# the robot's dive: two detuned sawtooth waves at 65 + 195*exp(-t/0.12) Hz, a bright layer that
# dies fast over a dark one, a short echo
ffmpeg -f lavfi -i "aevalsrc='0.5*(2*mod(65*t+23.4*(1-exp(-t/0.12)),1)-1)+0.5*(2*mod(1.01*(65*t+23.4*(1-exp(-t/0.12))),1)-1)':d=0.7:s=44100" \
  -filter_complex "[0]asplit[a][b];[a]lowpass=f=2800,volume='exp(-7*t)':eval=frame[bright];[b]lowpass=f=420,volume='1.4*exp(-2.5*t)':eval=frame[dark];[bright][dark]amix=inputs=2:normalize=0,afade=t=in:d=0.004,aecho=0.8:0.35:70:0.3,atrim=0:0.75,afade=t=out:st=0.5:d=0.25,volume=8dB,alimiter=limit=0.85:attack=2:release=30:level=0" \
  -ac 1 -ar 44100 -codec:a libmp3lame -b:a 128k public/audio/enemy-v2.mp3
```

## Deployment

A push to `main` runs `.github/workflows/deploy.yml`: `npm test`, then one SSH login to the server with a key that may run only the server's copy of `deploy/autodeploy.sh`. That script checks out `origin/main` in `~/music_game_web`, restarts the pm2 app `music-game-web`, checks that it answers, and goes back to the previous commit when it does not (the workflow run then fails).

One-time setup, from a clone on your own computer: `deploy/setup_deploy.sh <user@host>`. It creates the deploy key, installs the script on the server and stores the three repository secrets. Run it again after changing `deploy/autodeploy.sh`.

The server keeps what is not in the repo in `~/music_game_web_data/`: the pm2 definition (`PORT`, `HOST`, `LEADERBOARD_FILE`), the leaderboard file and `autodeploy.log`. The game is served under a path of the site (nginx proxies `/music-game/` to the app), so the page must keep using relative URLs.

## API

| request | answer |
|---|---|
| `GET /api/leaderboard` | `{"entries":[{"name","score"}…]}`, at most 10, highest first, the earlier entry first on a tie |
| `GET /api/leaderboard?score=35` | the same plus `"qualifies"` |
| `POST /api/leaderboard` `{"name":"PABLO","score":35}` | 201 `{"entries","rank"}`; 400 `invalid_name`, `invalid_score` or `invalid_json`; 409 `not_qualifying`; 413 over 1 KB |

A name is one to five letters A–Z; a score is an integer multiple of 5. A score qualifies when it is above 0 and either fewer than 10 entries are stored or it is above the 10th.
