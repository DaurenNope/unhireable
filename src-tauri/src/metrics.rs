use prometheus::{Counter, Histogram, Registry, TextEncoder};

lazy_static::lazy_static! {
    pub static ref REGISTRY: Registry = Registry::new();
    
    // HTTP metrics
    pub static ref HTTP_REQUESTS_TOTAL: Counter = Counter::new(
        "http_requests_total",
        "Total number of HTTP requests"
    ).expect("Failed to create HTTP_REQUESTS_TOTAL counter");
    
    pub static ref HTTP_REQUEST_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "http_request_duration_seconds",
            "HTTP request duration in seconds"
        )
    ).expect("Failed to create HTTP_REQUEST_DURATION histogram");
    
    // Database metrics
    pub static ref DB_QUERIES_TOTAL: Counter = Counter::new(
        "db_queries_total",
        "Total number of database queries"
    ).expect("Failed to create DB_QUERIES_TOTAL counter");
    
    pub static ref DB_QUERY_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "db_query_duration_seconds",
            "Database query duration in seconds"
        )
    ).expect("Failed to create DB_QUERY_DURATION histogram");
    
    // Scraper metrics
    pub static ref SCRAPER_JOBS_FOUND: Counter = Counter::new(
        "scraper_jobs_found_total",
        "Total number of jobs found by scrapers"
    ).expect("Failed to create SCRAPER_JOBS_FOUND counter");
    
    pub static ref SCRAPER_ERRORS: Counter = Counter::new(
        "scraper_errors_total",
        "Total number of scraper errors"
    ).expect("Failed to create SCRAPER_ERRORS counter");
    
    // Application metrics
    pub static ref APPLICATIONS_CREATED: Counter = Counter::new(
        "applications_created_total",
        "Total number of applications created"
    ).expect("Failed to create APPLICATIONS_CREATED counter");
    
    // ML/Matching metrics
    pub static ref MATCH_CALCULATIONS_TOTAL: Counter = Counter::new(
        "match_calculations_total",
        "Total number of match score calculations"
    ).expect("Failed to create MATCH_CALCULATIONS_TOTAL counter");
    
    pub static ref MATCH_CALCULATION_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "match_calculation_duration_seconds",
            "Match score calculation duration in seconds"
        )
    ).expect("Failed to create MATCH_CALCULATION_DURATION histogram");
    
    pub static ref BATCH_MATCH_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "batch_match_duration_seconds",
            "Batch job matching duration in seconds"
        )
    ).expect("Failed to create BATCH_MATCH_DURATION histogram");
    
    // Recommendation metrics
    pub static ref RECOMMENDATIONS_GENERATED: Counter = Counter::new(
        "recommendations_generated_total",
        "Total number of recommendation generations"
    ).expect("Failed to create RECOMMENDATIONS_GENERATED counter");
    
    pub static ref RECOMMENDATION_GENERATION_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "recommendation_generation_duration_seconds",
            "Recommendation generation duration in seconds"
        )
    ).expect("Failed to create RECOMMENDATION_GENERATION_DURATION histogram");
    
    // Embedding metrics
    pub static ref EMBEDDINGS_GENERATED: Counter = Counter::new(
        "embeddings_generated_total",
        "Total number of embeddings generated"
    ).expect("Failed to create EMBEDDINGS_GENERATED counter");
    
    pub static ref EMBEDDING_GENERATION_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "embedding_generation_duration_seconds",
            "Embedding generation duration in seconds"
        )
    ).expect("Failed to create EMBEDDING_GENERATION_DURATION histogram");
    
    // API call metrics
    pub static ref INTELLIGENCE_API_CALLS: Counter = Counter::new(
        "intelligence_api_calls_total",
        "Total number of Intelligence Agent API calls"
    ).expect("Failed to create INTELLIGENCE_API_CALLS counter");
    
    pub static ref INTELLIGENCE_API_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "intelligence_api_duration_seconds",
            "Intelligence Agent API call duration in seconds"
        )
    ).expect("Failed to create INTELLIGENCE_API_DURATION histogram");
    
    pub static ref INTELLIGENCE_API_ERRORS: Counter = Counter::new(
        "intelligence_api_errors_total",
        "Total number of Intelligence Agent API errors"
    ).expect("Failed to create INTELLIGENCE_API_ERRORS counter");
    
    // Cache metrics
    pub static ref CACHE_HITS: Counter = Counter::new(
        "cache_hits_total",
        "Total number of cache hits"
    ).expect("Failed to create CACHE_HITS counter");
    
    pub static ref CACHE_MISSES: Counter = Counter::new(
        "cache_misses_total",
        "Total number of cache misses"
    ).expect("Failed to create CACHE_MISSES counter");
    
    pub static ref RECOMMENDATION_CACHE_HITS: Counter = Counter::new(
        "recommendation_cache_hits_total",
        "Total number of recommendation cache hits"
    ).expect("Failed to create RECOMMENDATION_CACHE_HITS counter");
    
    pub static ref RECOMMENDATION_CACHE_MISSES: Counter = Counter::new(
        "recommendation_cache_misses_total",
        "Total number of recommendation cache misses"
    ).expect("Failed to create RECOMMENDATION_CACHE_MISSES counter");
    
    // Document Generation metrics
    pub static ref DOCUMENTS_GENERATED_TOTAL: Counter = Counter::new(
        "documents_generated_total",
        "Total number of documents generated"
    ).expect("Failed to create DOCUMENTS_GENERATED_TOTAL counter");
    
    pub static ref DOCUMENT_GENERATION_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "document_generation_duration_seconds",
            "Document generation duration in seconds"
        )
    ).expect("Failed to create DOCUMENT_GENERATION_DURATION histogram");
    
    pub static ref DOCUMENT_GENERATION_FAILURES: Counter = Counter::new(
        "document_generation_failures_total",
        "Total number of document generation failures"
    ).expect("Failed to create DOCUMENT_GENERATION_FAILURES counter");
    
    pub static ref DOCUMENT_CACHE_HITS: Counter = Counter::new(
        "document_cache_hits_total",
        "Total number of document cache hits"
    ).expect("Failed to create DOCUMENT_CACHE_HITS counter");
    
    pub static ref DOCUMENT_CACHE_MISSES: Counter = Counter::new(
        "document_cache_misses_total",
        "Total number of document cache misses"
    ).expect("Failed to create DOCUMENT_CACHE_MISSES counter");
    
    pub static ref AI_API_CALLS_TOTAL: Counter = Counter::new(
        "ai_api_calls_total",
        "Total number of AI API calls"
    ).expect("Failed to create AI_API_CALLS_TOTAL counter");
    
    pub static ref AI_API_CALL_DURATION: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "ai_api_call_duration_seconds",
            "AI API call duration in seconds"
        )
    ).expect("Failed to create AI_API_CALL_DURATION histogram");
    
    pub static ref DOCUMENT_QUALITY_SCORE: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new(
            "document_quality_score",
            "Document quality score (0-100)"
        )
    ).expect("Failed to create DOCUMENT_QUALITY_SCORE histogram");
}

