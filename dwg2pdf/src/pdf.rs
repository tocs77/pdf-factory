//! Primitives → vector PDF via printpdf.
//!
//! Emission patterns (`MM_TO_PT`, `DrawLine`/`DrawPolygon`/`SetTextMatrix`
//! op shapes, atomic save) mirror `src/io/pdf_export.rs` in OpenCADStudio.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use printpdf::{
    BuiltinFont, Color, FontId, Line, LinePoint, Mm, Op, PaintMode, ParsedFont, PdfDocument,
    PdfFontHandle, PdfPage, PdfSaveOptions, Point, Polygon, PolygonRing, Pt, Rgb, TextItem,
    TextMatrix, WindingOrder,
};

use crate::render::Prim;

/// mm → PDF points.
const MM_TO_PT: f32 = 72.0 / 25.4;
/// Helvetica cap height ≈ 0.72 em; the em size for a given cap height is
/// `height / CAP_RATIO`.
const HELVETICA_CAP_RATIO: f32 = 0.72;

/// Page size selection.
#[derive(Debug, Clone, Copy)]
pub enum Paper {
    /// Page = drawing extents + margin; 1 drawing unit = 1 mm.
    Extents,
    /// Fixed sheet; content is scaled to fit inside the margins.
    Fixed { w_mm: f64, h_mm: f64 },
}

pub fn parse_paper(name: &str, landscape: bool) -> Result<Paper, String> {
    let dims = |w: f64, h: f64| {
        if landscape {
            Paper::Fixed { w_mm: h, h_mm: w }
        } else {
            Paper::Fixed { w_mm: w, h_mm: h }
        }
    };
    Ok(match name.to_ascii_lowercase().as_str() {
        "extents" | "fit" => Paper::Extents,
        "a5" => dims(148.0, 210.0),
        "a4" => dims(210.0, 297.0),
        "a3" => dims(297.0, 420.0),
        "a2" => dims(420.0, 594.0),
        "a1" => dims(594.0, 841.0),
        "a0" => dims(841.0, 1189.0),
        "letter" => dims(215.9, 279.4),
        "legal" => dims(215.9, 355.6),
        other => return Err(format!("unknown paper size {other:?} (use extents, a0..a5, letter, legal)")),
    })
}

/// Page geometry after fitting: size in mm, scale (page-mm per drawing-mm)
/// and offset in page-mm added to drawing coordinates.
struct Fit {
    page_w: f64,
    page_h: f64,
    scale: f64,
    ox: f64,
    oy: f64,
}

fn content_bounds(prims: &[Prim]) -> Option<(f64, f64, f64, f64)> {
    let mut b = (f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY);
    let mut push = |x: f64, y: f64| {
        if x.is_finite() && y.is_finite() {
            b.0 = b.0.min(x);
            b.1 = b.1.min(y);
            b.2 = b.2.max(x);
            b.3 = b.3.max(y);
        }
    };
    for p in prims {
        match p {
            Prim::Stroke { pts, .. } => pts.iter().for_each(|&[x, y]| push(x, y)),
            Prim::Fill { rings, .. } => rings
                .iter()
                .flat_map(|r| r.iter())
                .for_each(|&[x, y]| push(x, y)),
            Prim::Text { origin, height, rotation, text, .. } => {
                let w = height * 0.6 * text.chars().count() as f64;
                let (s, c) = rotation.sin_cos();
                for (dx, dy) in [(0.0, 0.0), (w, 0.0), (w, *height), (0.0, *height)] {
                    push(origin[0] + c * dx - s * dy, origin[1] + s * dx + c * dy);
                }
            }
        }
    }
    (b.0.is_finite() && b.2 > b.0 && b.3 > b.1).then_some(b)
}

