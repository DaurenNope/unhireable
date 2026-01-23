use crate::db::models::{
    Activity, AlertFrequency, Application, ApplicationStatus, Contact, Credential, Document,
    DocumentType, Interview, Job, JobSnapshot, JobStatus, SavedSearch, SavedSearchFilters,
    SnapshotCount, UserAuth,
};
use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, types::Type, OptionalExtension};
use std::str::FromStr;
use std::sync::MutexGuard;

// Helper function to parse ApplicationStatus with proper error handling
fn parse_application_status(status_str: &str, application_id: Option<i64>) -> ApplicationStatus {
    status_str.parse().unwrap_or_else(|e| {
        let id_str = application_id
            .map(|id| format!(" (ID: {})", id))
            .unwrap_or_else(|| "".to_string());
        tracing::warn!(
            "Failed to parse application status '{}'{}: {}. Defaulting to Preparing.",
            status_str,
            id_str,
            e
        );
        ApplicationStatus::Preparing
    })
}

// Helper function to parse JobStatus with proper error handling
fn parse_job_status(status_str: &str, job_id: Option<i64>) -> JobStatus {
    status_str.parse().unwrap_or_else(|e| {
        let id_str = job_id
            .map(|id| format!(" (ID: {})", id))
            .unwrap_or_else(|| "".to_string());
        tracing::warn!(
            "Failed to parse job status '{}'{}: {}. Defaulting to Saved.",
            status_str,
            id_str,
            e
        );
        JobStatus::Saved
    })
}

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
    fn list_applications(
        &self,
        job_id: Option<i64>,
        status: Option<ApplicationStatus>,
    ) -> Result<Vec<Application>>;
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
    fn list_documents(
        &self,
        application_id: Option<i64>,
        document_type: Option<DocumentType>,
    ) -> Result<Vec<Document>>;
    fn delete_document(&self, id: i64) -> Result<()>;
}

pub trait AuthQueries {
    fn get_user_auth(&self) -> Result<Option<UserAuth>>;
    fn create_user_auth(&self, email: Option<&str>, password_hash: &str) -> Result<UserAuth>;
    fn update_user_auth_password(&self, password_hash: &str) -> Result<()>;
    fn update_user_auth_last_login(&self) -> Result<()>;
    fn delete_user_auth(&self) -> Result<()>;
}

pub trait ActivityQueries {
    fn create_activity(&self, activity: &mut Activity) -> Result<()>;
    fn list_activities(
        &self,
        entity_type: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<Activity>>;
    fn get_activities_for_entity(&self, entity_type: &str, entity_id: i64)
        -> Result<Vec<Activity>>;
}

pub trait CredentialQueries {
    fn create_credential(&self, credential: &mut Credential) -> Result<()>;
    fn get_credential(&self, platform: &str) -> Result<Option<Credential>>;
    fn update_credential(&self, credential: &Credential) -> Result<()>;
    fn list_credentials(&self, active_only: bool) -> Result<Vec<Credential>>;
    fn delete_credential(&self, platform: &str) -> Result<()>;
}

pub trait SnapshotQueries {
    fn create_job_snapshot(&self, snapshot: &mut JobSnapshot) -> Result<()>;
    fn get_latest_job_snapshot(&self) -> Result<Option<JobSnapshot>>;
    fn get_recent_job_snapshots(&self, limit: usize) -> Result<Vec<JobSnapshot>>;
}

pub trait SavedSearchQueries {
    fn create_saved_search(&self, search: &mut SavedSearch) -> Result<()>;
    fn get_saved_search(&self, id: i64) -> Result<Option<SavedSearch>>;
    fn update_saved_search(&self, search: &SavedSearch) -> Result<()>;
    fn list_saved_searches(&self, enabled_only: bool) -> Result<Vec<SavedSearch>>;
    fn delete_saved_search(&self, id: i64) -> Result<()>;
    fn get_saved_searches_due_for_run(&self) -> Result<Vec<SavedSearch>>;
    fn update_saved_search_last_run(&self, id: i64) -> Result<()>;
}

fn parse_snapshot_counts_json(json: &str) -> Result<Vec<SnapshotCount>, rusqlite::Error> {
    serde_json::from_str(json)
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(err)))
}