pub fn init_metrics() {
    REGISTRY.register(Box::new(HTTP_REQUESTS_TOTAL.clone())).unwrap();
    REGISTRY.register(Box::new(HTTP_REQUEST_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(DB_QUERIES_TOTAL.clone())).unwrap();
    REGISTRY.register(Box::new(DB_QUERY_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(SCRAPER_JOBS_FOUND.clone())).unwrap();
    REGISTRY.register(Box::new(SCRAPER_ERRORS.clone())).unwrap();
    REGISTRY.register(Box::new(APPLICATIONS_CREATED.clone())).unwrap();
    
    // ML/Matching metrics
    REGISTRY.register(Box::new(MATCH_CALCULATIONS_TOTAL.clone())).unwrap();
    REGISTRY.register(Box::new(MATCH_CALCULATION_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(BATCH_MATCH_DURATION.clone())).unwrap();
    
    // Recommendation metrics
    REGISTRY.register(Box::new(RECOMMENDATIONS_GENERATED.clone())).unwrap();
    REGISTRY.register(Box::new(RECOMMENDATION_GENERATION_DURATION.clone())).unwrap();
    
    // Embedding metrics
    REGISTRY.register(Box::new(EMBEDDINGS_GENERATED.clone())).unwrap();
    REGISTRY.register(Box::new(EMBEDDING_GENERATION_DURATION.clone())).unwrap();
    
    // API call metrics
    REGISTRY.register(Box::new(INTELLIGENCE_API_CALLS.clone())).unwrap();
    REGISTRY.register(Box::new(INTELLIGENCE_API_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(INTELLIGENCE_API_ERRORS.clone())).unwrap();
    
    // Cache metrics
    REGISTRY.register(Box::new(CACHE_HITS.clone())).unwrap();
    REGISTRY.register(Box::new(CACHE_MISSES.clone())).unwrap();
    REGISTRY.register(Box::new(RECOMMENDATION_CACHE_HITS.clone())).unwrap();
    REGISTRY.register(Box::new(RECOMMENDATION_CACHE_MISSES.clone())).unwrap();
    
    // Document Generation metrics
    REGISTRY.register(Box::new(DOCUMENTS_GENERATED_TOTAL.clone())).unwrap();
    REGISTRY.register(Box::new(DOCUMENT_GENERATION_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(DOCUMENT_GENERATION_FAILURES.clone())).unwrap();
    REGISTRY.register(Box::new(DOCUMENT_CACHE_HITS.clone())).unwrap();
    REGISTRY.register(Box::new(DOCUMENT_CACHE_MISSES.clone())).unwrap();
    REGISTRY.register(Box::new(AI_API_CALLS_TOTAL.clone())).unwrap();
    REGISTRY.register(Box::new(AI_API_CALL_DURATION.clone())).unwrap();
    REGISTRY.register(Box::new(DOCUMENT_QUALITY_SCORE.clone())).unwrap();
    
    tracing::info!("Prometheus metrics initialized");
}

pub fn get_metrics() -> String {
    let encoder = TextEncoder::new();
    let metric_families = REGISTRY.gather();
    encoder.encode_to_string(&metric_families).unwrap()
}






