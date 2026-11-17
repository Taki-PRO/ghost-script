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
| `candle` | `#f0b866` | only inside `box-shadow`, `radial-gradient` and `linear-gradient` |

Rules:
- Seal red is for the Primary_Action, the Seal_Stamp and success marks. Nowhere else.
- No `bg-candle`, `border-candle` or `text-candle`, and no flat amber fill. The focus ring is aged paper with a soft candle glow.
- Colour is never the only signal. Success and errors keep their words and shapes.
- Text keeps 4.5:1 contrast on every dark background and on paper. Graphics keep 3:1.
- Secondary buttons and cards are paper slips with an ink label. Buttons stay at least 44 px high.

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
One original ink-wash ghost: a brushed silhouette with bleeding edges, one inline SVG path with a turbulence and displacement filter, drawn only by `GhostFigure`. The ghost is an ink wash (tone that darkens toward the hem, a second darker wash, a wet lower edge) with the same shape at every size and in the favicon (unfiltered copy, no gradient). Two small eye marks as paths. No text inside it, nothing derived from a character, hidden from assistive technology.

## Moon, mist and seal placement (approved by the human, screenshot review)
- The Moon is a full disc of 4 rem in the top right. It never lies under text. Below 992 px every screen keeps a top room of 4.75 rem for it.
- The Mist has two bands in the lower third: 0.18 at 88% and 0.10 at 72%. Text keeps 4.5:1 on each band.
- The seal sits in the paper margin and covers no stroke.

## Intro fix (approved by the human)
- The Moon disc has a soft off-centre shade, darker toward the lower right. Text on it keeps 4.5:1.
- The night sky, the grain and the mist cover the full page height on screens that scroll. The mist repeats once per screen-high tile.
- The intro shows no raw citation. One small "Sources" link opens the Sources & licences screen. It is a paper slip, not a Primary_Action; the intro's Primary_Action stays "Begin the Séance".

## Motion
- Motion that follows a player action or game event runs 200 to 600 ms and shows cause and effect.
- Ambient exemption (approved by the human, Q2): the two mist bands, the idle ghost float, the idle candle glow and the wisp of a restless tablet. They have no cause and may be slow. They are named here and nowhere else.
- Rite-timing exemption (approved by the human, Q12): `SUMMON_HOLD_MS`, `SUMMON_FADE_MS` and `SUMMON_INK_SPEED` stay as they are.
- Outcome motions take 600 ms: clean dissolves upward like ink smoke, struggled lingers at the edge, gave-up slips away. The result text and the primary action do not wait for them.
- Every animation and transition sits inside the one `prefers-reduced-motion: no-preference` block. Reduced motion shows the static end state.

## Cultural care
- No pumpkins, bats or cobwebs.
- No funeral imagery: no joss paper, offering money, talisman script or incense for the dead.
- No new decorative Chinese text. Every glyph comes from the dataset, from `CANGJIE_KEYS` or from the sourced legend line. No invented or pseudo-Chinese shapes, no seal-script imitation.
- The seal carries only the ghost's own revealed character, taken from its dataset record, and exists only after a clean outcome.
- The legend is a story and a design premise. Claims about Cangjie stay within `content-accuracy.md`.

## Sound
None.
