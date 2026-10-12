//! CadDocument → flat 2D primitives, ready for the PDF backend.
//!
//! Covers the wireframe/annotation subset of DWG: linear curves, arcs,
//! ellipses, splines, fills (SOLID/3DFACE/HATCH/WIPEOUT), text (TEXT/MTEXT/
//! ATTRIB) and block expansion (INSERT — which also pulls in DIMENSION
//! graphics via their anonymous `*D*` blocks and LEADER via its vertices).
//! Shaded 3D content (SOLID3D/REGION/SURFACE/MESH), raster images, underlays
//! and OLE frames are skipped and counted in [`Stats::skipped`].

use codec::entities::{self, BoundaryEdge};
use codec::objects::ObjectType;
use codec::types::{Color as AcadColor, LineWeight, Vector3};
use codec::{CadDocument, EntityType, Layer};

use crate::geom::{self, Mat2};

/// One drawable primitive in drawing units (treated as mm on the page).
#[derive(Debug, Clone)]
pub enum Prim {
    /// Polyline / polygon outline.
    Stroke {
        pts: Vec<[f64; 2]>,
        closed: bool,
        rgb: [u8; 3],
        /// Pen width in millimetres.
        width_mm: f64,
    },
    /// Filled region; `rings` are closed loops filled even-odd (holes work
    /// when a hatch carries its island loops in one entity).
    Fill { rings: Vec<Vec<[f64; 2]>>, rgb: [u8; 3] },
    /// One text line.
    Text {
        origin: [f64; 2],
        /// Cap height in drawing units.
        height: f64,
        /// Baseline rotation, radians.
        rotation: f64,
        text: String,
        rgb: [u8; 3],
    },
}

/// What the converter left out — reported with `--verbose`.
#[derive(Default, Debug)]
pub struct Stats {
    /// Entity type name → count skipped as unsupported or invisible.
    pub skipped: std::collections::BTreeMap<String, u32>,
    /// Entities skipped because their layer was off/frozen/non-plottable.
    pub hidden: u64,
}

impl Stats {
    fn skip(&mut self, name: &str) {
        *self.skipped.entry(name.to_string()).or_default() += 1;
    }
}

struct Ctx<'a> {
    doc: &'a CadDocument,
    /// Resolved colour/pen-width inherited from the enclosing INSERT for
    /// ByBlock children (already resolved to concrete values).
    by_block_rgb: Option<[u8; 3]>,
    by_block_lw: Option<f64>,
    depth: u32,
    out: Vec<Prim>,
    stats: Stats,
}

const MAX_BLOCK_DEPTH: u32 = 32;

/// Render model space (default) or a named layout's paper space.
pub fn render_document(doc: &CadDocument, layout: Option<&str>) -> (Vec<Prim>, Stats) {
    let mut ctx = Ctx {
        doc,
        by_block_rgb: None,
        by_block_lw: None,
        depth: 0,
        out: Vec::new(),
        stats: Stats::default(),
    };
    match layout {
        None => {
            for e in doc.model_space_entities() {
                emit(&mut ctx, e, &geom::IDENTITY);
            }
        }
        Some(name) => {
            // `--layout` accepts a layout name ("Layout1") resolved through the
            // objects map, or a raw block-record name ("*Paper_Space").
            let block = resolve_layout_block(doc, name).unwrap_or_else(|| name.to_string());
            for e in doc.entities_in_block(&block) {
                emit(&mut ctx, e, &geom::IDENTITY);
            }
        }
    }
    (ctx.out, ctx.stats)
}

/// Layout display name → its block record name.
fn resolve_layout_block(doc: &CadDocument, layout_name: &str) -> Option<String> {
    for object in doc.objects.values() {
        if let ObjectType::Layout(l) = object {
            if l.name.eq_ignore_ascii_case(layout_name) {
                return doc
                    .block_records
                    .iter()
                    .find(|r| r.handle == l.block_record)
                    .map(|r| r.name.clone());
            }
        }
    }
    None
}

// ── Style resolution ────────────────────────────────────────────────────────

