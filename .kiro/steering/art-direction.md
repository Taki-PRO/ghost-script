---
inclusion: always
---

# Art direction: ink and candlelight

## Direction
A séance at a writing desk, ink and paper by candlelight. Spooky but calm. Every screen follows the rules below. Spec: `.kiro/specs/ink-and-candlelight/` (decisions Q1 to Q13, approved by the human).

## Palette
Ink black and aged paper are the base. Seal red is the only accent. Candle amber is light, never a fill.

| Token | Value | Use |
|---|---|---|
| `background`, `surface` | `#0e0f13`, `#181a21` | ink black page and cards |
| `nightTop`, `nightMid`, `nightLow` | unchanged | sky |
| `paper`, `inkOnPaper`, `drawing` | unchanged | writing paper and ink on it |
| `ink` | `#ece6d6` | aged paper text on dark |
| `ghost` | `#bdb7a6` | neutral secondary text, pinyin |
| `muted` | unchanged | quiet text |
| `seal` | `#b3361f` | Primary_Action fill, Seal_Stamp |
| `paperLabel` | `#f3ead2` | label on `seal` |
| `sealLight` | `#ec7a64` | success marks on dark backgrounds |
| `success` | alias of `sealLight` | no green |
| `error` | `#e6dcc3` | paper neutral, always with a text cue and a shape cue; no red |
| `gridLine` | `#7a6a4f` at 0.25 opacity | practice grid and hanzi-writer outline |
| `hintInk` | `#2c3e5a` | hanzi-writer stroke hint on paper |
| `grass` | `#30505c` | Graveyard Grass tufts (decorative, `aria-hidden`; at least 1.3:1 against the stone and the hill) |
| `candle` | `#f0b866` | only inside `box-shadow`, `radial-gradient` and `linear-gradient` |

Rules:
- Seal red is for the Primary_Action, the Seal_Stamp and success marks. Nowhere else.
- No `bg-candle`, `border-candle` or `text-candle`, and no flat amber fill. The focus ring is aged paper with a soft candle glow.
- Colour is never the only signal. Success and errors keep their words and shapes.
- Text keeps 4.5:1 contrast on every dark background and on paper. Graphics keep 3:1, except graphics that are `aria-hidden` and convey no information: the hillside, the Grass, the mist, the Moon glow, the grain, the Wax_Texture and the Deckled_Edge. The Grass keeps its own visibility floor: its tufts keep a luminance ratio of at least 1.3:1 against the stone and the hill behind them. The cursor images and every graphic that carries meaning keep the 3:1 rule.
- Secondary buttons and cards are paper slips with an ink label. Buttons stay at least 44 px high.
- Slips (`.slip` and `.slip-primary`; not `.card-slip` or `.keycap`) lift 2 px and gain a candle glow on hover and keyboard focus, and sink 1 px when pressed. Slips have a Deckled_Edge, a torn-paper edge that stays within 2 px of the box. The Primary_Slip has a faint Wax_Texture in tones of `seal`, at most 0.12 lightening alpha. The transitions run 200 ms inside the reduced-motion block and need no motion exemption.

### Primary action per screen
At most one per screen at a time.

| Screen | Primary action |
|---|---|
| Intro | Begin the Séance |
| Start menu | Begin a Nightly Séance |
| Cangjie guide | its continue button |
| Séance, after an outcome | Next ghost / Finish the séance |
| Leave prompt | Stay (then "Next ghost" is a paper slip) |
| Summary | Begin another Séance |
| Level screen | none |
| Summon, writing, Graveyard, Sources & licences | none |

## The ghost
One original ink-wash ghost: a brushed silhouette with bleeding edges, one inline SVG path with a turbulence and displacement filter, drawn by `GhostFigure`. Flat copies of the same silhouette are also allowed: the favicon and the pointer cursors. Each copy is built from the exported `GHOST_PATH` and `GHOST_EYE_PATHS`, has no filter, no gradient and no text, and is a standalone SVG that does not reference the `GhostFigure` component or its filter. The ghost is an ink wash (tone that darkens toward the hem, a second darker wash, a wet lower edge) with the same shape at every size and in the favicon (unfiltered copy, no gradient). Two small eye marks as paths. No text inside it, nothing derived from a character, hidden from assistive technology.

