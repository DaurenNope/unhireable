use tempfile::TempDir;
use unhireable_lib::generator::{
    CoverLetterGenerator, DOCXExporter, DocumentFormat, PDFExporter, ResumeGenerator, UserProfile,
};

#[tokio::test]
async fn test_resume_template_listing() {
    let generator = ResumeGenerator::new();
    let templates = generator.list_available_templates();

    assert!(
        templates.len() >= 5,
        "Expected at least 5 resume templates, got {}",
        templates.len()
    );
    assert!(templates.contains(&"resume_modern".to_string()));
    assert!(templates.contains(&"resume_classic".to_string()));
    assert!(templates.contains(&"resume_executive".to_string()));
    assert!(templates.contains(&"resume_technical".to_string()));
    assert!(templates.contains(&"resume_creative".to_string()));
}

#[tokio::test]
async fn test_cover_letter_template_listing() {
    let generator = CoverLetterGenerator::new();
    let templates = generator.list_available_templates();

    assert!(
        templates.len() >= 5,
        "Expected at least 5 cover letter templates, got {}",
        templates.len()
    );
    assert!(templates.contains(&"cover_letter_professional".to_string()));
    assert!(templates.contains(&"cover_letter_casual".to_string()));
    assert!(templates.contains(&"cover_letter_formal".to_string()));
    assert!(templates.contains(&"cover_letter_friendly".to_string()));
    assert!(templates.contains(&"cover_letter_concise".to_string()));
}

#[tokio::test]
async fn test_resume_generation() {
    let profile = create_sample_profile();
    let job = create_sample_job();
    let generator = ResumeGenerator::new();

    // Test each template
    let templates = vec![
        "resume_modern",
        "resume_classic",
        "resume_executive",
        "resume_technical",
        "resume_creative",
    ];

    for template_name in templates {
        let result = generator
            .generate_resume(&profile, &job, Some(template_name), false)
            .await;

        assert!(
            result.is_ok(),
            "Failed to generate resume with template: {}",
            template_name
        );
        let doc = result.unwrap();
        assert!(
            !doc.content.is_empty(),
            "Generated resume content is empty for template: {}",
            template_name
        );
        assert_eq!(doc.format, DocumentFormat::Markdown);
        assert!(doc.metadata.word_count > 0);
    }
}

#[tokio::test]
async fn test_cover_letter_generation() {
    let profile = create_sample_profile();
    let job = create_sample_job();
    let generator = CoverLetterGenerator::new();

    // Test each template
    let templates = vec![
        "cover_letter_professional",
        "cover_letter_casual",
        "cover_letter_formal",
        "cover_letter_friendly",
        "cover_letter_concise",
    ];

    for template_name in templates {
        let result = generator
            .generate_cover_letter(&profile, &job, Some(template_name), false)
            .await;

        assert!(
            result.is_ok(),
            "Failed to generate cover letter with template: {}",
            template_name
        );
        let doc = result.unwrap();
        assert!(
            !doc.content.is_empty(),
            "Generated cover letter content is empty for template: {}",
            template_name
        );
        assert_eq!(doc.format, DocumentFormat::Markdown);
        assert!(doc.metadata.word_count > 0);
    }
}

#[tokio::test]
async fn test_pdf_export() {
    let profile = create_sample_profile();
    let job = create_sample_job();
    let generator = ResumeGenerator::new();

    let doc = generator
        .generate_resume(&profile, &job, Some("resume_modern"), false)
        .await
        .unwrap();

    let temp_dir = TempDir::new().unwrap();
    let pdf_path = temp_dir.path().join("test_resume.pdf");

    let exporter = PDFExporter::new();
    let result = exporter.export_to_pdf(&doc, &pdf_path);

    assert!(result.is_ok(), "Failed to export PDF: {:?}", result.err());
    assert!(pdf_path.exists(), "PDF file was not created");

    let metadata = std::fs::metadata(&pdf_path).unwrap();
    assert!(metadata.len() > 0, "PDF file is empty");
    println!("✅ PDF exported successfully: {} bytes", metadata.len());
}

