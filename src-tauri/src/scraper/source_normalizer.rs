/// Normalize source names to a consistent format
/// This prevents issues like "RemoteOK" vs "remoteok" creating duplicate sources
pub fn normalize_source_name(source: &str) -> String {
    let normalized = source.to_lowercase().trim().to_string();

    // Map common variations to standard names
    match normalized.as_str() {
        "remoteok" | "remote_ok" | "remote-ok" => "remoteok".to_string(),
        "wellfound" | "wellfound.com" | "angel.co" | "angellist" => "wellfound".to_string(),
        "greenhouse" | "greenhouse.io" | "boards.greenhouse.io" => "greenhouse".to_string(),
        "remotive" | "remotive.com" => "remotive".to_string(),
        "indeed" | "indeed.com" => "indeed".to_string(),
        "hh.ru" | "hhru" => "hh.ru".to_string(),
        "hh.kz" | "hhkz" => "hh.kz".to_string(),
        "linkedin" | "linkedin.com" => "linkedin".to_string(),
        "stackoverflow" | "stack overflow" | "stackoverflow.com" => "stackoverflow".to_string(),
        "dice" | "dice.com" => "dice".to_string(),
        "glassdoor" | "glassdoor.com" => "glassdoor".to_string(),
        "ziprecruiter" | "zip recruiter" | "ziprecruiter.com" => "ziprecruiter".to_string(),
        "weworkremotely" | "we work remotely" | "weworkremotely.com" | "wwr" => {
            "weworkremotely".to_string()
        }
        "remote.co" | "remoteco" | "remote co" => "remote.co".to_string(),
        "workatastartup" | "work at a startup" => "workatastartup".to_string(),
        _ => normalized, // Keep as-is if no mapping found
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_source_names() {
        assert_eq!(normalize_source_name("RemoteOK"), "remoteok");
        assert_eq!(normalize_source_name("remoteok"), "remoteok");
        assert_eq!(normalize_source_name("Remote_OK"), "remoteok");
        assert_eq!(normalize_source_name("Wellfound"), "wellfound");
        assert_eq!(normalize_source_name("angel.co"), "wellfound");
        assert_eq!(normalize_source_name("Greenhouse"), "greenhouse");
    }
}
