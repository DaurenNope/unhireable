use crate::generator::{DocumentFormat, GeneratedDocument};
use anyhow::Result;
use printpdf::*;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

pub struct PDFExporter;

// Professional color scheme (RGB values 0.0-1.0)
const PRIMARY_COLOR: (f32, f32, f32) = (0.024, 0.714, 0.831); // Cyan #06b6d4
const SECONDARY_COLOR: (f32, f32, f32) = (0.659, 0.329, 0.969); // Purple #a855f7
const TEXT_COLOR: (f32, f32, f32) = (0.13, 0.13, 0.13); // Dark gray

#[derive(Debug, Clone)]
enum DocumentSection {
    Title(String),
    Heading(String),
    Subheading(String),
    Paragraph(String),
    ListItem(String),
    Separator,
}

impl PDFExporter {
    pub fn new() -> Self {
        Self
    }

    pub fn export_to_pdf(&self, document: &GeneratedDocument, output_path: &Path) -> Result<()> {
        match document.format {
            DocumentFormat::Markdown => {
                let text = self.markdown_to_text(&document.content)?;
                self.export_text_to_pdf(&text, output_path)
            }
            DocumentFormat::HTML => {
                let text = self.html_to_text(&document.content);
                self.export_text_to_pdf(&text, output_path)
            }
            DocumentFormat::Text => self.export_text_to_pdf(&document.content, output_path),
            DocumentFormat::PDF => {
                std::fs::write(output_path, &document.content)?;
                Ok(())
            }
        }
    }

    pub fn export_text_to_pdf(&self, text: &str, output_path: &Path) -> Result<()> {
        let (doc, page1, layer1) =
            PdfDocument::new("Generated Document", Mm(210.0), Mm(297.0), "Layer 1");
        let current_layer = doc.get_page(page1).get_layer(layer1);

        // Set up fonts
        let font = doc.add_builtin_font(BuiltinFont::Helvetica)?;
        let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold)?;

        // Professional typography
        let title_font_size = 24.0;
        let heading_font_size = 14.0;
        let subheading_font_size = 12.0;
        let body_font_size = 10.0;
        let line_height_mm = 4.2;
        let margin = Mm(15.0);
        let page_width = Mm(210.0) - (margin * 2.0);
        let mut y_position = Mm(282.0);

        let sections = self.parse_document_structure(text);