/// ACI/true-colour → RGB for white paper. ACI 7 (and authored white) print
/// black, matching CAD plot behaviour.
fn paper_rgb(rgb: (u8, u8, u8)) -> [u8; 3] {
    if rgb == (255, 255, 255) {
        [0, 0, 0]
    } else {
        [rgb.0, rgb.1, rgb.2]
    }
}

fn color_rgb(
    color: &AcadColor,
    layer: Option<&Layer>,
    by_block: Option<[u8; 3]>,
    depth: u32,
) -> Option<[u8; 3]> {
    if depth > 4 {
        return Some([0, 0, 0]);
    }
    match color {
        AcadColor::Index(_) | AcadColor::Rgb { .. } => color.rgb().map(paper_rgb),
        AcadColor::ByLayer => layer
            .map(|l| color_rgb(&l.color, None, None, depth + 1))
            .unwrap_or(Some([0, 0, 0])),
        AcadColor::ByBlock => {
            Some(by_block.unwrap_or([0, 0, 0]))
        }
        AcadColor::None => None,
    }
}

/// Lineweight in mm (Value is 1/100 mm). ByLayer resolves through the layer
/// once; Default/unresolvable fall back to 0.25 mm (LWDEFAULT).
fn lineweight_mm(
    lw: &LineWeight,
    layer: Option<&Layer>,
    by_block: Option<f64>,
    depth: u32,
) -> f64 {
    const DEFAULT_MM: f64 = 0.25;
    if depth > 4 {
        return DEFAULT_MM;
    }
    match lw {
        LineWeight::Value(v) => (*v as f64 / 100.0).max(0.05),
        LineWeight::ByLayer => layer
            .map(|l| lineweight_mm(&l.line_weight, None, None, depth + 1))
            .unwrap_or(DEFAULT_MM),
        LineWeight::ByBlock => by_block.unwrap_or(DEFAULT_MM),
        LineWeight::Default => DEFAULT_MM,
    }
}

struct Style {
    rgb: [u8; 3],
    width_mm: f64,
}

/// Resolved style, or `None` when the entity must not be drawn (invisible,
/// layer off/frozen/non-plottable, explicit no-colour).
fn style_of(ctx: &Ctx, common: &codec::entities::EntityCommon) -> Option<Style> {
    if common.invisible {
        return None;
    }
    let layer = ctx.doc.layers.get(&common.layer);
    if let Some(l) = layer {
        if l.flags.off || l.flags.frozen || !l.is_plottable {
            return None;
        }
    }
    let rgb = color_rgb(&common.color, layer, ctx.by_block_rgb, 0)?;
    let width_mm = lineweight_mm(&common.line_weight, layer, ctx.by_block_lw, 0);
    Some(Style { rgb, width_mm })
}

// ── Emission helpers ────────────────────────────────────────────────────────

fn t3(m: &Mat2, v: &Vector3) -> [f64; 2] {
    geom::apply(m, v.x, v.y)
}

fn push_stroke(ctx: &mut Ctx, pts: Vec<[f64; 2]>, closed: bool, style: &Style) {
    if pts.len() >= 2 {
        ctx.out.push(Prim::Stroke {
            pts,
            closed,
            rgb: style.rgb,
            width_mm: style.width_mm,
        });
    }
}

fn stroke_pts(ctx: &mut Ctx, pts: &[[f64; 2]], closed: bool, m: &Mat2, style: &Style) {
    let mapped: Vec<[f64; 2]> = pts.iter().map(|&[x, y]| geom::apply(m, x, y)).collect();
    push_stroke(ctx, mapped, closed, style);
}

/// Strip `%%`-style DXF control codes from TEXT values.
fn strip_dxf_codes(s: &str) -> String {
    s.replace("%%%", "%")
        .replace("%%d", "°")
        .replace("%%D", "°")
        .replace("%%c", "Ø")
        .replace("%%C", "Ø")
        .replace("%%p", "±")
        .replace("%%P", "±")
        .replace("%%u", "")
        .replace("%%U", "")
        .replace("%%o", "")
        .replace("%%O", "")
}

