use crate::db::models::{Activity, Application, ApplicationStatus, Contact, Credential, Document, DocumentType, Interview, Job, JobStatus};
use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use std::sync::MutexGuard;

pub trait JobQueries {
    fn create_job(&self, job: &mut Job) -> Result<()>;
    fn get_job(&self, id: i64) -> Result<Option<Job>>;
    fn get_job_by_url(&self, url: &str) -> Result<Option<Job>>;
    fn update_job(&self, job: &Job) -> Result<()>;
    fn list_jobs(&self, status: Option<JobStatus>) -> Result<Vec<Job>>;
    fn delete_job(&self, id: i64) -> Result<()>;
}

pub trait ApplicationQueries {
    fn create_application(&self, application: &mut Application) -> Result<()>;
    fn get_application(&self, id: i64) -> Result<Option<Application>>;
    fn update_application(&self, application: &Application) -> Result<()>;
    fn list_applications(&self, job_id: Option<i64>, status: Option<ApplicationStatus>) -> Result<Vec<Application>>;
    fn delete_application(&self, id: i64) -> Result<()>;
}

pub trait ContactQueries {
    fn create_contact(&self, contact: &mut Contact) -> Result<()>;
    fn get_contact(&self, id: i64) -> Result<Option<Contact>>;
    fn update_contact(&self, contact: &Contact) -> Result<()>;
    fn list_contacts(&self, job_id: Option<i64>) -> Result<Vec<Contact>>;
    fn delete_contact(&self, id: i64) -> Result<()>;
}

pub trait InterviewQueries {
    fn create_interview(&self, interview: &mut Interview) -> Result<()>;
    fn get_interview(&self, id: i64) -> Result<Option<Interview>>;
    fn update_interview(&self, interview: &Interview) -> Result<()>;
    fn list_interviews(&self, application_id: Option<i64>) -> Result<Vec<Interview>>;
    fn delete_interview(&self, id: i64) -> Result<()>;
}

pub trait DocumentQueries {
    fn create_document(&self, document: &mut Document) -> Result<()>;
    fn get_document(&self, id: i64) -> Result<Option<Document>>;
    fn update_document(&self, document: &Document) -> Result<()>;
    fn list_documents(&self, application_id: Option<i64>, document_type: Option<DocumentType>) -> Result<Vec<Document>>;
    fn delete_document(&self, id: i64) -> Result<()>;
}

pub trait ActivityQueries {
    fn create_activity(&self, activity: &mut Activity) -> Result<()>;
    fn list_activities(&self, entity_type: Option<&str>, limit: Option<usize>) -> Result<Vec<Activity>>;
    fn get_activities_for_entity(&self, entity_type: &str, entity_id: i64) -> Result<Vec<Activity>>;
}

pub trait CredentialQueries {
    fn create_credential(&self, credential: &mut Credential) -> Result<()>;
    fn get_credential(&self, platform: &str) -> Result<Option<Credential>>;
    fn update_credential(&self, credential: &Credential) -> Result<()>;
    fn list_credentials(&self, active_only: bool) -> Result<Vec<Credential>>;
    fn delete_credential(&self, platform: &str) -> Result<()>;
}

impl JobQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_job(&self, job: &mut Job) -> Result<()> {
        let now = Utc::now();
        
        let id = self.query_row(
            r#"
            INSERT INTO jobs (
                title, company, url, description, requirements, 
                location, salary, source, status, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            RETURNING id
            "#,
            params![
                &job.title,
                &job.company,
                &job.url,
                &job.description,
                &job.requirements,
                &job.location,
                &job.salary,
                &job.source,
                job.status.to_string(),
                now,
                now,
            ],
            |row| row.get::<_, i64>(0),
        )?;
        
        job.id = Some(id);
        job.created_at = Some(now);
        job.updated_at = Some(now);
        
        Ok(())
    }