#[tokio::test]
async fn test_docx_export() {
    let profile = create_sample_profile();
    let job = create_sample_job();
    let generator = CoverLetterGenerator::new();

    let doc = generator
        .generate_cover_letter(&profile, &job, Some("cover_letter_professional"), false)
        .await
        .unwrap();

    let temp_dir = TempDir::new().unwrap();
    let docx_path = temp_dir.path().join("test_cover_letter.docx");

    let exporter = DOCXExporter::new();
    let result = exporter.export_to_docx(&doc, &docx_path);

    assert!(result.is_ok(), "Failed to export DOCX: {:?}", result.err());
    assert!(docx_path.exists(), "DOCX file was not created");

    let metadata = std::fs::metadata(&docx_path).unwrap();
    assert!(metadata.len() > 0, "DOCX file is empty");
    println!("✅ DOCX exported successfully: {} bytes", metadata.len());
}

fn create_sample_profile() -> UserProfile {
    UserProfile {
        personal_info: unhireable_lib::generator::PersonalInfo {
            name: "Jane Smith".to_string(),
            email: "jane.smith@example.com".to_string(),
            phone: Some("+1 (555) 987-6543".to_string()),
            location: Some("New York, NY".to_string()),
            linkedin: Some("linkedin.com/in/janesmith".to_string()),
            github: Some("github.com/janesmith".to_string()),
            portfolio: Some("janesmith.dev".to_string()),
        },
        summary: "Experienced software engineer specializing in full-stack development with a passion for building scalable applications.".to_string(),
        skills: unhireable_lib::generator::SkillsProfile {
            technical_skills: vec![
                "React".to_string(),
                "TypeScript".to_string(),
                "Node.js".to_string(),
                "Python".to_string(),
                "PostgreSQL".to_string(),
                "AWS".to_string(),
            ],
            soft_skills: vec![
                "Team Leadership".to_string(),
                "Communication".to_string(),
                "Problem Solving".to_string(),
            ],
            experience_years: std::collections::HashMap::new(),
            proficiency_levels: std::collections::HashMap::new(),
        },
        experience: vec![
            unhireable_lib::generator::ExperienceEntry {
                company: "TechStart Inc".to_string(),
                position: "Senior Software Engineer".to_string(),
                duration: "2021 - Present".to_string(),
                description: vec![
                    "Developed and maintained React-based frontend applications".to_string(),
                    "Built RESTful APIs using Node.js and Express".to_string(),
                    "Collaborated with cross-functional teams to deliver features".to_string(),
                ],
                technologies: vec!["React".to_string(), "TypeScript".to_string(), "Node.js".to_string()],
            },
            unhireable_lib::generator::ExperienceEntry {
                company: "WebDev Solutions".to_string(),
                position: "Software Engineer".to_string(),
                duration: "2019 - 2021".to_string(),
                description: vec![
                    "Built responsive web applications using React".to_string(),
                    "Optimized database queries improving performance by 30%".to_string(),
                ],
                technologies: vec!["React".to_string(), "JavaScript".to_string(), "PostgreSQL".to_string()],
            },
        ],
        education: vec![
            unhireable_lib::generator::EducationEntry {
                institution: "State University".to_string(),
                degree: "BS in Computer Science".to_string(),
                year: "2019".to_string(),
                details: Some("Dean's List, GPA: 3.8".to_string()),
            },
        ],
        projects: vec![
            "Open-source React component library with 1k+ stars".to_string(),
            "Real-time collaboration tool using WebSockets".to_string(),
        ],
    }
}

fn create_sample_job() -> unhireable_lib::db::models::Job {
    unhireable_lib::db::models::Job {
        id: Some(1),
        title: "Senior Full Stack Developer".to_string(),
        company: "Innovation Labs".to_string(),
        url: "https://example.com/job/123".to_string(),
        description: Some(
            "We're looking for an experienced full stack developer to join our growing team. \
            You'll work on building scalable web applications using modern technologies. \
            Responsibilities include designing and implementing new features, optimizing performance, \
            and collaborating with cross-functional teams."
                .to_string(),
        ),
        requirements: Some(
            "5+ years of experience with React and Node.js, strong TypeScript skills, \
            experience with databases, excellent communication skills."
                .to_string(),
        ),
        location: Some("Remote".to_string()),
        salary: Some("$120,000 - $150,000".to_string()),
        source: "demo".to_string(),
        status: unhireable_lib::db::models::JobStatus::Saved,
        match_score: Some(87.5),
        created_at: Some(chrono::Utc::now()),
        updated_at: Some(chrono::Utc::now()),
        ..Default::default()
    }
}