fn fit(prims: &[Prim], paper: Paper, margin_mm: f64) -> Fit {
    let (x0, y0, x1, y1) = content_bounds(prims).unwrap_or((0.0, 0.0, 210.0, 297.0));
    match paper {
        Paper::Extents => {
            let w = ((x1 - x0) + 2.0 * margin_mm).max(1.0);
            let h = ((y1 - y0) + 2.0 * margin_mm).max(1.0);
            Fit {
                page_w: w,
                page_h: h,
                scale: 1.0,
                ox: margin_mm - x0,
                oy: margin_mm - y0,
            }
        }
        Paper::Fixed { w_mm, h_mm, .. } => {
            let inner_w = (w_mm - 2.0 * margin_mm).max(1.0);
            let inner_h = (h_mm - 2.0 * margin_mm).max(1.0);
            let scale = (inner_w / (x1 - x0)).min(inner_h / (y1 - y0)).max(1e-9);
            let ox = margin_mm + (inner_w - (x1 - x0) * scale) / 2.0 - x0 * scale;
            let oy = margin_mm + (inner_h - (y1 - y0) * scale) / 2.0 - y0 * scale;
            Fit {
                page_w: w_mm,
                page_h: h_mm,
                scale,
                ox,
                oy,
            }
        }
    }
}

/// Write one PDF page at `path`. Returns Err when there is nothing to draw.
pub fn write_pdf(
    prims: &[Prim],
    path: &Path,
    paper: Paper,
    margin_mm: f64,
    font_path: Option<&Path>,
) -> Result<(), String> {
    if prims.is_empty() {
        return Err("nothing to render (no drawable entities)".into());
    }
    let fit = fit(prims, paper, margin_mm);

    let mut doc = PdfDocument::new("dwg2pdf");
    let mut chars = BTreeSet::new();
    for prim in prims {
        if let Prim::Text { text, .. } = prim {
            chars.extend(text.chars());
        }
    }
    // Base-14 Helvetica covers WinAnsi only — pick a real TTF automatically
    // when the drawing contains anything beyond it (Cyrillic, CJK, …).
    let auto = font_path.is_none() && chars.iter().any(|&c| c as u32 > 0xFF);
    let font: PdfFontHandle = match font_path.map(|p| p.to_path_buf()).or_else(|| {
        if auto {
            find_system_ttf()
        } else {
            None
        }
    }) {
        Some(p) => match embed_ttf(&mut doc, &p, &chars) {
            Ok(id) => PdfFontHandle::External(id),
            Err(e) => {
                eprintln!("dwg2pdf: {e}; falling back to Helvetica");
                PdfFontHandle::Builtin(BuiltinFont::Helvetica)
            }
        },
        None => {
            if auto {
                eprintln!(
                    "dwg2pdf: text contains non-Latin glyphs but no system TTF found; \
                     pass --font <file.ttf> or they will be dropped"
                );
            }
            PdfFontHandle::Builtin(BuiltinFont::Helvetica)
        }
    };

    let mut ops: Vec<Op> = Vec::new();
    // White sheet background.
    ops.push(Op::SetFillColor {
        col: Color::Rgb(Rgb { r: 1.0, g: 1.0, b: 1.0, icc_profile: None }),
    });
    ops.push(Op::DrawPolygon {
        polygon: Polygon {
            rings: vec![PolygonRing {
                points: rect_points(0.0, 0.0, fit.page_w, fit.page_h),
            }],
            mode: PaintMode::Fill,
            winding_order: WindingOrder::NonZero,
        },
    });

    // Style state dedupe — Set* ops are emitted only on change.
    let mut cur_stroke: Option<(u8, u8, u8)> = None;
    let mut cur_lw: Option<u32> = None;
    let mut cur_fill: Option<(u8, u8, u8)> = None;

    for prim in prims {
        match prim {
            Prim::Stroke { pts, closed, rgb: color, width_mm } => {
                let key = (color[0], color[1], color[2]);
                if cur_stroke != Some(key) {
                    cur_stroke = Some(key);
                    ops.push(Op::SetOutlineColor { col: rgb(*color) });
                }
                let lw_um = (width_mm * fit.scale * 1000.0).max(30.0) as u32;
                if cur_lw != Some(lw_um) {
                    cur_lw = Some(lw_um);
                    ops.push(Op::SetOutlineThickness {
                        pt: Pt(lw_um as f32 / 1000.0 * MM_TO_PT),
                    });
                }
                ops.push(Op::DrawLine {
                    line: Line {
                        points: pts
                            .iter()
                            .map(|&[x, y]| to_mm(x, y, &fit))
                            .collect(),
                        is_closed: *closed,
                    },
                });
            }
            Prim::Fill { rings, rgb: color } => {
                let key = (color[0], color[1], color[2]);
                if cur_fill != Some(key) {
                    cur_fill = Some(key);
                    ops.push(Op::SetFillColor { col: rgb(*color) });
                }
                ops.push(Op::DrawPolygon {
                    polygon: Polygon {
                        rings: rings
                            .iter()
                            .map(|ring| PolygonRing {
                                points: ring.iter().map(|&[x, y]| to_mm(x, y, &fit)).collect(),
                            })
                            .collect(),
                        mode: PaintMode::Fill,
                        winding_order: WindingOrder::EvenOdd,
                    },
                });
            }
            Prim::Text { origin, height, rotation, text, rgb: color } => {
                let (x_mm, y_mm) = (
                    (origin[0] * fit.scale + fit.ox),
                    (origin[1] * fit.scale + fit.oy),
                );
                let size_pt =
                    ((*height * fit.scale * MM_TO_PT as f64) / HELVETICA_CAP_RATIO as f64)
                        .max(0.5);
                let (s, c) = rotation.sin_cos();
                let (x_pt, y_pt) = (x_mm * MM_TO_PT as f64, y_mm * MM_TO_PT as f64);
                ops.push(Op::StartTextSection);
                ops.push(Op::SetFont {
                    font: font.clone(),
                    size: Pt(size_pt as f32),
                });
                ops.push(Op::SetTextMatrix {
                    matrix: TextMatrix::Raw([
                        c as f32,
                        s as f32,
                        -s as f32,
                        c as f32,
                        x_pt as f32,
                        y_pt as f32,
                    ]),
                });
                ops.push(Op::SetFillColor { col: rgb(*color) });
                ops.push(Op::ShowText {
                    items: vec![TextItem::Text(text.clone())],
                });
                ops.push(Op::EndTextSection);
            }
        }
    }

    doc.pages.push(PdfPage::new(
        Mm(fit.page_w as f32),
        Mm(fit.page_h as f32),
        ops,
    ));
    let bytes = doc.save(&PdfSaveOptions::default(), &mut Vec::new());

    // Atomic write: temp beside the destination, then rename.
    let tmp = path.with_extension("pdf.tmp");
    std::fs::write(&tmp, &bytes).map_err(|e| format!("cannot write {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("cannot replace {}: {e}", path.display())
    })?;
    Ok(())
}