/// Emit one text line. `height` is cap height in drawing units, `rotation`
/// the baseline angle. Alignment shifts the origin along the baseline using
/// a 0.6·height average glyph advance — approximate but stable.
fn push_text(
    ctx: &mut Ctx,
    origin: [f64; 2],
    height: f64,
    rotation: f64,
    width_factor: f64,
    halign: i32,
    text: String,
    m: &Mat2,
    rgb: [u8; 3],
) {
    let text = text.trim().to_string();
    if text.is_empty() || !(height > 0.0) || !height.is_finite() {
        return;
    }
    // halign: 0 left, 1 centre, 2 right (approximation for TEXT/ATTRIB).
    let w = height * 0.6 * text.chars().count() as f64 * width_factor;
    let shift = match halign {
        1 => -w / 2.0,
        2 => -w,
        _ => 0.0,
    };
    let (s, c) = rotation.sin_cos();
    let o = [origin[0] + c * shift, origin[1] + s * shift];
    let origin = geom::apply(m, o[0], o[1]);
    let height = height * geom::linear_scale(m);
    let rotation = rotation + geom::linear_rotation(m);
    ctx.out.push(Prim::Text {
        origin,
        height,
        rotation,
        text,
        rgb,
    });
}

// ── Entity dispatch ─────────────────────────────────────────────────────────

