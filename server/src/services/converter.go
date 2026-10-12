package services

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const convertTimeout = 5 * time.Minute

// IsCADFile reports whether name has a DWG or DXF extension (case-insensitive).
func IsCADFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".dwg" || ext == ".dxf"
}

// BinaryPath resolves the dwg2pdf executable: DWG2PDF_PATH env var first
// (set in Docker), then a local cargo release build next to the server dir,
// then PATH.
func BinaryPath() string {
	if p := os.Getenv("DWG2PDF_PATH"); p != "" {
		return p
	}
	local := "../dwg2pdf/target/release/dwg2pdf"
	if runtime.GOOS == "windows" {
		local += ".exe"
	}
	if _, err := os.Stat(local); err == nil {
		return local
	}
	return "dwg2pdf"
}

// ConvertToPdf runs dwg2pdf srcPath -> dstPath on a fixed paper sheet —
// extents-mode pages can reach hundreds of thousands of points, too large
// for the viewer canvas and the matcher rasterizer. Sheet and orientation
// are overridable via DWG2PDF_PAPER / DWG2PDF_LANDSCAPE. A non-zero exit
// returns an error carrying the tool's combined output tail.
func ConvertToPdf(ctx context.Context, srcPath, dstPath string) error {
	ctx, cancel := context.WithTimeout(ctx, convertTimeout)
	defer cancel()

	paper := os.Getenv("DWG2PDF_PAPER")
	if paper == "" {
		paper = "a0"
	}
	args := []string{srcPath, dstPath, "--paper", paper}
	if os.Getenv("DWG2PDF_LANDSCAPE") != "0" {
		args = append(args, "--landscape")
	}

	cmd := exec.CommandContext(ctx, BinaryPath(), args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("dwg2pdf failed: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
