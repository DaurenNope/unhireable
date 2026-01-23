# Intelligence Agent - Implementation Guide

## Overview

The Intelligence Agent is a Python microservice that provides ML-powered matching, recommendations, analytics, and insights for the Job Hunter application. It combines multiple AI/ML capabilities into a unified service.

## Architecture

```
┌─────────────────────┐
│   Rust Backend      │
│   (Tauri App)       │
└──────────┬──────────┘
           │ HTTP/REST
           │
┌──────────▼──────────────────────────┐
│   Intelligence Agent (Python)       │
│   ┌──────────────────────────────┐  │
│   │  FastAPI REST API            │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Embedding Service           │  │
│   │  (sentence-transformers)     │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Matching Service            │  │
│   │  (ML-based similarity)       │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Recommendation Engine       │  │
│   │  (Collaborative filtering)   │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Analytics Engine            │  │
│   │  (InfluxDB time-series)      │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Market Insights             │  │
│   │  (Trend analysis)            │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Career Path Engine          │  │
│   │  (Skill progression)         │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Skill Gap Analyzer          │  │
│   │  (Learning recommendations)  │  │
│   └──────────────────────────────┘  │
│   ┌──────────────────────────────┐  │
│   │  Predictive Models           │  │
│   │  (Success prediction)        │  │
│   └──────────────────────────────┘  │
└─────────────────────────────────────┘
           │
           ├──► Redis (Caching)
           ├──► InfluxDB (Time-series)
           └──► Vector DB (Pinecone/Weaviate)
```

## Features

### 1. ML-based Job Matching
- **Vector Embeddings**: Uses sentence-transformers to create embeddings for job descriptions and resumes
- **Semantic Similarity**: Calculates cosine similarity between job and candidate embeddings
- **Skills Matching**: Extracts and matches skills from job descriptions
- **Experience Matching**: Analyzes experience level requirements
- **Location Matching**: Considers location preferences

### 2. Personalized Recommendations
- **Collaborative Filtering**: Learns from similar users' preferences
- **Content-based Filtering**: Recommends based on job content similarity
- **Behavioral Learning**: Tracks user interactions and adapts recommendations
- **Hybrid Approach**: Combines multiple recommendation strategies

### 3. Analytics Engine
- **Time-series Tracking**: Records user interactions over time
- **Application Metrics**: Tracks application rates, interview rates
- **User Insights**: Provides personalized analytics dashboards
- **Event Tracking**: Comprehensive event logging system

### 4. Market Insights
- **Trend Analysis**: Identifies trending skills, roles, locations
- **Salary Trends**: Tracks salary changes over time
- **Demand Indicators**: Shows market demand for skills/roles
- **Remote Work Trends**: Analyzes remote vs on-site trends

### 5. Career Path Recommendations
- **Role Progression**: Suggests logical career progression paths
- **Skill Development**: Identifies skills needed for target roles
- **Timeline Estimation**: Estimates time to reach target role
- **Similarity Analysis**: Compares current and target roles

### 6. Skill Gap Analysis
- **Gap Identification**: Finds missing skills for target roles
- **Market Analysis**: Analyzes required skills from market data
- **Learning Recommendations**: Suggests courses/resources
- **Priority Ranking**: Ranks skills by importance

### 7. Predictive Analytics
- **Application Success**: Predicts probability of application success
- **Salary Prediction**: Estimates salary ranges for roles
- **Market Forecasting**: Predicts market trends
- **Success Factors**: Identifies key success factors

## Setup

### Prerequisites
- Python 3.11+
- Redis (for caching)
- InfluxDB (for time-series analytics) - optional
- Vector Database (Pinecone or Weaviate) - optional

### Installation

1. **Navigate to intelligence-agent directory:**
```bash
cd intelligence-agent
```

2. **Create virtual environment:**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Download spaCy model:**
```bash
python -m spacy download en_core_web_sm
```

5. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

6. **Start the service:**
```bash
# Legacy start script (removed from the main workspace)
# ./start.sh

# Use uvicorn directly if you revive this experiment
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Docker Setup

```bash
# Build the image
docker build -t intelligence-agent .

# Run the container
docker run -p 8000:8000 \
  -e REDIS_URL=redis://localhost:6379/0 \
  -e INFLUXDB_URL=http://localhost:8086 \
  intelligence-agent
```

## API Endpoints

### Health Check
- `GET /health` - Service health check

### Matching
- `POST /api/v1/matching/match` - Calculate job match score
- `POST /api/v1/matching/similar` - Find similar jobs

### Recommendations
- `POST /api/v1/recommendations/jobs` - Get personalized job recommendations
- `POST /api/v1/recommendations/learn` - Get learning recommendations

### Analytics
- `POST /api/v1/analytics/track` - Track user interaction event
- `GET /api/v1/analytics/insights` - Get user analytics insights

### Market Insights
- `POST /api/v1/market-insights/trends` - Get market trends

### Career Path
- `POST /api/v1/career-path/recommendations` - Get career path recommendations

### Skill Gap
- `POST /api/v1/skill-gap/analyze` - Analyze skill gaps

### Predictive
- `POST /api/v1/predictive/application-success` - Predict application success
- `POST /api/v1/predictive/salary` - Predict salary range

## Rust Integration

The Rust backend integrates with the Intelligence Agent through the `intelligence` module:

```rust
use crate::intelligence::IntelligenceAgent;

// Initialize the agent
let agent = IntelligenceAgent::new(Some("http://localhost:8000".to_string()));

// Calculate match score
let match_result = agent.calculate_match(
    job_description,
    Some(resume_text),
    Some(&skills),
    Some(experience_years),
    Some(location)
).await?;

// Get recommendations
let recommendations = agent.get_recommendations(
    user_id,
    &previous_job_ids,
    None,
    10
).await?;
```

## Configuration

Key environment variables:

- `VECTOR_DB_TYPE`: `pinecone` or `weaviate`
- `PINECONE_API_KEY`: Pinecone API key
- `WEAVIATE_URL`: Weaviate instance URL
- `INFLUXDB_URL`: InfluxDB connection URL
- `INFLUXDB_TOKEN`: InfluxDB authentication token
- `REDIS_URL`: Redis connection URL
- `EMBEDDING_MODEL`: Model name for embeddings (default: `sentence-transformers/all-MiniLM-L6-v2`)
- `API_HOST`: API host (default: `0.0.0.0`)
- `API_PORT`: API port (default: `8000`)

## Development

### Running Tests
```bash
pytest
```

### Code Style
```bash
black app/
isort app/
flake8 app/
```

### API Documentation
Once the service is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Performance Considerations

- **Caching**: Redis is used for caching embeddings and model results
- **Batch Processing**: Embeddings are generated in batches for efficiency
- **Model Loading**: Models are loaded once at startup and reused
- **Async Operations**: All I/O operations are async for better performance

## Monitoring

- Health check endpoint for service monitoring
- Structured logging for debugging
- Prometheus metrics support (coming soon)

## Future Enhancements

- [ ] Vector database integration for similarity search
- [ ] Advanced collaborative filtering with matrix factorization
- [ ] Deep learning models for match scoring
- [ ] Real-time recommendation updates
- [ ] A/B testing framework for recommendation algorithms
- [ ] Model versioning and rollback
- [ ] Distributed model serving

## Troubleshooting

### Service won't start
- Check if port 8000 is available
- Verify all dependencies are installed
- Check environment variables

### Embeddings are slow
- Reduce batch size
- Use GPU if available
- Enable Redis caching

### InfluxDB connection issues
- Service will continue without InfluxDB (cache-only mode)
- Check connection URL and token
- Verify network connectivity

## License

Same as the main project.













