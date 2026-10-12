# dwg2pdf

Standalone DWG/DXF → PDF converter producing vector output.

Parses drawings with [opencadcodec](https://github.com/HakanSeven12/opencadcodec)
(the same reader OpenCADStudio uses), tessellates entities to 2D primitives,
and writes a vector PDF with [printpdf](https://crates.io/crates/printpdf).
It is a **standalone crate** — it has its own `[workspace]` table and does not
link or import any code from the OpenCADStudio application.

## Build

```sh
cd dwg2pdf
cargo build --release
# binary: target/release/dwg2pdf  (dwg2pdf.exe on Windows)
```

All dependencies are pure Rust; it builds on Windows, Linux and macOS with no
system libraries.

## Usage

```
dwg2pdf <in.dwg|in.dxf> <out.pdf> [options]
```

| Option | Default | Description |
|---|---|---|
| `--paper` | `extents` | `extents` = page is sized to the drawing bounds (1 drawing unit = 1 mm), or a fixed sheet: `a0`–`a5`, `letter`, `legal` |
| `--landscape` | off | Swap a fixed sheet's width/height (ignored for `extents`) |
| `--margin` | `10` | Page margin in millimetres |
| `--layout` | model space | Layout display name (e.g. `"Layout1"`) or raw block-record name (e.g. `"*Paper_Space"`) |
| `--font` | auto | TrueType font to embed for text |
| `-v`, `--verbose` | off | Print primitive count and per-entity-type skip statistics to stderr |

### Examples

```sh
# Model space, page sized to the drawing, 10 mm margin
dwg2pdf plan.dwg plan.pdf

# Fit onto a landscape A3 sheet
dwg2pdf plan.dwg plan.pdf --paper a3 --landscape

# Render a paper-space layout by name
dwg2pdf plan.dwg plan.pdf --layout "A4 1-100"

# Embed a specific font for text
dwg2pdf plan.dwg plan.pdf --font C:\Windows\Fonts\arial.ttf
```

### Text and fonts

- If all text is Latin-1, the built-in Base-14 **Helvetica** is used — no font
  file is embedded and the PDF stays small.
- If any text character falls outside Latin-1 (Cyrillic, CJK, …), a **system
  TTF is embedded automatically**: `arial.ttf`/`segoeui.ttf`/`calibri.ttf`…
  under `%WINDIR%\Fonts` on Windows, DejaVu/Liberation/FreeSans on Linux,
  Arial/Helvetica on macOS. The font is subset to the used glyphs and written
  as CIDFontType2 with a ToUnicode map, so the text renders correctly **and**
  stays searchable/extractable.
- `--font file.ttf` overrides auto-selection. If the font can't be used (CFF
  outlines, unreadable), the tool warns and falls back to Helvetica.
- SHX stroke fonts have no system-font equivalent; their text is rendered with
  the embedded/Helvetica glyphs instead of SHX shapes.

Exit codes: `0` success, `1` read/render failure (including "nothing to
render"), `2` invalid arguments.

## How it works

```
dwg2pdf/
  Cargo.toml     own [workspace] → stays out of the app workspace
  src/main.rs    CLI, file loading (DwgReader / DxfReader)
  src/render.rs  CadDocument → flat Prim list (Stroke / Fill / Text)
  src/geom.rs    2D affine matrices + curve flattening
  src/pdf.rs     paper sizing, fit transform, printpdf ops, TTF embedding
  testdata/      smoke.dxf — one of every supported entity type
```

Pipeline:

1. **Load** — `.dxf` goes through `DxfReader`; everything else through
   `DwgReader::from_stream_with_options` (opencadcodec rev `8189f83`, same as
   the app).
2. **Collect** — model-space entities by default, or a named layout resolved
   through the document's LAYOUT objects to its block record. Entities on
   off/frozen/non-plottable layers and invisible entities are skipped
   (counted under `--verbose`).
3. **Tessellate** (`render.rs` + `geom.rs`):
   - LINE, LWPOLYLINE/POLYLINE (DXF bulge → arc sampling), CIRCLE, ARC,
     ELLIPSE → polylines
   - SPLINE → flattened by a small built-in de Boor evaluator (rational
     weights supported; degenerate knot vectors fall back to clamped-uniform)
   - SOLID, 3DFACE, polyface mesh faces → filled/outlined rings
   - HATCH → boundary edge loops (lines, arcs, elliptic arcs, splines,
     polyline edges) filled even-odd for solid hatches; pattern hatches are
     outlined only
   - INSERT → recursive block expansion with the full insert transform
     (translation × rotation × row/column grid × scale × −base-point);
     ByBlock colour/lineweight resolve through the insert's own style.
     DIMENSION and TABLE graphics come for free via their anonymous `*D`
     blocks; ATTRIBs attached to inserts are drawn as text
   - TEXT/MTEXT/ATTRIB → text primitives; `%%` control codes and MTEXT inline
     formatting are stripped to plain text; centre/right alignment and
     baseline rotation are honoured approximately (0.6·height advance)
   - WIPEOUT → white fill over its boundary
   - Colours resolve ACI/true-colour → RGB via the codec (`Color::rgb()`),
     with authored-white printed black like a CAD plot; lineweights convert
     1/100 mm values to mm.
4. **Page + emit** (`pdf.rs`) — content bounds drive the page (`extents`) or a
   uniform fit inside the sheet margins; drawing units map to mm, mm to
   points (×2.8346). PDF is y-up like CAD, so no flip is needed. Output is
   written atomically (`.pdf.tmp` → rename).

### TTF embedding without `text_layout`

printpdf is built with `default-features = false`. In that configuration
`ParsedFont::from_bytes` is a **stub** that stores bytes but parses no cmap —
handing it a TTF produces an empty font dictionary and invisible text.
Instead, dwg2pdf subsets the font itself (the approach `pdf_export.rs` uses
in the app): collect used characters, map them to GIDs with `ttf-parser`,
subset with `allsorts` (`SubsetProfile::Pdf`), then register the subset via
`ParsedFont::with_glyph_data` — original-bytes embed + correct ToUnicode and
widths. CFF/.otf fonts are rejected up front with a clear message.

## Supported input

Whatever opencadcodec reads — DWG R2000-era and newer, ASCII DXF. `READ`
coverage includes the wireframe/annotation subset: linear and curved
entities, fills, text, blocks and dimension graphics.

## Known limitations (v1)

- Wireframe-quality render (like a CAD "2D Wireframe" plot), not shaded 3D.
- Paper-space layouts render only their own entities — VIEWPORT contents are
  not drawn (a layout consisting solely of viewports reports "nothing to
  render").
- Pattern (non-solid) hatches draw boundary outlines only — no `.pat` fill
  generation.
- Linetype dash patterns are not reproduced (solid strokes).
- SHX glyph shapes are approximated by TTF/Helvetica glyphs; MTEXT
  renders as plain text (inline fonts, columns, stacking ignored).
- Skipped and counted under `--verbose`: RAY, XLINE, VIEWPORT,
  AttributeDefinition, MultiLeader, MESH, PolygonMesh, raster images,
  underlays, OLE frames, ACIS solids (SOLID3D/REGION/BODY/SURFACE), TOLERANCE,
  HELIX, SHAPE.

## Verifying a build

```sh
cargo build --release
./target/release/dwg2pdf testdata/smoke.dxf smoke.pdf -v
# expect: 22 primitives, 0 hidden entities; smoke.pdf starts with %PDF-1.3
```

`testdata/smoke.dxf` covers lines, arcs, bulge polylines, ellipse, spline,
SOLID/3DFACE, TEXT/MTEXT (incl. rotated + centred), two transformed INSERTs
of a ByBlock-coloured block, POINT, LEADER and a solid HATCH.
