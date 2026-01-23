# Multi-stage build for Tauri application
FROM rust:1.75 as rust-builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./

# Copy source code
COPY src-tauri/src ./src
COPY src-tauri/migrations ./migrations
COPY src-tauri/build.rs ./
COPY src-tauri/tauri.conf.json ./

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-0 \
    libxdo3 \
    libssl3 \
    libayatana-appindicator3-1 \
    librsvg2-2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=rust-builder /app/target/release/jobez /usr/local/bin/jobez

# Set environment variables
ENV RUST_LOG=info
ENV DATABASE_URL=postgresql://jobez:jobez_dev_password@postgres:5432/jobez
ENV REDIS_URL=redis://redis:6379

EXPOSE 8080

CMD ["jobez"]













