use anyhow::{anyhow, bail, Context, Result};
use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tempfile::TempDir;
use which::which;

/// Attempt to extract text from a PDF by rasterizing each page and running Tesseract OCR.
pub fn extract_text_with_ocr(pdf_path: &Path) -> Result<String> {
    let tesseract = which("tesseract").context(
        "Tesseract binary not found. Please install it (e.g. via `brew install tesseract`).",
    )?;
    let pdftoppm = which("pdftoppm")
        .context("`pdftoppm` binary not found. Install Poppler (e.g. `brew install poppler`).")?;

    let temp_dir = TempDir::new().context("Failed to create temporary directory for OCR")?;
    let prefix = temp_dir.path().join("page");
    let prefix_str = prefix.to_string_lossy().to_string();

    // Render each PDF page to a PNG using pdftoppm.
    let status = Command::new(&pdftoppm)
        .arg("-r")
        .arg("300")
        .arg("-png")
        .arg(pdf_path.as_os_str())
        .arg(&prefix_str)
        .status()
        .with_context(|| {
            format!(
                "Failed to run `pdftoppm` on {:?}. Ensure Poppler is installed and accessible.",
                pdf_path
            )
        })?;

    if !status.success() {
        return Err(anyhow!(
            "`pdftoppm` exited with status {} while processing {:?}",
            status,
            pdf_path
        ));
    }

    let mut images: Vec<PathBuf> = fs::read_dir(temp_dir.path())
        .with_context(|| "Failed to read OCR temporary directory")?
        .filter_map(|entry| {
            entry.ok().and_then(|e| {
                let path = e.path();
                if path.extension().and_then(OsStr::to_str) == Some("png") {
                    Some(path)
                } else {
                    None
                }
            })
        })
        .collect();

    if images.is_empty() {
        return Err(anyhow!(
            "No images were produced during OCR preparation. The PDF may be encrypted or incompatible."
        ));
    }

    images.sort();
    let mut combined = String::new();

    for image in images {
        let output = Command::new(&tesseract)
            .arg(&image)
            .arg("stdout")
            .arg("-l")
            .arg("eng")
            .arg("--psm")
            .arg("3")
            .output()
            .with_context(|| format!("Failed to run `tesseract` on {:?}", image))?;

        if !output.status.success() {
            return Err(anyhow!(
                "`tesseract` failed while processing {:?}: {}",
                image,
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let page_text = String::from_utf8_lossy(&output.stdout);
        combined.push_str(&page_text);
        combined.push('\n');
    }

    let trimmed = combined.trim();
    if trimmed.is_empty() {
        return Err(anyhow!(
            "OCR completed but did not return any text. The document may be blank or unsupported."
        ));
    }

    Ok(trimmed.to_string())
}

/// Attempt to extract text using the `pdftotext` utility (part of Poppler).
pub fn extract_text_with_pdftotext(pdf_path: &Path) -> Result<String> {
    let pdftotext = which("pdftotext")
        .context("`pdftotext` binary not found. Install Poppler (e.g. `brew install poppler`).")?;

    let temp_dir =
        TempDir::new().context("Failed to create temporary directory for pdftotext output")?;
    let output_path = temp_dir.path().join("text.txt");

    let status = Command::new(&pdftotext)
        .arg("-layout")
        .arg("-nopgbrk")
        .arg(pdf_path.as_os_str())
        .arg(output_path.as_os_str())
        .status()
        .with_context(|| {
            format!(
                "Failed to run `pdftotext` on {:?}. Ensure Poppler is installed and accessible.",
                pdf_path
            )
        })?;

    if !status.success() {
        return Err(anyhow!(
            "`pdftotext` exited with status {} while processing {:?}",
            status,
            pdf_path
        ));
    }

    let text = fs::read_to_string(&output_path)
        .with_context(|| format!("Failed to read pdftotext output from {:?}", output_path))?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        bail!("`pdftotext` produced no text for {:?}", pdf_path);
    }

    Ok(trimmed.to_string())
}
