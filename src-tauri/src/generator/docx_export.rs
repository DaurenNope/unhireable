use crate::generator::{DocumentFormat, GeneratedDocument};
use anyhow::Result;
use docx_rs::*;
use std::fs::File;
use std::path::Path;

pub struct DOCXExporter;

// Professional color scheme (RGB hex)
const PRIMARY_COLOR: &str = "06b6d4"; // Cyan
const SECONDARY_COLOR: &str = "a855f7"; // Purple
const TEXT_COLOR: &str = "212121"; // Dark gray

#[derive(Debug, Clone)]
enum DocumentSection {
    Title(String),
    Heading(String),
    Subheading(String),
    Paragraph(String),
    ListItem(String),
    Separator,
}

impl DOCXExporter {
    pub fn new() -> Self {
        Self
    }

    pub fn export_to_docx(&self, document: &GeneratedDocument, output_path: &Path) -> Result<()> {
        match document.format {
            DocumentFormat::Markdown => {
                let text = self.markdown_to_text(&document.content)?;
                self.export_text_to_docx(&text, output_path)
            }
            DocumentFormat::HTML => {
                let text = self.html_to_text(&document.content);
                self.export_text_to_docx(&text, output_path)
            }
            DocumentFormat::Text => self.export_text_to_docx(&document.content, output_path),
            DocumentFormat::PDF => self.export_text_to_docx(&document.content, output_path),
        }
    }

    pub fn export_text_to_docx(&self, text: &str, output_path: &Path) -> Result<()> {
        let mut doc = Docx::new();

        // Parse document structure
        let sections = self.parse_document_structure(text);

        for section in sections {
            match section {
                DocumentSection::Title(text) => {
                    // Large, bold, colored title
                    doc = doc.add_paragraph(
                        Paragraph::new().add_run(
                            Run::new()
                                .add_text(text)
                                .bold()
                                .size(28)
                                .color(PRIMARY_COLOR),
                        ),
                    );
                    // Add spacing paragraph
                    doc = doc.add_paragraph(Paragraph::new());
                }
                DocumentSection::Heading(text) => {
                    // Colored, uppercase heading
                    doc = doc.add_paragraph(
                        Paragraph::new().add_run(
                            Run::new()
                                .add_text(text.to_uppercase())
                                .bold()
                                .size(16)
                                .color(PRIMARY_COLOR),
                        ),
                    );
                    doc = doc.add_paragraph(Paragraph::new());
                }
                DocumentSection::Subheading(text) => {
                    // Bold subheading
                    doc = doc.add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(text).bold().size(14).color(TEXT_COLOR)),
                    );
                }
                DocumentSection::Paragraph(text) => {
                    doc = doc.add_paragraph(
                        Paragraph::new()
                            .add_run(Run::new().add_text(text).size(11).color(TEXT_COLOR)),
                    );
                }
                DocumentSection::ListItem(text) => {
                    // Colored bullet with text
                    doc = doc.add_paragraph(
                        Paragraph::new()
                            .add_run(
                                Run::new()
                                    .add_text("• ")
                                    .bold()
                                    .size(12)
                                    .color(SECONDARY_COLOR),
                            )
                            .add_run(Run::new().add_text(text).size(11).color(TEXT_COLOR)),
                    );
                }
                DocumentSection::Separator => {
                    // Add spacing for separator
                    doc = doc.add_paragraph(Paragraph::new());
                    doc = doc.add_paragraph(Paragraph::new());
                }
            }
        }

        // Write the document
        let mut file = File::create(output_path)?;
        doc.build().pack(&mut file)?;
        println!(
            "✅ Professional DOCX exported successfully to: {}",
            output_path.display()
        );

        Ok(())
    }

    fn parse_document_structure(&self, text: &str) -> Vec<DocumentSection> {
        let mut sections = Vec::new();
        let lines: Vec<&str> = text.lines().collect();
        let mut i = 0;

        while i < lines.len() {
            let line = lines[i].trim();

            if line.is_empty() {
                i += 1;
                continue;
            }

            if line.starts_with("# ") {
                sections.push(DocumentSection::Title(
                    line.trim_start_matches("# ").to_string(),
                ));
            } else if line.starts_with("## ") {
                sections.push(DocumentSection::Heading(
                    line.trim_start_matches("## ").to_string(),
                ));
            } else if line.starts_with("### ") {
                sections.push(DocumentSection::Subheading(
                    line.trim_start_matches("### ").to_string(),
                ));
            } else if line.starts_with("---") || line.starts_with("===") {
                sections.push(DocumentSection::Separator);
            } else if line.starts_with("- ") || line.starts_with("* ") {
                let item = line.trim_start_matches("- ").trim_start_matches("* ");
                sections.push(DocumentSection::ListItem(item.to_string()));
            } else {
                let mut para = line.to_string();
                i += 1;
                while i < lines.len() {
                    let next_line = lines[i].trim();
                    if next_line.is_empty()
                        || next_line.starts_with("#")
                        || next_line.starts_with("-")
                        || next_line.starts_with("*")
                    {
                        break;
                    }
                    para.push_str(" ");
                    para.push_str(next_line);
                    i += 1;
                }
                sections.push(DocumentSection::Paragraph(para));
                continue;
            }

            i += 1;
        }

        sections
    }

    fn markdown_to_text(&self, markdown: &str) -> Result<String> {
        let mut text = markdown.to_string();
        let code_block_pattern = regex::Regex::new(r"(?s)```[^`]*```").unwrap();
        text = code_block_pattern.replace_all(&text, "").to_string();
        Ok(text)
    }

    fn html_to_text(&self, html: &str) -> String {
        let mut text = html.to_string();
        let script_pattern = regex::Regex::new(r"(?s)<script[^>]*>.*?</script>").unwrap();
        text = script_pattern.replace_all(&text, "").to_string();
        let style_pattern = regex::Regex::new(r"(?s)<style[^>]*>.*?</style>").unwrap();
        text = style_pattern.replace_all(&text, "").to_string();
        text = text
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<br />", "\n")
            .replace("<p>", "")
            .replace("</p>", "\n\n")
            .replace("<h1>", "# ")
            .replace("</h1>", "\n")
            .replace("<h2>", "## ")
            .replace("</h2>", "\n")
            .replace("<h3>", "### ")
            .replace("</h3>", "\n")
            .replace("<li>", "- ")
            .replace("</li>", "\n")
            .replace("<ul>", "")
            .replace("</ul>", "\n")
            .replace("<ol>", "")
            .replace("</ol>", "\n");
        let tag_pattern = regex::Regex::new(r"<[^>]+>").unwrap();
        text = tag_pattern.replace_all(&text, "").to_string();
        text = text
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'");
        text
    }

    pub fn generate_filename(&self, document: &GeneratedDocument) -> String {
        let base_name = document
            .metadata
            .title
            .replace(" - ", "_")
            .replace(" ", "_")
            .replace("/", "_")
            .replace("\\", "_");

        format!(
            "{}_{}.docx",
            base_name,
            document.metadata.generated_at.format("%Y%m%d_%H%M%S")
        )
    }
}

impl Default for DOCXExporter {
    fn default() -> Self {
        Self::new()
    }
}