fn emit(ctx: &mut Ctx, e: &EntityType, m: &Mat2) {
    let common = e.common();
    let Some(style) = style_of(ctx, common) else {
        ctx.stats.hidden += 1;
        return;
    };
    match e {
        EntityType::Line(l) => stroke_pts(ctx, &[[l.start.x, l.start.y], [l.end.x, l.end.y]], false, m, &style),
        EntityType::Point(p) => {
            // Small "+" marker (PDMODE default), ~1 drawing unit arms.
            let [x, y] = t3(m, &p.location);
            let arm = 1.0;
            push_stroke(ctx, vec![[x - arm, y], [x + arm, y]], false, &style);
            push_stroke(ctx, vec![[x, y - arm], [x, y + arm]], false, &style);
        }
        EntityType::Circle(c) => {
            let pts = geom::arc_sample(c.center.x, c.center.y, c.radius, 0.0, std::f64::consts::TAU);
            stroke_pts(ctx, &pts, true, m, &style);
        }
        EntityType::Arc(a) => {
            let mut sweep = a.end_angle - a.start_angle;
            while sweep <= 0.0 {
                sweep += std::f64::consts::TAU;
            }
            let pts = geom::arc_sample(a.center.x, a.center.y, a.radius, a.start_angle, sweep);
            stroke_pts(ctx, &pts, false, m, &style);
        }
        EntityType::Ellipse(el) => {
            let pts = geom::ellipse_points(
                el.center.x,
                el.center.y,
                [el.major_axis.x, el.major_axis.y],
                el.minor_axis_ratio,
                el.start_parameter,
                el.end_parameter,
            );
            let full = (el.end_parameter - el.start_parameter).abs() >= std::f64::consts::TAU - 1e-9;
            stroke_pts(ctx, &pts, full, m, &style);
        }
        EntityType::LwPolyline(pl) => {
            let verts: Vec<(f64, f64, f64)> = pl
                .vertices
                .iter()
                .map(|v| (v.location.x, v.location.y, v.bulge))
                .collect();
            let pts = geom::polyline_with_bulges(&verts, pl.is_closed);
            stroke_pts(ctx, &pts, pl.is_closed, m, &style);
        }
        EntityType::Polyline2D(pl) => {
            let verts: Vec<(f64, f64, f64)> = pl
                .vertices
                .iter()
                .map(|v| (v.location.x, v.location.y, v.bulge))
                .collect();
            let pts = geom::polyline_with_bulges(&verts, pl.is_closed());
            stroke_pts(ctx, &pts, pl.is_closed(), m, &style);
        }
        EntityType::Polyline(pl) => {
            let pts: Vec<[f64; 2]> = pl.vertices.iter().map(|v| [v.location.x, v.location.y]).collect();
            stroke_pts(ctx, &pts, pl.is_closed(), m, &style);
        }
        EntityType::Polyline3D(pl) => {
            let pts: Vec<[f64; 2]> = pl.vertices.iter().map(|v| [v.position.x, v.position.y]).collect();
            stroke_pts(ctx, &pts, pl.is_closed(), m, &style);
        }
        EntityType::Spline(s) => {
            let cps: Vec<[f64; 3]> = s.control_points.iter().map(|c| [c.x, c.y, c.z]).collect();
            let pts = if cps.len() >= 2 {
                geom::spline_points(s.degree, &s.knots, &cps, &s.weights, s.flags.closed)
            } else {
                s.fit_points.iter().map(|c| [c.x, c.y]).collect()
            };
            stroke_pts(ctx, &pts, s.flags.closed, m, &style);
        }
        EntityType::Text(t) => {
            let halign = match t.horizontal_alignment {
                entities::TextHorizontalAlignment::Center | entities::TextHorizontalAlignment::Middle => 1,
                entities::TextHorizontalAlignment::Right => 2,
                _ => 0,
            };
            let origin = match (&t.alignment_point, halign) {
                (Some(ap), 1 | 2) => [ap.x, ap.y],
                _ => [t.insertion_point.x, t.insertion_point.y],
            };
            push_text(
                ctx,
                origin,
                t.height,
                t.rotation,
                t.width_factor.max(0.01),
                halign,
                strip_dxf_codes(&t.value),
                m,
                style.rgb,
            );
        }
        EntityType::MText(t) => {
            let plain =
                entities::mtext_format::parse_mtext(&t.value, true).to_plain_text();
            let leading = t.height * 1.667 * t.line_spacing_factor.max(0.2);
            for (i, line) in plain.lines().enumerate() {
                push_text(
                    ctx,
                    [t.insertion_point.x, t.insertion_point.y - i as f64 * leading],
                    t.height,
                    t.rotation,
                    1.0,
                    0,
                    line.to_string(),
                    m,
                    style.rgb,
                );
            }
        }
        EntityType::AttributeEntity(a) => {
            push_text(
                ctx,
                [a.insertion_point.x, a.insertion_point.y],
                a.height,
                a.rotation,
                a.width_factor.max(0.01),
                0,
                strip_dxf_codes(&a.value),
                m,
                style.rgb,
            );
        }
        EntityType::Insert(ins) => emit_insert(ctx, ins, m, &style),
        EntityType::Dimension(d) => {
            // Dimension graphics live in the anonymous `*D` block.
            let name = d.base().block_name.trim().to_string();
            if !name.is_empty() {
                emit_block(ctx, &name, m);
            } else {
                ctx.stats.skip("Dimension(no block)");
            }
        }
        EntityType::Table(t) => {
            let name = t.block_name.trim().to_string();
            if !name.is_empty() {
                emit_block(ctx, &name, m);
            } else {
                ctx.stats.skip("Table(no block)");
            }
        }
        EntityType::Leader(l) => {
            let pts: Vec<[f64; 2]> = l.vertices.iter().map(|v| [v.x, v.y]).collect();
            stroke_pts(ctx, &pts, false, m, &style);
        }
        EntityType::MLine(ml) => {
            let pts: Vec<[f64; 2]> = ml.vertices.iter().map(|v| [v.position.x, v.position.y]).collect();
            stroke_pts(ctx, &pts, false, m, &style);
        }
        EntityType::Solid(s) => {
            // AutoCAD SOLID corner order: 1-2-4-3 (swapped third/fourth).
            let ring = vec![
                t3(m, &s.first_corner),
                t3(m, &s.second_corner),
                t3(m, &s.fourth_corner),
                t3(m, &s.third_corner),
            ];
            ctx.out.push(Prim::Fill { rings: vec![ring], rgb: style.rgb });
        }
        EntityType::Face3D(f) => {
            let ring = vec![
                t3(m, &f.first_corner),
                t3(m, &f.second_corner),
                t3(m, &f.third_corner),
                t3(m, &f.fourth_corner),
            ];
            ctx.out.push(Prim::Fill { rings: vec![ring], rgb: style.rgb });
        }
        EntityType::Hatch(h) => emit_hatch(ctx, h, m, &style),
        EntityType::Wipeout(w) => emit_wipeout(ctx, w, m),
        EntityType::PolyfaceMesh(mesh) => {
            for face in &mesh.faces {
                let ring: Vec<[f64; 2]> = face
                    .vertex_indices()
                    .iter()
                    .filter_map(|&i| mesh.vertices.get(i.unsigned_abs() as usize - 1))
                    .map(|v| t3(m, &v.location))
                    .collect();
                push_stroke(ctx, ring, true, &style);
            }
        }
        other => ctx.stats.skip(entity_name(other)),
    }
}

