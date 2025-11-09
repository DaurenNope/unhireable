use std::fmt;
use std::io;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum Error {
    Io(String),
    Database(String),
    Anyhow(String),
    Custom(String),
}

impl std::error::Error for Error {}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => write!(f, "I/O error: {}", e),
            Error::Database(e) => write!(f, "Database error: {}", e),
            Error::Anyhow(e) => write!(f, "Error: {}", e),
            Error::Custom(msg) => write!(f, "{}", msg),
        }
    }
}

impl From<io::Error> for Error {
    fn from(err: io::Error) -> Self {
        Error::Io(err.to_string())
    }
}

impl From<rusqlite::Error> for Error {
    fn from(err: rusqlite::Error) -> Self {
        Error::Database(err.to_string())
    }
}

impl From<anyhow::Error> for Error {
    fn from(err: anyhow::Error) -> Self {
        Error::Anyhow(err.to_string())
    }
}

impl From<String> for Error {
    fn from(err: String) -> Self {
        Error::Custom(err)
    }
}

impl From<&str> for Error {
    fn from(err: &str) -> Self {
        Error::Custom(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

// Tauri 2.x automatically handles Result<T, E> where E: Display + Serialize
// No need for custom IpcResponse implementation