impl JobQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_job(&self, job: &mut Job) -> Result<()> {
        let now = Utc::now();

        let id = self.query_row(
            r#"
            INSERT INTO jobs (
                title, company, url, description, requirements, 
                location, salary, source, status, match_score, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
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
                &job.match_score,
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
            "SELECT id, title, company, url, description, requirements, location, salary, source, status, match_score, created_at, updated_at FROM jobs WHERE id = ?1",
            [id],
            |row| {
                let job_id: Option<i64> = row.get(0)?;
                let status_str: String = row.get(9)?;
                let status = parse_job_status(&status_str, job_id);
                Ok(Job {
                    id: job_id,
                    title: row.get(1)?,
                    company: row.get(2)?,
                    url: row.get(3)?,
                    description: row.get(4)?,
                    requirements: row.get(5)?,
                    location: row.get(6)?,
                    salary: row.get(7)?,
                    source: row.get(8)?,
                    status,
                    match_score: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn get_job_by_url(&self, url: &str) -> Result<Option<Job>> {
        self.query_row(
            "SELECT id, title, company, url, description, requirements, location, salary, source, status, match_score, created_at, updated_at FROM jobs WHERE url = ?1",
            [url],
            |row| {
                let job_id: Option<i64> = row.get(0)?;
                let status_str: String = row.get(9)?;
                let status = parse_job_status(&status_str, job_id);
                Ok(Job {
                    id: job_id,
                    title: row.get(1)?,
                    company: row.get(2)?,
                    url: row.get(3)?,
                    description: row.get(4)?,
                    requirements: row.get(5)?,
                    location: row.get(6)?,
                    salary: row.get(7)?,
                    source: row.get(8)?,
                    status,
                    match_score: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
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
                match_score = ?11,
                updated_at = ?12
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
                &job.match_score,
                now,
            ],
        )?;

        Ok(())
    }

    fn list_jobs(&self, status: Option<JobStatus>) -> Result<Vec<Job>> {
        let mut query = "SELECT id, title, company, url, description, requirements, location, salary, source, status, match_score, created_at, updated_at FROM jobs".to_string();
        let mut params = Vec::new();

        if let Some(status) = status {
            query.push_str(" WHERE status = ?1");
            params.push(status.to_string());
        }

        query.push_str(" ORDER BY created_at DESC");

        let mut stmt = self.prepare(&query)?;
        let jobs = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                let job_id: Option<i64> = row.get(0)?;
                let status_str: String = row.get(9)?;
                let status = parse_job_status(&status_str, job_id);

                Ok(Job {
                    id: job_id,
                    title: row.get(1)?,
                    company: row.get(2)?,
                    url: row.get(3)?,
                    description: row.get(4)?,
                    requirements: row.get(5)?,
                    location: row.get(6)?,
                    salary: row.get(7)?,
                    source: row.get(8)?,
                    status,
                    match_score: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
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
        self.query_row("SELECT * FROM applications WHERE id = ?1", [id], |row| {
            let application_id: Option<i64> = row.get(0)?;
            let status_str: String = row.get(3)?;
            let status = parse_application_status(&status_str, application_id);

            Ok(Application {
                id: application_id,
                job_id: row.get(1)?,
                applied_at: row.get(2)?,
                status,
                notes: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
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
                    let application_id: Option<i64> = row.get(0)?;
                    let status_str: String = row.get(3)?;
                    let status = parse_application_status(&status_str, application_id);

                    Ok(Application {
                        id: application_id,
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
                    let application_id: Option<i64> = row.get(0)?;
                    let status_str: String = row.get(3)?;
                    let status = parse_application_status(&status_str, application_id);

                    Ok(Application {
                        id: application_id,
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
                    let application_id: Option<i64> = row.get(0)?;
                    let status_str: String = row.get(3)?;
                    let status = parse_application_status(&status_str, application_id);

                    Ok(Application {
                        id: application_id,
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
                    let application_id: Option<i64> = row.get(0)?;
                    let status_str: String = row.get(3)?;
                    let status = parse_application_status(&status_str, application_id);

                    Ok(Application {
                        id: application_id,
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
        self.query_row("SELECT * FROM contacts WHERE id = ?1", [id], |row| {
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
        })
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
        self.query_row("SELECT * FROM interviews WHERE id = ?1", [id], |row| {
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
        })
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
        self.query_row("SELECT * FROM documents WHERE id = ?1", [id], |row| {
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
        })
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

    fn list_documents(
        &self,
        application_id: Option<i64>,
        document_type: Option<DocumentType>,
    ) -> Result<Vec<Document>> {
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

impl AuthQueries for MutexGuard<'_, rusqlite::Connection> {
    fn get_user_auth(&self) -> Result<Option<UserAuth>> {
        self.query_row(
            "SELECT id, email, password_hash, created_at, updated_at, last_login_at FROM user_auth LIMIT 1",
            [],
            |row| {
                Ok(UserAuth {
                    id: row.get(0)?,
                    email: row.get(1)?,
                    password_hash: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    last_login_at: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn create_user_auth(&self, email: Option<&str>, password_hash: &str) -> Result<UserAuth> {
        let now = Utc::now();
        let id = self.query_row(
            r#"
            INSERT INTO user_auth (email, password_hash, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?3)
            RETURNING id
            "#,
            params![email, password_hash, now],
            |row| row.get::<_, i64>(0),
        )?;

        Ok(UserAuth {
            id: Some(id),
            email: email.map(|e| e.to_string()),
            password_hash: password_hash.to_string(),
            created_at: Some(now),
            updated_at: Some(now),
            last_login_at: None,
        })
    }

    fn update_user_auth_password(&self, password_hash: &str) -> Result<()> {
        let now = Utc::now();
        self.execute(
            "UPDATE user_auth SET password_hash = ?1, updated_at = ?2 WHERE id = (SELECT id FROM user_auth LIMIT 1)",
            params![password_hash, now],
        )?;
        Ok(())
    }

    fn update_user_auth_last_login(&self) -> Result<()> {
        let now = Utc::now();
        self.execute(
            "UPDATE user_auth SET last_login_at = ?1, updated_at = ?1 WHERE id = (SELECT id FROM user_auth LIMIT 1)",
            params![now],
        )?;
        Ok(())
    }

    fn delete_user_auth(&self) -> Result<()> {
        self.execute("DELETE FROM user_auth", [])?;
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

    fn list_activities(
        &self,
        entity_type: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<Activity>> {
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

    fn get_activities_for_entity(
        &self,
        entity_type: &str,
        entity_id: i64,
    ) -> Result<Vec<Activity>> {
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
        let mut stmt = self.prepare("SELECT * FROM credentials WHERE platform = ?1")?;

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

impl SnapshotQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_job_snapshot(&self, snapshot: &mut JobSnapshot) -> Result<()> {
        let skill_counts = serde_json::to_string(&snapshot.skill_counts)?;
        let role_counts = serde_json::to_string(&snapshot.role_counts)?;
        let company_counts = serde_json::to_string(&snapshot.company_counts)?;
        let source_counts = serde_json::to_string(&snapshot.source_counts)?;

        let id = self.query_row(
            r#"
            INSERT INTO job_snapshots (
                captured_at,
                timeframe_days,
                total_jobs,
                remote_count,
                onsite_count,
                skill_counts,
                role_counts,
                company_counts,
                source_counts
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            RETURNING id
            "#,
            params![
                snapshot.captured_at,
                snapshot.timeframe_days,
                snapshot.total_jobs as i64,
                snapshot.remote_count as i64,
                snapshot.onsite_count as i64,
                skill_counts,
                role_counts,
                company_counts,
                source_counts,
            ],
            |row| row.get::<_, i64>(0),
        )?;

        snapshot.id = Some(id);
        Ok(())
    }

    fn get_latest_job_snapshot(&self) -> Result<Option<JobSnapshot>> {
        self.query_row(
            r#"
            SELECT id, captured_at, timeframe_days, total_jobs, remote_count, onsite_count,
                   skill_counts, role_counts, company_counts, source_counts
            FROM job_snapshots
            ORDER BY captured_at DESC
            LIMIT 1
            "#,
            [],
            |row| {
                let skill_counts_json: String = row.get(6)?;
                let role_counts_json: String = row.get(7)?;
                let company_counts_json: String = row.get(8)?;
                let source_counts_json: String = row.get(9)?;
                let skill_counts = parse_snapshot_counts_json(&skill_counts_json)?;
                let role_counts = parse_snapshot_counts_json(&role_counts_json)?;
                let company_counts = parse_snapshot_counts_json(&company_counts_json)?;
                let source_counts = parse_snapshot_counts_json(&source_counts_json)?;

                Ok(JobSnapshot {
                    id: row.get(0)?,
                    captured_at: row.get(1)?,
                    timeframe_days: row.get(2)?,
                    total_jobs: row.get::<_, i64>(3)? as usize,
                    remote_count: row.get::<_, i64>(4)? as usize,
                    onsite_count: row.get::<_, i64>(5)? as usize,
                    skill_counts,
                    role_counts,
                    company_counts,
                    source_counts,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn get_recent_job_snapshots(&self, limit: usize) -> Result<Vec<JobSnapshot>> {
        let mut stmt = self.prepare(
            r#"
            SELECT id, captured_at, timeframe_days, total_jobs, remote_count, onsite_count,
                   skill_counts, role_counts, company_counts, source_counts
            FROM job_snapshots
            ORDER BY captured_at DESC
            LIMIT ?1
            "#,
        )?;

        let snapshots = stmt
            .query_map([limit as i64], |row| {
                let skill_counts_json: String = row.get(6)?;
                let role_counts_json: String = row.get(7)?;
                let company_counts_json: String = row.get(8)?;
                let source_counts_json: String = row.get(9)?;
                let skill_counts = parse_snapshot_counts_json(&skill_counts_json)?;
                let role_counts = parse_snapshot_counts_json(&role_counts_json)?;
                let company_counts = parse_snapshot_counts_json(&company_counts_json)?;
                let source_counts = parse_snapshot_counts_json(&source_counts_json)?;

                Ok(JobSnapshot {
                    id: row.get(0)?,
                    captured_at: row.get(1)?,
                    timeframe_days: row.get(2)?,
                    total_jobs: row.get::<_, i64>(3)? as usize,
                    remote_count: row.get::<_, i64>(4)? as usize,
                    onsite_count: row.get::<_, i64>(5)? as usize,
                    skill_counts,
                    role_counts,
                    company_counts,
                    source_counts,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(snapshots)
    }
}

impl SavedSearchQueries for MutexGuard<'_, rusqlite::Connection> {
    fn create_saved_search(&self, search: &mut SavedSearch) -> Result<()> {
        let now = Utc::now();
        let sources_json = serde_json::to_string(&search.sources)?;
        let filters_json = serde_json::to_string(&search.filters)?;

        let id = self.query_row(
            r#"
            INSERT INTO saved_searches (
                name, query, sources, filters, alert_frequency, min_match_score, enabled,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            RETURNING id
            "#,
            params![
                search.name,
                search.query,
                sources_json,
                filters_json,
                search.alert_frequency.to_string(),
                search.min_match_score,
                search.enabled,
                now,
                now,
            ],
            |row| row.get::<_, i64>(0),
        )?;

        search.id = Some(id);
        search.created_at = Some(now);
        search.updated_at = Some(now);
        Ok(())
    }

    fn get_saved_search(&self, id: i64) -> Result<Option<SavedSearch>> {
        self.query_row(
            r#"
            SELECT id, name, query, sources, filters, alert_frequency, min_match_score,
                   enabled, last_run_at, created_at, updated_at
            FROM saved_searches
            WHERE id = ?1
            "#,
            params![id],
            |row| {
                let sources_json: String = row.get(3)?;
                let filters_json: String = row.get(4)?;
                let alert_freq_str: String = row.get(5)?;

                let sources: Vec<String> =
                    serde_json::from_str(&sources_json).unwrap_or_else(|_| vec![]);
                let filters: SavedSearchFilters =
                    serde_json::from_str(&filters_json).unwrap_or_default();
                let alert_frequency = <AlertFrequency as FromStr>::from_str(&alert_freq_str)
                    .unwrap_or(AlertFrequency::Daily);

                Ok(SavedSearch {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    query: row.get(2)?,
                    sources,
                    filters,
                    alert_frequency,
                    min_match_score: row.get(6)?,
                    enabled: row.get(7)?,
                    last_run_at: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    fn update_saved_search(&self, search: &SavedSearch) -> Result<()> {
        let now = Utc::now();
        let sources_json = serde_json::to_string(&search.sources)?;
        let filters_json = serde_json::to_string(&search.filters)?;

        self.execute(
            r#"
            UPDATE saved_searches
            SET name = ?1, query = ?2, sources = ?3, filters = ?4, alert_frequency = ?5,
                min_match_score = ?6, enabled = ?7, updated_at = ?8
            WHERE id = ?9
            "#,
            params![
                search.name,
                search.query,
                sources_json,
                filters_json,
                search.alert_frequency.to_string(),
                search.min_match_score,
                search.enabled,
                now,
                search.id.unwrap_or(0),
            ],
        )?;

        Ok(())
    }

    fn list_saved_searches(&self, enabled_only: bool) -> Result<Vec<SavedSearch>> {
        let sql = if enabled_only {
            r#"
            SELECT id, name, query, sources, filters, alert_frequency, min_match_score,
                   enabled, last_run_at, created_at, updated_at
            FROM saved_searches
            WHERE enabled = 1
            ORDER BY created_at DESC
            "#
        } else {
            r#"
            SELECT id, name, query, sources, filters, alert_frequency, min_match_score,
                   enabled, last_run_at, created_at, updated_at
            FROM saved_searches
            ORDER BY created_at DESC
            "#
        };

        let mut stmt = self.prepare(sql)?;
        let searches = stmt
            .query_map([], |row| {
                let sources_json: String = row.get(3)?;
                let filters_json: String = row.get(4)?;
                let alert_freq_str: String = row.get(5)?;

                let sources: Vec<String> =
                    serde_json::from_str(&sources_json).unwrap_or_else(|_| vec![]);
                let filters: SavedSearchFilters =
                    serde_json::from_str(&filters_json).unwrap_or_default();
                let alert_frequency = <AlertFrequency as FromStr>::from_str(&alert_freq_str)
                    .unwrap_or(AlertFrequency::Daily);

                Ok(SavedSearch {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    query: row.get(2)?,
                    sources,
                    filters,
                    alert_frequency,
                    min_match_score: row.get(6)?,
                    enabled: row.get(7)?,
                    last_run_at: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(searches)
    }

    fn delete_saved_search(&self, id: i64) -> Result<()> {
        self.execute("DELETE FROM saved_searches WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn get_saved_searches_due_for_run(&self) -> Result<Vec<SavedSearch>> {
        let now = Utc::now();
        let one_hour_ago = now - chrono::Duration::hours(1);
        let one_day_ago = now - chrono::Duration::days(1);
        let one_week_ago = now - chrono::Duration::weeks(1);

        let mut stmt = self.prepare(
            r#"
            SELECT id, name, query, sources, filters, alert_frequency, min_match_score,
                   enabled, last_run_at, created_at, updated_at
            FROM saved_searches
            WHERE enabled = 1
            AND (
                (alert_frequency = 'hourly' AND (last_run_at IS NULL OR last_run_at < ?1))
                OR (alert_frequency = 'daily' AND (last_run_at IS NULL OR last_run_at < ?2))
                OR (alert_frequency = 'weekly' AND (last_run_at IS NULL OR last_run_at < ?3))
            )
            ORDER BY created_at ASC
            "#,
        )?;

        let searches = stmt
            .query_map(params![one_hour_ago, one_day_ago, one_week_ago], |row| {
                let sources_json: String = row.get(3)?;
                let filters_json: String = row.get(4)?;
                let alert_freq_str: String = row.get(5)?;

                let sources: Vec<String> =
                    serde_json::from_str(&sources_json).unwrap_or_else(|_| vec![]);
                let filters: SavedSearchFilters =
                    serde_json::from_str(&filters_json).unwrap_or_default();
                let alert_frequency = <AlertFrequency as FromStr>::from_str(&alert_freq_str)
                    .unwrap_or(AlertFrequency::Daily);

                Ok(SavedSearch {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    query: row.get(2)?,
                    sources,
                    filters,
                    alert_frequency,
                    min_match_score: row.get(6)?,
                    enabled: row.get(7)?,
                    last_run_at: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(searches)
    }

    fn update_saved_search_last_run(&self, id: i64) -> Result<()> {
        let now = Utc::now();
        self.execute(
            "UPDATE saved_searches SET last_run_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }
}