    fn get_job(&self, id: i64) -> Result<Option<Job>> {
        self.query_row(
            "SELECT * FROM jobs WHERE id = ?1",
            [id],
            |row| {
                let status_str: String = row.get(9)?;
                let status = status_str.parse().unwrap_or(JobStatus::Saved);
                
                Ok(Job {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    company: row.get(2)?,
                    url: row.get(3)?,
                    description: row.get(4)?,
                    requirements: row.get(5)?,
                    location: row.get(6)?,
                    salary: row.get(7)?,
                    source: row.get(8)?,
                    status,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn get_job_by_url(&self, url: &str) -> Result<Option<Job>> {
        self.query_row(
            "SELECT * FROM jobs WHERE url = ?1",
            [url],
            |row| {
                let status_str: String = row.get(9)?;
                let status = status_str.parse().unwrap_or(JobStatus::Saved);
                
                Ok(Job {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    company: row.get(2)?,
                    url: row.get(3)?,
                    description: row.get(4)?,
                    requirements: row.get(5)?,
                    location: row.get(6)?,
                    salary: row.get(7)?,
                    source: row.get(8)?,
                    status,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn update_job(&self, job: &Job) -> Result<()> {
        let now = Utc::now();
        
        self.execute(
            r#"
            UPDATE jobs SET
                title = ?2,
                company = ?3,
                url = ?4,
                description = ?5,
                requirements = ?6,
                location = ?7,
                salary = ?8,
                source = ?9,
                status = ?10,
                updated_at = ?11
            WHERE id = ?1
            "#,
            params![
                job.id,
                job.title,
                job.company,
                job.url,
                job.description,
                job.requirements,
                job.location,
                job.salary,
                job.source,
                job.status.to_string(),
                now,
            ],
        )?;
        
        Ok(())
    }

    fn list_jobs(&self, status: Option<JobStatus>) -> Result<Vec<Job>> {
        let mut query = "SELECT * FROM jobs".to_string();
        let mut params = Vec::new();
        
        if let Some(status) = status {
            query.push_str(" WHERE status = ?1");
            params.push(status.to_string());
        }
        
        query.push_str(" ORDER BY created_at DESC");
        
        let mut stmt = self.prepare(&query)?;
        let jobs = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                let status_str: String = row.get(9)?;
                let status = status_str.parse().unwrap_or(JobStatus::Saved);
                
                Ok(Job {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    company: row.get(2)?,
                    url: row.get(3)?,
                    description: row.get(4)?,
                    requirements: row.get(5)?,
                    location: row.get(6)?,
                    salary: row.get(7)?,
                    source: row.get(8)?,
                    status,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
            
        Ok(jobs)
    }

    fn delete_job(&self, id: i64) -> Result<()> {
        self.execute("DELETE FROM jobs WHERE id = ?1", [id])?;
        Ok(())
    }
}

impl ApplicationQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_application(&self, application: &mut Application) -> Result<()> {
        let now = Utc::now();
        
        let id = self.query_row(
            r#"
            INSERT INTO applications (
                job_id, applied_at, status, notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            RETURNING id
            "#,
            params![
                application.job_id,
                application.applied_at,
                application.status.to_string(),
                application.notes,
                now,
                now,
            ],
            |row| row.get::<_, i64>(0),
        )?;
        
        application.id = Some(id);
        application.created_at = Some(now);
        application.updated_at = Some(now);
        
        Ok(())
    }

    fn get_application(&self, id: i64) -> Result<Option<Application>> {
        self.query_row(
            "SELECT * FROM applications WHERE id = ?1",
            [id],
            |row| {
                let status_str: String = row.get(3)?;
                let status = status_str.parse().unwrap_or(ApplicationStatus::Preparing);
                
                Ok(Application {
                    id: row.get(0)?,
                    job_id: row.get(1)?,
                    applied_at: row.get(2)?,
                    status,
                    notes: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn update_application(&self, application: &Application) -> Result<()> {
        let now = Utc::now();
        
        self.execute(
            r#"
            UPDATE applications SET
                job_id = ?2,
                applied_at = ?3,
                status = ?4,
                notes = ?5,
                updated_at = ?6
            WHERE id = ?1
            "#,
            params![
                application.id,
                application.job_id,
                application.applied_at,
                application.status.to_string(),
                application.notes,
                now,
            ],
        )?;
        
        Ok(())
    }

    fn list_applications(
        &self,
        job_id: Option<i64>,
        status: Option<ApplicationStatus>,
    ) -> Result<Vec<Application>> {
        let applications = match (job_id, status) {
            (Some(job_id), Some(status)) => {
                self.prepare(
                    "SELECT id, job_id, applied_at, status, notes, created_at, updated_at FROM applications WHERE job_id = ?1 AND status = ?2 ORDER BY created_at DESC"
                )?
                .query_map(params![job_id, status.to_string()], |row| {
                    let status_str: String = row.get(3)?;
                    let status = status_str.parse().unwrap_or(ApplicationStatus::Preparing);
                    
                    Ok(Application {
                        id: row.get(0)?,
                        job_id: row.get(1)?,
                        applied_at: row.get(2)?,
                        status,
                        notes: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?
            }
            (Some(job_id), None) => {
                self.prepare(
                    "SELECT id, job_id, applied_at, status, notes, created_at, updated_at FROM applications WHERE job_id = ?1 ORDER BY created_at DESC"
                )?
                .query_map(params![job_id], |row| {
                    let status_str: String = row.get(3)?;
                    let status = status_str.parse().unwrap_or(ApplicationStatus::Preparing);
                    
                    Ok(Application {
                        id: row.get(0)?,
                        job_id: row.get(1)?,
                        applied_at: row.get(2)?,
                        status,
                        notes: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?
            }
            (None, Some(status)) => {
                self.prepare(
                    "SELECT id, job_id, applied_at, status, notes, created_at, updated_at FROM applications WHERE status = ?1 ORDER BY created_at DESC"
                )?
                .query_map(params![status.to_string()], |row| {
                    let status_str: String = row.get(3)?;
                    let status = status_str.parse().unwrap_or(ApplicationStatus::Preparing);
                    
                    Ok(Application {
                        id: row.get(0)?,
                        job_id: row.get(1)?,
                        applied_at: row.get(2)?,
                        status,
                        notes: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?
            }
            (None, None) => {
                self.prepare(
                    "SELECT id, job_id, applied_at, status, notes, created_at, updated_at FROM applications ORDER BY created_at DESC"
                )?
                .query_map([], |row| {
                    let status_str: String = row.get(3)?;
                    let status = status_str.parse().unwrap_or(ApplicationStatus::Preparing);
                    
                    Ok(Application {
                        id: row.get(0)?,
                        job_id: row.get(1)?,
                        applied_at: row.get(2)?,
                        status,
                        notes: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?
            }
        };
            
        Ok(applications)
    }

    fn delete_application(&self, id: i64) -> Result<()> {
        self.execute("DELETE FROM applications WHERE id = ?1", [id])?;
        Ok(())
    }
}

impl ContactQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_contact(&self, contact: &mut Contact) -> Result<()> {
        let now = Utc::now();
        
        let id = self.query_row(
            r#"
            INSERT INTO contacts (
                job_id, name, email, phone, position, notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            RETURNING id
            "#,
            params![
                contact.job_id,
                contact.name,
                contact.email,
                contact.phone,
                contact.position,
                contact.notes,
                now,
                now,
            ],
            |row| row.get::<_, i64>(0),
        )?;
        
        contact.id = Some(id);
        contact.created_at = Some(now);
        contact.updated_at = Some(now);
        
        Ok(())
    }

    fn get_contact(&self, id: i64) -> Result<Option<Contact>> {
        self.query_row(
            "SELECT * FROM contacts WHERE id = ?1",
            [id],
            |row| {
                Ok(Contact {
                    id: row.get(0)?,
                    job_id: row.get(1)?,
                    name: row.get(2)?,
                    email: row.get(3)?,
                    phone: row.get(4)?,
                    position: row.get(5)?,
                    notes: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn update_contact(&self, contact: &Contact) -> Result<()> {
        let now = Utc::now();
        
        self.execute(
            r#"
            UPDATE contacts SET
                job_id = ?2,
                name = ?3,
                email = ?4,
                phone = ?5,
                position = ?6,
                notes = ?7,
                updated_at = ?8
            WHERE id = ?1
            "#,
            params![
                contact.id,
                contact.job_id,
                contact.name,
                contact.email,
                contact.phone,
                contact.position,
                contact.notes,
                now,
            ],
        )?;
        
        Ok(())
    }

    fn list_contacts(&self, job_id: Option<i64>) -> Result<Vec<Contact>> {
        let mut query = "SELECT * FROM contacts".to_string();
        let mut params = Vec::new();
        
        if let Some(job_id) = job_id {
            query.push_str(" WHERE job_id = ?1");
            params.push(job_id.to_string());
        }
        
        query.push_str(" ORDER BY created_at DESC");
        
        let mut stmt = self.prepare(&query)?;
        let contacts = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                Ok(Contact {
                    id: row.get(0)?,
                    job_id: row.get(1)?,
                    name: row.get(2)?,
                    email: row.get(3)?,
                    phone: row.get(4)?,
                    position: row.get(5)?,
                    notes: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
            
        Ok(contacts)
    }

    fn delete_contact(&self, id: i64) -> Result<()> {
        self.execute("DELETE FROM contacts WHERE id = ?1", [id])?;
        Ok(())
    }
}

impl InterviewQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_interview(&self, interview: &mut Interview) -> Result<()> {
        let now = Utc::now();
        
        let id = self.query_row(
            r#"
            INSERT INTO interviews (
                application_id, type, scheduled_at, location, notes, completed, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            RETURNING id
            "#,
            params![
                interview.application_id,
                interview.r#type,
                interview.scheduled_at,
                interview.location,
                interview.completed,
                interview.notes,
                now,
                now,
            ],
            |row| row.get::<_, i64>(0),
        )?;
        
        interview.id = Some(id);
        interview.created_at = Some(now);
        interview.updated_at = Some(now);
        
        Ok(())
    }

    fn get_interview(&self, id: i64) -> Result<Option<Interview>> {
        self.query_row(
            "SELECT * FROM interviews WHERE id = ?1",
            [id],
            |row| {
                Ok(Interview {
                    id: row.get(0)?,
                    application_id: row.get(1)?,
                    r#type: row.get(2)?,
                    scheduled_at: row.get(3)?,
                    location: row.get(4)?,
                    notes: row.get(5)?,
                    completed: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn update_interview(&self, interview: &Interview) -> Result<()> {
        let now = Utc::now();
        
        self.execute(
            r#"
            UPDATE interviews SET
                application_id = ?2,
                type = ?3,
                scheduled_at = ?4,
                location = ?5,
                notes = ?6,
                completed = ?7,
                updated_at = ?8
            WHERE id = ?1
            "#,
            params![
                interview.id,
                interview.application_id,
                interview.r#type,
                interview.scheduled_at,
                interview.location,
                interview.notes,
                interview.completed,
                now,
            ],
        )?;
        
        Ok(())
    }

    fn list_interviews(&self, application_id: Option<i64>) -> Result<Vec<Interview>> {
        let mut query = "SELECT * FROM interviews".to_string();
        let mut params = Vec::new();
        
        if let Some(application_id) = application_id {
            query.push_str(" WHERE application_id = ?1");
            params.push(application_id.to_string());
        }
        
        query.push_str(" ORDER BY scheduled_at ASC");
        
        let mut stmt = self.prepare(&query)?;
        let interviews = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                Ok(Interview {
                    id: row.get(0)?,
                    application_id: row.get(1)?,
                    r#type: row.get(2)?,
                    scheduled_at: row.get(3)?,
                    location: row.get(4)?,
                    notes: row.get(5)?,
                    completed: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
            
        Ok(interviews)
    }

    fn delete_interview(&self, id: i64) -> Result<()> {
        self.execute("DELETE FROM interviews WHERE id = ?1", [id])?;
        Ok(())
    }
}

impl DocumentQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_document(&self, document: &mut Document) -> Result<()> {
        let now = Utc::now();
        
        let id = self.query_row(
            r#"
            INSERT INTO documents (
                application_id, name, file_path, document_type, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            RETURNING id
            "#,
            params![
                document.application_id,
                document.name,
                document.file_path.to_string_lossy(),
                document.document_type.to_string(),
                now,
                now,
            ],
            |row| row.get::<_, i64>(0),
        )?;
        
        document.id = Some(id);
        document.created_at = Some(now);
        document.updated_at = Some(now);
        
        Ok(())
    }

    fn get_document(&self, id: i64) -> Result<Option<Document>> {
        self.query_row(
            "SELECT * FROM documents WHERE id = ?1",
            [id],
            |row| {
                let document_type_str: String = row.get(4)?;
                let document_type = document_type_str.parse().unwrap_or(DocumentType::Other);
                
                Ok(Document {
                    id: row.get(0)?,
                    application_id: row.get(1)?,
                    name: row.get(2)?,
                    file_path: std::path::PathBuf::from(row.get::<_, String>(3)?),
                    document_type,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn update_document(&self, document: &Document) -> Result<()> {
        let now = Utc::now();
        
        self.execute(
            r#"
            UPDATE documents SET
                application_id = ?2,
                name = ?3,
                file_path = ?4,
                document_type = ?5,
                updated_at = ?6
            WHERE id = ?1
            "#,
            params![
                document.id,
                document.application_id,
                document.name,
                document.file_path.to_string_lossy(),
                document.document_type.to_string(),
                now,
            ],
        )?;
        
        Ok(())
    }

    fn list_documents(&self, application_id: Option<i64>, document_type: Option<DocumentType>) -> Result<Vec<Document>> {
        let mut query = "SELECT * FROM documents".to_string();
        let mut params = Vec::new();
        let mut conditions = Vec::<String>::new();
        
        if let Some(application_id) = application_id {
            conditions.push("application_id = ?1".to_string());
            params.push(application_id.to_string());
        }
        
        if let Some(doc_type) = document_type {
            let param_idx = params.len() + 1;
            conditions.push(format!("document_type = ?{}", param_idx));
            params.push(doc_type.to_string());
        }
        
        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }
        
        query.push_str(" ORDER BY created_at DESC");
        
        let mut stmt = self.prepare(&query)?;
        let documents = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                let document_type_str: String = row.get(4)?;
                let document_type = document_type_str.parse().unwrap_or(DocumentType::Other);
                
                Ok(Document {
                    id: row.get(0)?,
                    application_id: row.get(1)?,
                    name: row.get(2)?,
                    file_path: std::path::PathBuf::from(row.get::<_, String>(3)?),
                    document_type,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
            
        Ok(documents)
    }

    fn delete_document(&self, id: i64) -> Result<()> {
        self.execute("DELETE FROM documents WHERE id = ?1", [id])?;
        Ok(())
    }
}

impl ActivityQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_activity(&self, activity: &mut Activity) -> Result<()> {
        let now = Utc::now();
        activity.created_at = Some(now);
        
        self.execute(
            r#"
            INSERT INTO activity_log (entity_type, entity_id, action, description, metadata, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            "#,
            params![
                activity.entity_type,
                activity.entity_id,
                activity.action,
                activity.description,
                activity.metadata,
                now,
            ],
        )?;
        
        activity.id = Some(self.last_insert_rowid());
        Ok(())
    }

    fn list_activities(&self, entity_type: Option<&str>, limit: Option<usize>) -> Result<Vec<Activity>> {
        let mut query = "SELECT * FROM activity_log".to_string();
        let mut params = Vec::new();
        
        if let Some(entity_type) = entity_type {
            query.push_str(" WHERE entity_type = ?1");
            params.push(entity_type.to_string());
        }
        
        query.push_str(" ORDER BY created_at DESC");
        
        if let Some(limit) = limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }
        
        let mut stmt = self.prepare(&query)?;
        let activities = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                Ok(Activity {
                    id: row.get(0)?,
                    entity_type: row.get(1)?,
                    entity_id: row.get(2)?,
                    action: row.get(3)?,
                    description: row.get(4)?,
                    metadata: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        
        Ok(activities)
    }

    fn get_activities_for_entity(&self, entity_type: &str, entity_id: i64) -> Result<Vec<Activity>> {
        let mut stmt = self.prepare(
            "SELECT * FROM activity_log WHERE entity_type = ?1 AND entity_id = ?2 ORDER BY created_at DESC"
        )?;
        let activities = stmt
            .query_map(params![entity_type, entity_id], |row| {
                Ok(Activity {
                    id: row.get(0)?,
                    entity_type: row.get(1)?,
                    entity_id: row.get(2)?,
                    action: row.get(3)?,
                    description: row.get(4)?,
                    metadata: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        
        Ok(activities)
    }
}

impl CredentialQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_credential(&self, credential: &mut Credential) -> Result<()> {
        let now = Utc::now();
        credential.created_at = Some(now);
        credential.updated_at = Some(now);
        
        self.execute(
            r#"
            INSERT INTO credentials (
                platform, username, email, encrypted_password, cookies, tokens,
                is_active, last_used_at, expires_at, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                credential.platform,
                credential.username,
                credential.email,
                credential.encrypted_password,
                credential.cookies,
                credential.tokens,
                credential.is_active,
                credential.last_used_at,
                credential.expires_at,
                now,
                now,
            ],
        )?;
        
        credential.id = Some(self.last_insert_rowid());
        Ok(())
    }

    fn get_credential(&self, platform: &str) -> Result<Option<Credential>> {
        let mut stmt = self.prepare(
            "SELECT * FROM credentials WHERE platform = ?1"
        )?;
        
        let credential = stmt
            .query_row(params![platform], |row| {
                Ok(Credential {
                    id: row.get(0)?,
                    platform: row.get(1)?,
                    username: row.get(2)?,
                    email: row.get(3)?,
                    encrypted_password: row.get(4)?,
                    cookies: row.get(5)?,
                    tokens: row.get(6)?,
                    is_active: row.get(7)?,
                    last_used_at: row.get(8)?,
                    expires_at: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })
            .optional()?;
        
        Ok(credential)
    }

    fn update_credential(&self, credential: &Credential) -> Result<()> {
        let now = Utc::now();
        
        self.execute(
            r#"
            UPDATE credentials SET
                username = ?2,
                email = ?3,
                encrypted_password = ?4,
                cookies = ?5,
                tokens = ?6,
                is_active = ?7,
                last_used_at = ?8,
                expires_at = ?9,
                updated_at = ?10
            WHERE platform = ?1
            "#,
            params![
                credential.platform,
                credential.username,
                credential.email,
                credential.encrypted_password,
                credential.cookies,
                credential.tokens,
                credential.is_active,
                credential.last_used_at,
                credential.expires_at,
                now,
            ],
        )?;
        
        Ok(())
    }

    fn list_credentials(&self, active_only: bool) -> Result<Vec<Credential>> {
        let query = if active_only {
            "SELECT * FROM credentials WHERE is_active = 1 ORDER BY platform"
        } else {
            "SELECT * FROM credentials ORDER BY platform"
        };
        
        let mut stmt = self.prepare(query)?;
        let credentials = stmt
            .query_map([], |row| {
                Ok(Credential {
                    id: row.get(0)?,
                    platform: row.get(1)?,
                    username: row.get(2)?,
                    email: row.get(3)?,
                    encrypted_password: row.get(4)?,
                    cookies: row.get(5)?,
                    tokens: row.get(6)?,
                    is_active: row.get(7)?,
                    last_used_at: row.get(8)?,
                    expires_at: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        
        Ok(credentials)
    }

    fn delete_credential(&self, platform: &str) -> Result<()> {
        self.execute("DELETE FROM credentials WHERE platform = ?1", [platform])?;
        Ok(())
    }
}
