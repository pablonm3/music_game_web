# music_game_web

Web version of [music_game](https://github.com/pablonm3/music_game), a Windows console game from 2019. The same rules, the terminal look and the original audio, playable in a browser, with a start menu, a shared top-10 leaderboard and touch controls for phones.

A voice names a colour (red, blue or cyan) that is never shown on screen: take the heart of that colour for +5, any other heart costs 15. The `@` chases you; one more arrives after one and after two minutes. The edges wrap around. Sound is required.

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

- `?debug=1` test mode: the game clock stands still, a status line shows the game state, and the browser console has `mg.advance(ms)` to run the clock and `mg.game` for the state of the current game.
- `?touch=1` the phone layout (square cells, the direction pad, `ESC` and `ENTER` buttons) on any device. It is on by itself on touch devices.

## Controls

Arrow keys, and `q` `e` `a` `d` for the diagonals; a held key repeats after 180 ms. Enter and Escape in the menus. A name for the leaderboard is one to five letters: type it, or use up and down to change the selected letter (past `Z` or `A` on the last letter removes it) and left and right to move.

## Layout

- `server/` — the HTTP server: static files with byte ranges (`static.js`), the leaderboard API (`app.js`) and its rules and JSON file (`leaderboard.js`). Node built-ins only.
- `public/` — the game: one page and plain JavaScript modules, no build step. The rules are in `js/game.js`, with no DOM, audio or timers.
- `public/audio/` — MP3 copies (128 kbit/s) of the original WAV files, same folders and names.
- `test/` — unit tests.

The audio was converted from the `music/` folder of the original repo with:

```bash
SRC=<path to music_game>/music
for f in background/b1 background/b2 background/b3 background/b4 background/b5 background/b6 \
         goal/g1 goal/g2 goal/g3 goal/g4 nextGoal/Red nextGoal/Blue nextGoal/Cian nextGoal/error enemy record; do
  ffmpeg -nostdin -loglevel error -i "$SRC/$f.wav" -codec:a libmp3lame -b:a 128k "public/audio/$f.mp3"
done
```

## API

| request | answer |
|---|---|
| `GET /api/leaderboard` | `{"entries":[{"name","score"}…]}`, at most 10, highest first, the earlier entry first on a tie |
| `GET /api/leaderboard?score=35` | the same plus `"qualifies"` |
| `POST /api/leaderboard` `{"name":"PABLO","score":35}` | 201 `{"entries","rank"}`; 400 `invalid_name`, `invalid_score` or `invalid_json`; 409 `not_qualifying`; 413 over 1 KB |

A name is one to five letters A–Z; a score is an integer multiple of 5. A score qualifies when it is above 0 and either fewer than 10 entries are stored or it is above the 10th.
