# Crawl4AI Scraper Service

Unified job scraping service using Crawl4AI.

## Quick Start

```bash
# Install dependencies
pip install crawl4ai fastapi uvicorn tomllib

# Run service
python main.py
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/sources` | GET | List available sources |
| `/scrape` | POST | Scrape jobs from sources |
| `/jobs` | GET | Get scraped jobs |
| `/jobs/matched` | GET | Get matched jobs (min 20% score) |

## Configuration

Edit `config/sources.toml` to add/modify job sources.

## Usage from Rust

```rust
let response = reqwest::Client::new()
    .post("http://localhost:8765/scrape")
    .json(&json!({"sources": ["remoteok", "remotive"], "limit": 50}))
    .send()
    .await?;
```
