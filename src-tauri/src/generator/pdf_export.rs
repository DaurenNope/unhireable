use crate::generator::{GeneratedDocument, DocumentFormat};
use anyhow::Result;
use std::fs;
use std::path::Path;

pub struct PDFExporter;

impl PDFExporter {
    pub fn new() -> Self {
        Self
    }

    pub fn export_to_pdf(&self, document: &GeneratedDocument, output_path: &Path) -> Result<()> {
        match document.format {
            DocumentFormat::Markdown => self.export_markdown_to_pdf(&document.content, output_path),
            DocumentFormat::HTML => self.export_html_to_pdf(&document.content, output_path),
            DocumentFormat::Text => self.export_text_to_pdf(&document.content, output_path),
            DocumentFormat::PDF => {
                // Already PDF, just copy
                fs::write(output_path, &document.content)?;
                Ok(())
            }
        }
    }

    pub fn export_markdown_to_pdf(&self, markdown: &str, output_path: &Path) -> Result<()> {
        // Convert Markdown to HTML first
        let html = self.markdown_to_html(markdown)?;
        self.export_html_to_pdf(&html, output_path)
    }

    pub fn export_html_to_pdf(&self, html: &str, output_path: &Path) -> Result<()> {
        // Create a complete HTML document
        let full_html = self.wrap_html_template(html);
        
        // For now, we'll save as HTML file with .pdf extension
        // In a real implementation, you would use a PDF library
        fs::write(output_path, full_html)?;
        
        println!("PDF exported to: {}", output_path.display());
        println!("Note: This is currently saved as HTML. For true PDF generation, add a PDF library.");
        
        Ok(())
    }

    pub fn export_text_to_pdf(&self, text: &str, output_path: &Path) -> Result<()> {
        // Convert plain text to HTML
        let html = format!("<pre>{}</pre>", text);
        self.export_html_to_pdf(&html, output_path)
    }

    fn markdown_to_html(&self, markdown: &str) -> Result<String> {
        let mut html = String::new();
        let lines: Vec<&str> = markdown.lines().collect();
        let mut in_code_block = false;
        let mut list_items = Vec::new();

        for line in lines {
            let trimmed = line.trim();
            
            // Handle code blocks
            if trimmed.starts_with("```") {
                if in_code_block {
                    // Close code block
                    html.push_str("</code></pre>\n");
                    in_code_block = false;
                } else {
                    // Start code block
                    html.push_str("<pre><code>");
                    in_code_block = true;
                }
                continue;
            }

            if in_code_block {
                html.push_str(&format!("{}\n", line));
                continue;
            }

            // Handle headers
            if trimmed.starts_with("# ") {
                // Process any pending list items
                if !list_items.is_empty() {
                    html.push_str("<ul>");
                    for item in &list_items {
                        html.push_str(&format!("<li>{}</li>", item));
                    }
                    html.push_str("</ul>\n");
                    list_items.clear();
                }
                
                let title = &trimmed[2..];
                html.push_str(&format!("<h1>{}</h1>\n", title));
            } else if trimmed.starts_with("## ") {
                // Process any pending list items
                if !list_items.is_empty() {
                    html.push_str("<ul>");
                    for item in &list_items {
                        html.push_str(&format!("<li>{}</li>", item));
                    }
                    html.push_str("</ul>\n");
                    list_items.clear();
                }
                
                let title = &trimmed[3..];
                html.push_str(&format!("<h2>{}</h2>\n", title));
            } else if trimmed.starts_with("### ") {
                // Process any pending list items
                if !list_items.is_empty() {
                    html.push_str("<ul>");
                    for item in &list_items {
                        html.push_str(&format!("<li>{}</li>", item));
                    }
                    html.push_str("</ul>\n");
                    list_items.clear();
                }
                
                let title = &trimmed[4..];
                html.push_str(&format!("<h3>{}</h3>\n", title));
            } else if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                // List item
                let item = &trimmed[2..];
                list_items.push(item.to_string());
            } else if trimmed.is_empty() {
                // Process any pending list items
                if !list_items.is_empty() {
                    html.push_str("<ul>");
                    for item in &list_items {
                        html.push_str(&format!("<li>{}</li>", item));
                    }
                    html.push_str("</ul>\n");
                    list_items.clear();
                }
                html.push_str("<br>\n");
            } else if trimmed.starts_with("---") || trimmed.starts_with("===") {
                // Horizontal rule
                html.push_str("<hr>\n");
            } else if !trimmed.is_empty() {
                // Process any pending list items
                if !list_items.is_empty() {
                    html.push_str("<ul>");
                    for item in &list_items {
                        html.push_str(&format!("<li>{}</li>", item));
                    }
                    html.push_str("</ul>\n");
                    list_items.clear();
                }
                
                // Regular paragraph
                html.push_str(&format!("<p>{}</p>\n", trimmed));
            }
        }

        // Process any remaining list items
        if !list_items.is_empty() {
            html.push_str("<ul>");
            for item in &list_items {
                html.push_str(&format!("<li>{}</li>", item));
            }
            html.push_str("</ul>\n");
        }

        Ok(html)
    }

    fn wrap_html_template(&self, html_content: &str) -> String {
        format!(r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Resume/Cover Letter</title>
    <style>
        body {{
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
        }}
        
        h1 {{
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        
        h2 {{
            font-size: 20px;
            font-weight: bold;
            margin-top: 30px;
            margin-bottom: 15px;
            color: #34495e;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        h3 {{
            font-size: 16px;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #34495e;
        }}
        
        p {{
            margin-bottom: 15px;
            text-align: justify;
        }}
        
        ul {{
            margin-bottom: 15px;
            padding-left: 20px;
        }}
        
        li {{
            margin-bottom: 8px;
            line-height: 1.4;
        }}
        
        hr {{
            border: none;
            border-top: 1px solid #bdc3c7;
            margin: 30px 0;
        }}
        
        pre {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        
        code {{
            background: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }}
        
        pre code {{
            background: none;
            padding: 0;
        }}
        
        .contact-info {{
            margin-bottom: 30px;
            font-size: 14px;
            color: #7f8c8d;
        }}
        
        .section {{
            margin-bottom: 25px;
        }}
        
        @media print {{
            body {{
                padding: 20px;
                font-size: 12px;
            }}
            
            h1 {{ font-size: 24px; }}
            h2 {{ font-size: 18px; }}
            h3 {{ font-size: 14px; }}
        }}
    </style>
</head>
<body>
    {}
</body>
</html>
        "#, html_content)
    }

    pub fn generate_filename(&self, document: &GeneratedDocument) -> String {
        let base_name = document.metadata.title
            .replace(" - ", "_")
            .replace(" ", "_")
            .replace("/", "_")
            .replace("\\", "_");
        
        format!("{}_{}.pdf", 
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
    use crate::generator::{DocumentMetadata, DocumentFormat};
    use chrono::Utc;

    #[test]
    fn test_markdown_to_html() {
        let exporter = PDFExporter::new();
        let markdown = "# John Doe\n\n## Skills\n\n- React\n- TypeScript\n\nThis is a test.";
        
        let html = exporter.markdown_to_html(markdown).unwrap();
        assert!(html.contains("<h1>John Doe</h1>"));
        assert!(html.contains("<h2>Skills</h2>"));
        assert!(html.contains("<li>React</li>"));
        assert!(html.contains("<li>TypeScript</li>"));
        assert!(html.contains("<p>This is a test.</p>"));
    }

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
