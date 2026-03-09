// Quick test script for document generation
use unhireable_lib::generator::{
    CoverLetterGenerator, PDFExporter,
    ResumeGenerator, UserProfile,
};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🧪 Testing Document Generation");
    println!("==============================\n");

    // Create a sample user profile
    let profile = UserProfile {
        personal_info: unhireable_lib::generator::PersonalInfo {
            name: "John Doe".to_string(),
            email: "john.doe@example.com".to_string(),
            phone: Some("+1 (555) 123-4567".to_string()),
            location: Some("San Francisco, CA".to_string()),
            linkedin: Some("linkedin.com/in/johndoe".to_string()),
            github: Some("github.com/johndoe".to_string()),
            portfolio: Some("johndoe.dev".to_string()),
        },
        summary: "Experienced software engineer with 5+ years building scalable web applications. Passionate about clean code, user experience, and continuous learning.".to_string(),
        skills: unhireable_lib::generator::SkillsProfile {
            technical_skills: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
                "Python".to_string(),
                "PostgreSQL".to_string(),
            ],
            soft_skills: vec![
                "Leadership".to_string(),
                "Communication".to_string(),
                "Problem Solving".to_string(),
            ],
            experience_years: std::collections::HashMap::new(),
            proficiency_levels: std::collections::HashMap::new(),
        },
        experience: vec![
            unhireable_lib::generator::ExperienceEntry {
                company: "TechCorp".to_string(),
                position: "Senior Software Engineer".to_string(),
                duration: "2020 - Present".to_string(),
                description: vec![
                    "Led development of microservices architecture".to_string(),
                    "Improved application performance by 40%".to_string(),
                    "Mentored junior developers".to_string(),
                ],
                technologies: vec!["React".to_string(), "TypeScript".to_string(), "Node.js".to_string()],
            },
        ],
        education: vec![
            unhireable_lib::generator::EducationEntry {
                institution: "University of Technology".to_string(),
                degree: "BS in Computer Science".to_string(),
                year: "2018".to_string(),
                details: Some("Magna Cum Laude".to_string()),
            },
        ],
        projects: vec![
            "Built open-source React component library".to_string(),
            "Developed real-time chat application".to_string(),
        ],
    };

    // Create a sample job
    let job = unhireable_lib::db::models::Job {
        id: Some(1),
        title: "Senior Full Stack Developer".to_string(),
        company: "Innovation Labs".to_string(),
        url: "https://example.com/job/123".to_string(),
        description: Some("We're looking for an experienced full stack developer to join our team...".to_string()),
        requirements: Some("5+ years experience, React, TypeScript, Node.js".to_string()),
        location: Some("Remote".to_string()),
        salary: Some("$120k - $150k".to_string()),
        source: "demo".to_string(),
        status: unhireable_lib::db::models::JobStatus::Saved,
        match_score: Some(85.5),
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
        ..Default::default()
    };

    // Test template listing
    println!("1. Testing template listing...");
    let resume_gen = ResumeGenerator::new();
    let cover_gen = CoverLetterGenerator::new();
    
    let resume_templates = resume_gen.list_available_templates();
    let cover_templates = cover_gen.list_available_templates();
    
    println!("   ✅ Resume templates: {}", resume_templates.len());
    for tpl in &resume_templates {
        println!("      - {}", tpl);
    }
    
    println!("   ✅ Cover letter templates: {}", cover_templates.len());
    for tpl in &cover_templates {
        println!("      - {}", tpl);
    }

    // Test document generation
    println!("\n2. Testing document generation...");
    let rt = tokio::runtime::Runtime::new()?;
    
    // Generate resume with modern template
    let resume_doc = rt.block_on(
        resume_gen.generate_resume(&profile, &job, Some("resume_modern"), false)
    )?;
    println!("   ✅ Generated resume: {} words", resume_doc.metadata.word_count);
    println!("      Template: {}", resume_doc.metadata.template_used);
    
    // Generate cover letter
    let cover_doc = rt.block_on(
        cover_gen.generate_cover_letter(&profile, &job, Some("cover_letter_professional"), false)
    )?;
    println!("   ✅ Generated cover letter: {} words", cover_doc.metadata.word_count);
    println!("      Template: {}", cover_doc.metadata.template_used);

    // Test PDF export
    println!("\n3. Testing PDF export...");
    let pdf_exporter = PDFExporter::new();
    let test_dir = std::path::Path::new("/tmp/unhireable_test");
    std::fs::create_dir_all(test_dir)?;
    
    let resume_pdf = test_dir.join("test_resume.pdf");
    pdf_exporter.export_to_pdf(&resume_doc, &resume_pdf)?;
    println!("   ✅ PDF exported: {}", resume_pdf.display());
    
    if resume_pdf.exists() {
        let size = std::fs::metadata(&resume_pdf)?.len();
        println!("      Size: {} bytes", size);
    }

    // Test DOCX export
    println!("\n4. Testing DOCX export...");
    let docx_exporter = unhireable_lib::generator::DOCXExporter::new();
    let cover_docx = test_dir.join("test_cover_letter.docx");
    docx_exporter.export_to_docx(&cover_doc, &cover_docx)?;
    println!("   ✅ DOCX exported: {}", cover_docx.display());
    
    if cover_docx.exists() {
        let size = std::fs::metadata(&cover_docx)?.len();
        println!("      Size: {} bytes", size);
    }

    println!("\n✅ All tests passed!");
    println!("\nGenerated files:");
    println!("  - Resume PDF: {}", resume_pdf.display());
    println!("  - Cover Letter DOCX: {}", cover_docx.display());
    println!("\nYou can open these files to verify the professional design!");

    Ok(())
}

