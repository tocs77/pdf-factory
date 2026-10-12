//! dwg2pdf — standalone DWG/DXF → PDF converter.
//!
//!   dwg2pdf in.dwg out.pdf
//!   dwg2pdf in.dxf out.pdf --paper a3 --landscape --font C:\Windows\Fonts\arial.ttf
//!
//! DWG is parsed by opencadcodec (the reader OpenCADStudio uses), tessellated
//! to 2D primitives by `render`, and written as a vector PDF by `pdf`.

mod geom;
mod pdf;
mod render;

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::Parser;
use codec::{CadDocument, DwgReader, DxfReader};

#[derive(Parser)]
#[command(
    name = "dwg2pdf",
    version,
    about = "Convert DWG/DXF drawings to PDF (vector, model space by default)"
)]
struct Cli {
    /// Input drawing (.dwg or .dxf).
    input: PathBuf,
    /// Output PDF path.
    output: PathBuf,
    /// Paper size: extents (drawing bounds, 1 unit = 1 mm) or a fixed sheet.
    #[arg(long, default_value = "extents",
          value_parser = ["extents", "a0", "a1", "a2", "a3", "a4", "a5", "letter", "legal"])]
    paper: String,
    /// Rotate fixed sheets 90° (ignored for --paper extents).
    #[arg(long)]
    landscape: bool,
    /// Page margin in millimetres.
    #[arg(long, default_value_t = 10.0)]
    margin: f64,
    /// Layout name to render instead of model space (e.g. "Layout1"), or a
    /// block-record name like "*Paper_Space".
    #[arg(long)]
    layout: Option<String>,
    /// TrueType font to embed for text. Default: Helvetica for Latin text; a
    /// system TTF is auto-embedded when text contains non-Latin glyphs.
    #[arg(long)]
    font: Option<PathBuf>,
    /// Print per-entity-type skip statistics.
    #[arg(short, long)]
    verbose: bool,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let doc = match load(&cli.input) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("dwg2pdf: cannot read {}: {e}", cli.input.display());
            return ExitCode::from(1);
        }
    };
    let paper = match pdf::parse_paper(&cli.paper, cli.landscape) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("dwg2pdf: {e}");
            return ExitCode::from(2);
        }
    };
    let (prims, stats) = render::render_document(&doc, cli.layout.as_deref());
    if cli.verbose {
        eprintln!("dwg2pdf: {} primitives, {} hidden entities", prims.len(), stats.hidden);
        for (name, count) in &stats.skipped {
            eprintln!("dwg2pdf: skipped {count}× {name}");
        }
    }
    if let Err(e) = pdf::write_pdf(
        &prims,
        &cli.output,
        paper,
        cli.margin.max(0.0),
        cli.font.as_deref(),
    ) {
        eprintln!("dwg2pdf: {e}");
        return ExitCode::from(1);
    }
    println!("{} → {}", cli.input.display(), cli.output.display());
    ExitCode::SUCCESS
}

/// Load `.dxf` via DxfReader; anything else is tried as DWG via DwgReader
/// (the reader itself validates the AC#### signature).
fn load(path: &Path) -> Result<CadDocument, String> {
    let is_dxf = path
        .extension()
        .map(|e| e.eq_ignore_ascii_case("dxf"))
        .unwrap_or(false)
        || std::fs::read(path)
            .map(|b| !b.starts_with(b"AC"))
            .unwrap_or(false);
    if is_dxf {
        DxfReader::from_file(path)
            .and_then(|r| r.read())
            .map_err(|e| e.to_string())
    } else {
        let bytes =
            std::fs::read(path).map_err(|e| format!("read failed: {e}"))?;
        let mut reader = DwgReader::from_stream_with_options(
            std::io::Cursor::new(bytes),
            codec::DwgReadOptions::default(),
        );
        reader
            .read_with_stats()
            .map(|outcome| outcome.document)
            .map_err(|e| e.to_string())
    }
}
