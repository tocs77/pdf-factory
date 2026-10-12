//! 2D affine transforms and curve flattening for entity tessellation.

/// 2D affine transform `[a, b, c, d, e, f]`:
/// `(x', y') = (a·x + c·y + e, b·x + d·y + f)`.
pub type Mat2 = [f64; 6];

pub const IDENTITY: Mat2 = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

/// `m ∘ o` — applies `o` first, then `m`.
pub fn mat_mul(m: Mat2, o: Mat2) -> Mat2 {
    [
        m[0] * o[0] + m[2] * o[1],
        m[1] * o[0] + m[3] * o[1],
        m[0] * o[2] + m[2] * o[3],
        m[1] * o[2] + m[3] * o[3],
        m[0] * o[4] + m[2] * o[5] + m[4],
        m[1] * o[4] + m[3] * o[5] + m[5],
    ]
}

pub fn translation(x: f64, y: f64) -> Mat2 {
    [1.0, 0.0, 0.0, 1.0, x, y]
}

pub fn rotation(rad: f64) -> Mat2 {
    let (s, c) = rad.sin_cos();
    [c, s, -s, c, 0.0, 0.0]
}

pub fn scale(sx: f64, sy: f64) -> Mat2 {
    [sx, 0.0, 0.0, sy, 0.0, 0.0]
}