fn entity_name(e: &EntityType) -> &'static str {
    match e {
        EntityType::Ray(_) => "Ray",
        EntityType::XLine(_) => "XLine",
        EntityType::Viewport(_) => "Viewport",
        EntityType::AttributeDefinition(_) => "AttributeDefinition",
        EntityType::MultiLeader(_) => "MultiLeader",
        EntityType::Mesh(_) => "Mesh",
        EntityType::PolygonMesh(_) => "PolygonMesh",
        EntityType::RasterImage(_) => "RasterImage",
        EntityType::Solid3D(_) => "Solid3D",
        EntityType::Region(_) => "Region",
        EntityType::Body(_) => "Body",
        EntityType::Surface(_) => "Surface",
        EntityType::Tolerance(_) => "Tolerance",
        EntityType::Helix(_) => "Helix",
        EntityType::Shape(_) => "Shape",
        EntityType::Underlay(_) => "Underlay",
        EntityType::Ole2Frame(_) => "Ole2Frame",
        _ => "Other",
    }
}

// ── Blocks ──────────────────────────────────────────────────────────────────

fn emit_block(ctx: &mut Ctx, block_name: &str, m: &Mat2) {
    if ctx.depth >= MAX_BLOCK_DEPTH {
        return;
    }
    let entities: Vec<EntityType> = ctx
        .doc
        .entities_in_block(block_name)
        .cloned()
        .collect();
    ctx.depth += 1;
    for e in &entities {
        emit(ctx, e, m);
    }
    ctx.depth -= 1;
}

fn emit_insert(ctx: &mut Ctx, ins: &entities::Insert, m: &Mat2, style: &Style) {
    let base = ctx
        .doc
        .block_records
        .get(&ins.block_name)
        .map(|r| r.base_point)
        .unwrap_or_default();
    let (sx, sy) = (ins.x_scale(), ins.y_scale());
    if sx.abs() < 1e-9 || sy.abs() < 1e-9 {
        return;
    }
    // world = xf ∘ T(ip) ∘ R(rot) ∘ T(col·cs, row·rs) ∘ S(sx,sy) ∘ T(-base)
    let header = geom::mat_mul(
        geom::translation(ins.insert_point.x, ins.insert_point.y),
        geom::rotation(ins.rotation),
    );
    let tail = geom::mat_mul(
        geom::scale(sx, sy),
        geom::translation(-base.x, -base.y),
    );
    // ByBlock children inherit the INSERT's own resolved style.
    let child_rgb = ctx.by_block_rgb.or(Some(style.rgb));
    let child_lw = ctx.by_block_lw.or(Some(style.width_mm));
    let saved_rgb = ctx.by_block_rgb;
    let saved_lw = ctx.by_block_lw;
    ctx.by_block_rgb = child_rgb;
    ctx.by_block_lw = child_lw;

    let rows = ins.row_count.max(1) as usize;
    let cols = ins.column_count.max(1) as usize;
    for row in 0..rows {
        for col in 0..cols {
            let grid = geom::translation(
                col as f64 * ins.column_spacing,
                row as f64 * ins.row_spacing,
            );
            let cell = geom::mat_mul(*m, geom::mat_mul(header, geom::mat_mul(grid, tail)));
            emit_block(ctx, &ins.block_name, &cell);
        }
    }
    ctx.by_block_rgb = saved_rgb;
    ctx.by_block_lw = saved_lw;

    // Attached attributes carry world/insert-space positions.
    for attr in &ins.attributes {
        if attr.value.is_empty() {
            continue;
        }
        push_text(
            ctx,
            [attr.insertion_point.x, attr.insertion_point.y],
            attr.height,
            attr.rotation,
            attr.width_factor.max(0.01),
            0,
            strip_dxf_codes(&attr.value),
            m,
            style.rgb,
        );
    }
}

// ── Hatches and wipeouts ────────────────────────────────────────────────────

