use crate::db::models::{Contact, Document, DocumentType, Interview};
use crate::db::queries::{ContactQueries, DocumentQueries, InterviewQueries};
use crate::error::Result;
use crate::AppState;
use std::str::FromStr;
use tauri::State;

// ========== Contact Commands ==========

#[tauri::command]
pub async fn get_contacts(state: State<'_, AppState>, job_id: Option<i64>) -> Result<Vec<Contact>> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.list_contacts(job_id)?)
}

#[tauri::command]
pub async fn create_contact(state: State<'_, AppState>, mut contact: Contact) -> Result<Contact> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.create_contact(&mut contact)?;
    Ok(contact)
}

#[tauri::command]
pub async fn update_contact(state: State<'_, AppState>, contact: Contact) -> Result<Contact> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.update_contact(&contact)?;
    Ok(contact)
}

#[tauri::command]
pub async fn delete_contact(state: State<'_, AppState>, id: i64) -> Result<()> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.delete_contact(id)?)
}

// ========== Interview Commands ==========

#[tauri::command]
pub async fn get_interviews(
    state: State<'_, AppState>,
    application_id: Option<i64>,
) -> Result<Vec<Interview>> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.list_interviews(application_id)?)
}

#[tauri::command]
pub async fn create_interview(
    state: State<'_, AppState>,
    mut interview: Interview,
) -> Result<Interview> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.create_interview(&mut interview)?;
    Ok(interview)
}

#[tauri::command]
pub async fn update_interview(
    state: State<'_, AppState>,
    interview: Interview,
) -> Result<Interview> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.update_interview(&interview)?;
    Ok(interview)
}

#[tauri::command]
pub async fn delete_interview(state: State<'_, AppState>, id: i64) -> Result<()> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.delete_interview(id)?)
}

// ========== Document Commands ==========

#[tauri::command]
pub async fn get_documents(
    state: State<'_, AppState>,
    application_id: Option<i64>,
    document_type: Option<String>,
) -> Result<Vec<Document>> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();

    let doc_type = match document_type {
        Some(dt) => Some(DocumentType::from_str(&dt)?),
        None => None,
    };

    Ok(conn.list_documents(application_id, doc_type)?)
}

#[tauri::command]
pub async fn create_document(
    state: State<'_, AppState>,
    mut document: Document,
) -> Result<Document> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.create_document(&mut document)?;
    Ok(document)
}

#[tauri::command]
pub async fn update_document(state: State<'_, AppState>, document: Document) -> Result<Document> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    conn.update_document(&document)?;
    Ok(document)
}

#[tauri::command]
pub async fn delete_document(state: State<'_, AppState>, id: i64) -> Result<()> {
    let db = state.db.lock().await;
    let db = db
        .as_ref()
        .ok_or_else(|| crate::error::Error::Custom("Database not initialized".to_string()))?;
    let conn = db.get_connection();
    Ok(conn.delete_document(id)?)
}