pub fn apply(m: &Mat2, x: f64, y: f64) -> [f64; 2] {
    [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/// Absolute linear scale of a transform (uniform part; used to scale text
/// heights through insert transforms).
pub fn linear_scale(m: &Mat2) -> f64 {
    ((m[0] * m[0] + m[1] * m[1]).sqrt() + (m[2] * m[2] + m[3] * m[3]).sqrt()) * 0.5
}

/// Rotation a transform applies to the +X axis (for text rotation).
pub fn linear_rotation(m: &Mat2) -> f64 {
    m[1].atan2(m[0])
}

/// Segment count for a circular arc of radius `r` spanning `sweep` radians.
/// Chord deviation ≈ 0.5 % of radius, clamped.
fn arc_segments(r: f64, sweep: f64) -> usize {
    let tol = (r * 0.005).clamp(0.02, 2.0);
    let step = if r <= tol {
        std::f64::consts::FRAC_PI_4
    } else {
        2.0 * (1.0 - tol / r).clamp(0.0, 1.0).acos()
    };
    ((sweep.abs() / step.max(0.01)).ceil() as usize).clamp(4, 1024)
}

/// Sample a circular arc: `sweep` is signed (positive = CCW) starting at `a0`.
pub fn arc_sample(cx: f64, cy: f64, r: f64, a0: f64, sweep: f64) -> Vec<[f64; 2]> {
    let n = arc_segments(r, sweep);
    (0..=n)
        .map(|i| {
            let t = a0 + sweep * i as f64 / n as f64;
            [cx + r * t.cos(), cy + r * t.sin()]
        })
        .collect()
}

/// Points of a polyline segment `p0 → p1` carrying DXF bulge `b`
/// (excluding `p0`; last point is `p1`). Bulge = tan(θ/4) where θ is the
/// signed included angle; positive bulge arcs counter-clockwise.
pub fn bulge_segment(p0: [f64; 2], p1: [f64; 2], b: f64) -> Vec<[f64; 2]> {
    if !b.is_finite() || b.abs() < 1e-12 {
        return vec![p1];
    }
    let dx = p1[0] - p0[0];
    let dy = p1[1] - p0[1];
    let d = dx.hypot(dy);
    if d < 1e-12 {
        return vec![p1];
    }
    let theta = 4.0 * b.atan(); // signed included angle
    let b_abs = b.abs();
    let r = d * (1.0 + b_abs * b_abs) / (4.0 * b_abs);
    let s = b_abs * d / 2.0;
    let h = r - s; // signed distance from chord midpoint to centre
    // Unit normal to the LEFT of p0→p1.
    let lx = -dy / d;
    let ly = dx / d;
    let sgn = if b > 0.0 { 1.0 } else { -1.0 };
    let cx = (p0[0] + p1[0]) / 2.0 + lx * h * sgn;
    let cy = (p0[1] + p1[1]) / 2.0 + ly * h * sgn;
    let a0 = (p0[1] - cy).atan2(p0[0] - cx);
    let mut pts = arc_sample(cx, cy, r, a0, theta);
    if let Some(first) = pts.first_mut() {
        *first = p0;
    }
    if let Some(last) = pts.last_mut() {
        *last = p1;
    }
    pts.into_iter().skip(1).collect()
}

/// Flatten a vertex list `(x, y, bulge)`; `closed` connects the last vertex
/// back to the first.
pub fn polyline_with_bulges(verts: &[(f64, f64, f64)], closed: bool) -> Vec<[f64; 2]> {
    if verts.is_empty() {
        return Vec::new();
    }
    let mut out: Vec<[f64; 2]> = vec![[verts[0].0, verts[0].1]];
    let n = verts.len();
    let segs = if closed { n } else { n - 1 };
    for i in 0..segs {
        let (x0, y0, b) = verts[i];
        let (x1, y1, _) = verts[(i + 1) % n];
        out.extend(bulge_segment([x0, y0], [x1, y1], b));
    }
    out
}

/// Sample an ellipse by parameter `t ∈ [t0, t1]` (radians). `major` is the
/// major-axis vector from the centre; `ratio` = minor/major.
pub fn ellipse_points(
    cx: f64,
    cy: f64,
    major: [f64; 2],
    ratio: f64,
    t0: f64,
    t1: f64,
) -> Vec<[f64; 2]> {
    let minor = [-major[1] * ratio, major[0] * ratio];
    let mut sweep = t1 - t0;
    let two_pi = std::f64::consts::TAU;
    if (t1 - t0).abs() >= two_pi - 1e-9 || (sweep.abs() - two_pi).abs() < 1e-9 {
        sweep = two_pi;
    } else {
        while sweep <= 0.0 {
            sweep += two_pi;
        }
    }
    let r_max = major[0].hypot(major[1]);
    let n = arc_segments(r_max, sweep);
    (0..=n)
        .map(|i| {
            let t = t0 + sweep * i as f64 / n as f64;
            let (s, c) = t.sin_cos();
            [
                cx + major[0] * c + minor[0] * s,
                cy + major[1] * c + minor[1] * s,
            ]
        })
        .collect()
}

/// Evaluate a (possibly rational) B-spline at parameter `u` — de Boor.
/// `cps` are 3D control points; `weights` may be empty (non-rational).
fn bspline_eval(
    degree: usize,
    knots: &[f64],
    cps: &[[f64; 3]],
    weights: &[f64],
    u: f64,
) -> [f64; 3] {
    let n = cps.len();
    if n == 0 {
        return [0.0; 3];
    }
    // Homogeneous coordinates (w·x, w·y, w·z, w).
    let w_at = |i: usize| weights.get(i).copied().unwrap_or(1.0);
    // Knot span: largest k with knots[k] <= u, clamped to [p, n].
    let p = degree;
    let mut k = knots
        .partition_point(|&kn| kn <= u)
        .saturating_sub(1)
        .clamp(p, n.saturating_sub(1).max(p));
    if k >= n {
        k = n.saturating_sub(1);
    }
    // d[j] = control point k-p+j in homogeneous space.
    let mut d: Vec<[f64; 4]> = (0..=p.min(k))
        .map(|j| {
            let i = k - p + j;
            let i = i.min(n - 1);
            let w = w_at(i);
            [cps[i][0] * w, cps[i][1] * w, cps[i][2] * w, w]
        })
        .collect();
    for r in 1..=p {
        for j in (r..=p).rev() {
            let i = k - p + j;
            let i = i.min(knots.len().saturating_sub(1));
            let left = knots[i];
            let right = knots[(i + p + 1 - r).min(knots.len() - 1)];
            let denom = right - left;
            let a = if denom.abs() < 1e-12 {
                0.0
            } else {
                (u - left) / denom
            };
            if j < d.len() && j - 1 < d.len() {
                for c in 0..4 {
                    d[j][c] = (1.0 - a) * d[j - 1][c] + a * d[j][c];
                }
            }
        }
    }
    let h = d[p.min(d.len() - 1)];
    if h[3].abs() < 1e-12 {
        [h[0], h[1], h[2]]
    } else {
        [h[0] / h[3], h[1] / h[3], h[2] / h[3]]
    }
}

/// Flatten a NURBS spline to a polyline. `closed` appends the start point.
pub fn spline_points(
    degree: i32,
    knots: &[f64],
    cps: &[[f64; 3]],
    weights: &[f64],
    closed: bool,
) -> Vec<[f64; 2]> {
    let n = cps.len();
    if n == 0 {
        return Vec::new();
    }
    if n < 2 {
        return vec![[cps[0][0], cps[0][1]]];
    }
    let p = (degree.max(1) as usize).min(n - 1);
    // Build a clamped-uniform knot vector when the stored one is unusable.
    let owned;
    let knots = if knots.len() >= n + p + 1 && knots.windows(2).all(|w| w[1] >= w[0]) {
        knots
    } else {
        owned = (0..=n + p).map(|i| i as f64).collect::<Vec<_>>();
        &owned[..]
    };
    let u0 = knots[p];
    let u1 = knots[knots.len() - 1 - p];
    if !(u1 > u0) {
        return cps.iter().map(|c| [c[0], c[1]]).collect();
    }
    // ~8 samples per knot span is smooth enough for a plot.
    let spans = (n - p).max(1);
    let steps = (spans * 8).clamp(32, 2048);
    let mut out: Vec<[f64; 2]> = (0..=steps)
        .map(|i| {
            let u = u0 + (u1 - u0) * i as f64 / steps as f64;
            let [x, y, _] = bspline_eval(p, knots, cps, weights, u);
            [x, y]
        })
        .collect();
    if closed {
        if let Some(first) = out.first().copied() {
            out.push(first);
        }
    }
    out
}