fn edge_points(edge: &BoundaryEdge) -> Vec<[f64; 2]> {
    match edge {
        BoundaryEdge::Line(l) => vec![[l.start.x, l.start.y], [l.end.x, l.end.y]],
        BoundaryEdge::CircularArc(a) => {
            let mut sweep = a.end_angle - a.start_angle;
            if a.counter_clockwise {
                while sweep <= 0.0 {
                    sweep += std::f64::consts::TAU;
                }
            } else {
                while sweep >= 0.0 {
                    sweep -= std::f64::consts::TAU;
                }
            }
            geom::arc_sample(a.center.x, a.center.y, a.radius, a.start_angle, sweep)
        }
        BoundaryEdge::EllipticArc(e) => {
            let mut sweep = e.end_angle - e.start_angle;
            if e.counter_clockwise {
                while sweep <= 0.0 {
                    sweep += std::f64::consts::TAU;
                }
            } else {
                while sweep >= 0.0 {
                    sweep -= std::f64::consts::TAU;
                }
            }
            let n = 48;
            let minor = [
                -e.major_axis_endpoint.y * e.minor_axis_ratio,
                e.major_axis_endpoint.x * e.minor_axis_ratio,
            ];
            (0..=n)
                .map(|i| {
                    let t = e.start_angle + sweep * i as f64 / n as f64;
                    let (s, c) = t.sin_cos();
                    [
                        e.center.x + e.major_axis_endpoint.x * c + minor[0] * s,
                        e.center.y + e.major_axis_endpoint.y * c + minor[1] * s,
                    ]
                })
                .collect()
        }
        BoundaryEdge::Spline(s) => {
            let cps: Vec<[f64; 3]> = s.control_points.iter().map(|c| [c.x, c.y, c.z]).collect();
            let weights: Vec<f64> = Vec::new();
            geom::spline_points(s.degree, &s.knots, &cps, &weights, false)
        }
        BoundaryEdge::Polyline(p) => {
            // Vertices store (x, y, bulge) in Vector3.
            let verts: Vec<(f64, f64, f64)> =
                p.vertices.iter().map(|v| (v.x, v.y, v.z)).collect();
            geom::polyline_with_bulges(&verts, p.is_closed)
        }
    }
}

fn emit_hatch(ctx: &mut Ctx, h: &entities::Hatch, m: &Mat2, style: &Style) {
    let mut rings: Vec<Vec<[f64; 2]>> = Vec::new();
    for path in &h.paths {
        let mut loop_pts: Vec<[f64; 2]> = Vec::new();
        for edge in &path.edges {
            let mut pts = edge_points(edge);
            if loop_pts.is_empty() {
                loop_pts.append(&mut pts);
            } else {
                // Skip the duplicated first point of each continuation edge.
                loop_pts.extend(pts.into_iter().skip(1));
            }
        }
        if loop_pts.len() >= 3 {
            rings.push(loop_pts);
        }
    }
    if rings.is_empty() {
        return;
    }
    let rings: Vec<Vec<[f64; 2]>> = rings
        .into_iter()
        .map(|ring| ring.iter().map(|&[x, y]| geom::apply(m, x, y)).collect())
        .collect();
    if h.is_solid {
        ctx.out.push(Prim::Fill { rings, rgb: style.rgb });
    } else {
        // Pattern fills: outline the boundary (no .pat pattern generation).
        for ring in rings {
            push_stroke(ctx, ring, true, style);
        }
    }
}

fn emit_wipeout(ctx: &mut Ctx, w: &entities::Wipeout, m: &Mat2) {
    if w.clip_boundary_vertices.len() < 3 {
        ctx.stats.skip("Wipeout(no boundary)");
        return;
    }
    // Boundary verts are in the wipeout's image space; u/v vectors map it.
    let ring: Vec<[f64; 2]> = w
        .clip_boundary_vertices
        .iter()
        .map(|b| {
            let x = w.insertion_point.x + w.u_vector.x * b.x + w.v_vector.x * b.y;
            let y = w.insertion_point.y + w.u_vector.y * b.x + w.v_vector.y * b.y;
            geom::apply(m, x, y)
        })
        .collect();
    ctx.out.push(Prim::Fill {
        rings: vec![ring],
        rgb: [255, 255, 255],
    });
}
