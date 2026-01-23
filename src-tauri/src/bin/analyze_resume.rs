use anyhow::Context;
use unhireable_lib::resume_analyzer::{analyzer::ResumeAnalyzer, parser::ResumeParser};
use std::env;

fn main() -> anyhow::Result<()> {
    let pdf_path = env::args()
        .nth(1)
        .expect("Usage: cargo run --bin analyze_resume -- <PDF_PATH>");

    println!("Analyzing resume: {}", pdf_path);

    let text = ResumeParser::extract_text_from_pdf(&pdf_path)
        .with_context(|| format!("Failed to extract text from {}", pdf_path))?;
    println!(
        "Extracted {} characters of text (first 200 chars shown):",
        text.len()
    );
    println!("{}", &text.chars().take(200).collect::<String>());

    let parsed = ResumeParser::parse_resume_text(&text)?;
    println!(
        "Parsed sections — skills: {}, experience entries: {}, education entries: {}",
        parsed.skills.len(),
        parsed.experience.len(),
        parsed.education.len()
    );

    let analysis = ResumeAnalyzer::analyze(parsed, None);
    println!("ATS Score: {:?}", analysis.insights.ats_score);
    println!("Primary skills: {:?}", analysis.insights.primary_skills);
    println!("Strengths: {:?}", analysis.insights.strengths);
    println!("Recommendations: {:?}", analysis.insights.recommendations);

    Ok(())
}