/// First usable system font covering a broad Unicode range.
fn find_system_ttf() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    #[cfg(windows)]
    {
        let win = std::env::var_os("WINDIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
        for f in ["arial.ttf", "segoeui.ttf", "calibri.ttf", "times.ttf", "tahoma.ttf"] {
            candidates.push(win.join("Fonts").join(f));
        }
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    for f in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ] {
        candidates.push(PathBuf::from(f));
    }
    #[cfg(target_os = "macos")]
    for f in [
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ] {
        candidates.push(PathBuf::from(f));
    }
    candidates.into_iter().find(|p| p.is_file())
}

/// Subset the TTF at `path` to `chars` (+ .notdef) and register the subset
/// with the document. printpdf built without `text_layout` embeds
/// `ParsedFont::original_bytes` verbatim as the CIDFontType2 stream and
/// derives ToUnicode/widths from the maps passed to `with_glyph_data` — so
/// handing it subset bytes with subset-space maps yields a true subset embed
/// (pattern copied from `subset_family` in `src/io/pdf_export.rs`).
fn embed_ttf(
    doc: &mut PdfDocument,
    path: &Path,
    chars: &BTreeSet<char>,
) -> Result<FontId, String> {
    use allsorts::{binary::read::ReadScope, font_data::FontData, tables::FontTableProvider};

    let bytes =
        std::fs::read(path).map_err(|e| format!("cannot read font {}: {e}", path.display()))?;
    let orig = ttf_parser::Face::parse(&bytes, 0)
        .map_err(|e| format!("cannot parse font {}: {e}", path.display()))?;
    // Original GIDs for the used chars (+ .notdef, mandatory for subsetting).
    let mut ids: Vec<u16> = vec![0];
    for c in chars {
        if let Some(gid) = orig.glyph_index(*c) {
            if !ids.contains(&gid.0) {
                ids.push(gid.0);
            }
        }
    }
    if ids.len() <= 1 {
        return Err(format!("{} covers none of the used glyphs", path.display()));
    }
    let scope = ReadScope::new(&bytes);
    let font_file = scope
        .read::<FontData<'_>>()
        .map_err(|e| format!("cannot read font tables: {e}"))?;
    let provider = font_file
        .table_provider(0)
        .map_err(|e| format!("cannot read font tables: {e}"))?;
    if provider.has_table(allsorts::tag::CFF) || provider.has_table(allsorts::tag::CFF2) {
        return Err(format!(
            "{} has CFF outlines; a TrueType (.ttf) font is required",
            path.display()
        ));
    }
    let subset_bytes = allsorts::subset::subset(
        &provider,
        &ids,
        &allsorts::subset::SubsetProfile::Pdf,
        allsorts::subset::CmapTarget::Unicode,
    )
    .map_err(|e| format!("font subsetting failed: {e}"))?;
    // Re-parse the SUBSET: the maps below must be in subset glyph space.
    let sub = ttf_parser::Face::parse(&subset_bytes, 0)
        .map_err(|e| format!("cannot parse subset font: {e}"))?;
    let upem = sub.units_per_em().max(1);
    let mut cp_map: BTreeMap<u32, u16> = BTreeMap::new();
    let mut widths: BTreeMap<u16, u16> = BTreeMap::new();
    for c in chars {
        if let Some(gid) = sub.glyph_index(*c) {
            cp_map.insert(*c as u32, gid.0);
            widths.insert(gid.0, sub.glyph_hor_advance(gid).unwrap_or(0));
        }
    }
    if cp_map.is_empty() {
        return Err(format!("{} covers none of the used glyphs", path.display()));
    }
    let family = sub
        .names()
        .into_iter()
        .find(|n| n.name_id == ttf_parser::name_id::FAMILY)
        .and_then(|n| n.to_string())
        .or_else(|| path.file_stem().map(|s| s.to_string_lossy().into_owned()));
    let (ascent, descent) = (sub.ascender(), sub.descender());
    let parsed = ParsedFont::with_glyph_data(
        subset_bytes,
        0,
        family,
        cp_map,
        widths,
        upem,
        printpdf::FontMetrics { ascent, descent },
    );
    Ok(doc.add_font(&parsed))
}

fn rgb([r, g, b]: [u8; 3]) -> Color {
    Color::Rgb(Rgb {
        r: r as f32 / 255.0,
        g: g as f32 / 255.0,
        b: b as f32 / 255.0,
        icc_profile: None,
    })
}

fn to_mm(x: f64, y: f64, fit: &Fit) -> LinePoint {
    LinePoint {
        p: Point::new(
            Mm((x * fit.scale + fit.ox) as f32),
            Mm((y * fit.scale + fit.oy) as f32),
        ),
        bezier: false,
    }
}

fn rect_points(x0: f64, y0: f64, w: f64, h: f64) -> Vec<LinePoint> {
    [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h)]
        .iter()
        .map(|&(x, y)| LinePoint {
            p: Point::new(Mm(x as f32), Mm(y as f32)),
            bezier: false,
        })
        .collect()
}