## Moon, mist and seal placement (approved by the human, screenshot review)
- The Moon is a pale warm disc of 4 rem in the top right, with soft maria, a soft shade toward the lower right and a faint glow of at most 0.10 alpha that fades out over 7 rem. It never lies under text, so no text token has to meet 4.5:1 on the disc itself; the end-to-end check `moonIntruders` proves that no text lies on it on every screen that calls `expectMoonInside`. Text beside the glow keeps 4.5:1. Below 992 px every screen keeps a top room of 4.75 rem for it.
- Below 992 px a fixed Sky_Cap keeps the top room free of scrolling content on every screen.
- The Moon uses only existing tokens: `ink` for the disc and the glow, `nightMid` for the maria and `nightTop` for the shade. The `moon` token stays for the mist-coloured heading glow.
- The Mist has two bands in the lower third: 0.18 at 88% and 0.10 at 72%. Text keeps 4.5:1 on each band.
- The seal sits in the paper margin and covers no stroke.

## Intro fix (approved by the human)
- The Moon disc has a soft off-centre shade, darker toward the lower right. Text on it keeps 4.5:1.
- The night sky, the grain and the mist cover the full page height on screens that scroll. The mist repeats once per screen-high tile.
- The intro shows no raw citation. One small "Sources" link opens the Sources & licences screen. It is a paper slip, not a Primary_Action; the intro's Primary_Action stays "Begin the Séance".

## Motion
- Motion that follows a player action or game event runs 200 to 600 ms and shows cause and effect.
- Ambient exemption (approved by the human, Q2): the two mist bands, the idle ghost float, the idle candle glow, the wisp of a restless tablet and the intro's Grain_Fall. They have no cause and may be slow. They are named here and nowhere else.
- Rite-timing exemption (approved by the human, Q12): `SUMMON_HOLD_MS`, `SUMMON_FADE_MS` and `SUMMON_INK_SPEED` stay as they are. They apply to a first meeting; a returning ghost has no hold and no fade.
- Legend-ink exemption: the Ink_In of the intro's legend line draws the six Han characters one at a time, in at most 6 s in total, at most 900 ms per character and under 200 ms per stroke. It runs once when the intro opens, never blocks a control, and reduced motion shows the finished line.
- Outcome motions take 600 ms: clean dissolves upward like ink smoke, struggled lingers at the edge, gave-up slips away. The result text and the primary action do not wait for them.
- Every animation and transition sits inside the one `prefers-reduced-motion: no-preference` block. Reduced motion shows the static end state.

## Pointer
Cursors apply only to devices whose primary input matches `(hover: hover) and (pointer: fine)`; touch devices keep the default cursor. The Ghost_Cursor and the Link_Cursor are flat ghost silhouettes, each at most 32 by 32 px, a `data:` SVG with an `auto` fallback. The Link_Cursor differs from the Ghost_Cursor in shape (wider eyes) and not only in colour. The Brush_Cursor is a thin crosshair with an open centre, at most 24 by 24 px, a `data:` SVG with a `crosshair` fallback, used on the Writing_Paper of the Write step only.

## Cultural care
- No pumpkins, bats or cobwebs.
- No funeral imagery: no joss paper, offering money, talisman script or incense for the dead.
- No new decorative Chinese text. Every glyph comes from the dataset, from `CANGJIE_KEYS` or from the sourced legend line. No invented or pseudo-Chinese shapes, no seal-script imitation.
- The seal carries only the ghost's own revealed character, taken from its dataset record, and exists only after a clean outcome.
- The legend is a story and a design premise. Claims about Cangjie stay within `content-accuracy.md`.

## Sound
None.