        for section in sections {
            if y_position < Mm(30.0) {
                break;
            }

            match section {
                DocumentSection::Title(text) => {
                    // Large, bold, colored title
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(
                        PRIMARY_COLOR.0,
                        PRIMARY_COLOR.1,
                        PRIMARY_COLOR.2,
                        None,
                    )));
                    current_layer.use_text(text, title_font_size, margin, y_position, &font_bold);
                    y_position = y_position - Mm(8.0);
                }
                DocumentSection::Heading(text) => {
                    y_position = y_position - Mm(4.0);
                    // Colored, uppercase heading
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(
                        PRIMARY_COLOR.0,
                        PRIMARY_COLOR.1,
                        PRIMARY_COLOR.2,
                        None,
                    )));
                    current_layer.use_text(
                        text.to_uppercase(),
                        heading_font_size,
                        margin,
                        y_position,
                        &font_bold,
                    );
                    y_position = y_position - Mm(line_height_mm + 2.0);
                }
                DocumentSection::Subheading(text) => {
                    y_position = y_position - Mm(2.0);
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(
                        TEXT_COLOR.0,
                        TEXT_COLOR.1,
                        TEXT_COLOR.2,
                        None,
                    )));
                    current_layer.use_text(
                        text,
                        subheading_font_size,
                        margin,
                        y_position,
                        &font_bold,
                    );
                    y_position = y_position - Mm(line_height_mm + 1.0);
                }
                DocumentSection::Paragraph(text) => {
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(
                        TEXT_COLOR.0,
                        TEXT_COLOR.1,
                        TEXT_COLOR.2,
                        None,
                    )));
                    let lines = self.wrap_text(&text, page_width, body_font_size as f64);
                    for line in lines {
                        if y_position < Mm(30.0) {
                            break;
                        }
                        current_layer.use_text(line, body_font_size, margin, y_position, &font);
                        y_position = y_position - Mm(line_height_mm);
                    }
                    y_position = y_position - Mm(2.0);
                }
                DocumentSection::ListItem(text) => {
                    // Colored bullet
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(
                        SECONDARY_COLOR.0,
                        SECONDARY_COLOR.1,
                        SECONDARY_COLOR.2,
                        None,
                    )));
                    current_layer.use_text(
                        "•",
                        body_font_size + 2.0,
                        margin,
                        y_position,
                        &font_bold,
                    );
                    // Item text in dark color
                    current_layer.set_fill_color(Color::Rgb(Rgb::new(
                        TEXT_COLOR.0,
                        TEXT_COLOR.1,
                        TEXT_COLOR.2,
                        None,
                    )));
                    let lines = self.wrap_text(&text, page_width - Mm(8.0), body_font_size as f64);
                    for (i, line) in lines.iter().enumerate() {
                        if y_position < Mm(30.0) {
                            break;
                        }
                        let x_offset = if i == 0 { Mm(5.0) } else { Mm(8.0) };
                        current_layer.use_text(
                            line,
                            body_font_size,
                            margin + x_offset,
                            y_position,
                            &font,
                        );
                        y_position = y_position - Mm(line_height_mm);
                    }
                    y_position = y_position - Mm(1.0);
                }
                DocumentSection::Separator => {
                    y_position = y_position - Mm(3.0);
                }
            }
        }

        doc.save(&mut BufWriter::new(File::create(output_path)?))?;
        println!(
            "✅ Professional PDF exported successfully to: {}",
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
        text = code_block_pattern
            .replace_all(&text, |caps: &regex::Captures| {
                let code = &caps[0];
                let content = code.trim_start_matches("```").trim_end_matches("```");
                format!("\n{}\n", content.trim())
            })
            .to_string();
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
        let lines: Vec<&str> = text.lines().map(|l| l.trim()).collect();
        lines.join("\n")
    }

    fn wrap_text(&self, text: &str, max_width: Mm, font_size: f64) -> Vec<String> {
        let max_width_pt: f32 = max_width.into_pt().0;
        let chars_per_line = (max_width_pt / (font_size as f32 * 0.6)) as usize;
        let words: Vec<&str> = text.split_whitespace().collect();
        let mut lines = Vec::new();
        let mut current_line = String::new();

        for word in words {
            if current_line.len() + word.len() + 1 > chars_per_line && !current_line.is_empty() {
                lines.push(current_line.clone());
                current_line = word.to_string();
            } else {
                if !current_line.is_empty() {
                    current_line.push(' ');
                }
                current_line.push_str(word);
            }
        }

        if !current_line.is_empty() {
            lines.push(current_line);
        }

        lines
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
            "{}_{}.pdf",
            base_name,
            document.metadata.generated_at.format("%Y%m%d_%H%M%S")
        )
    }
}

impl Default for PDFExporter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::generator::{DocumentFormat, DocumentMetadata};
    use chrono::Utc;

    #[test]
    fn test_filename_generation() {
        let exporter = PDFExporter::new();
        let document = GeneratedDocument {
            content: "Test content".to_string(),
            format: DocumentFormat::Markdown,
            metadata: DocumentMetadata {
                title: "Resume - John Doe for Senior Developer".to_string(),
                job_title: "Senior Developer".to_string(),
                company: "TechCorp".to_string(),
                generated_at: Utc::now(),
                template_used: "modern".to_string(),
                word_count: 100,
            },
        };

        let filename = exporter.generate_filename(&document);
        assert!(filename.contains("Resume_John_Doe_for_Senior_Developer"));
        assert!(filename.ends_with(".pdf"));
    }
}
