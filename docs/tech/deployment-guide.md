# 🚀 JobEz Deployment Guide

## 📋 Overview

This guide provides step-by-step instructions for deploying the JobEz Intelligent Learning Platform to production environments.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Database      │
│   (Next.js)    │◄──►│   (FastAPI)     │◄──►│  (PostgreSQL)   │
│   Port: 3000   │    │   Port: 8001    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     CDN        │    │   Monitoring    │    │   Backups       │
│  (CloudFlare)  │    │   (Sentry)      │    │   (Daily)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🌍 Deployment Options

### Option 1: Vercel + Railway (Recommended)
- **Frontend**: Vercel (Next.js optimized)
- **Backend**: Railway (FastAPI with PostgreSQL)
- **Pros**: Easy setup, auto-deployments, good free tier
- **Cons**: Vendor lock-in, limited control

### Option 2: AWS Full Stack
- **Frontend**: AWS S3 + CloudFront
- **Backend**: AWS ECS/Fargate
- **Database**: AWS RDS PostgreSQL
- **Pros**: Full control, scalable, enterprise-ready
- **Cons**: Complex setup, higher cost

### Option 3: DigitalOcean
- **Frontend**: DigitalOcean App Platform
- **Backend**: DigitalOcean Droplets
- **Database**: DigitalOcean Managed Database
- **Pros**: Good balance of control and ease
- **Cons**: Manual scaling required

## 🔧 Option 1: Vercel + Railway Deployment

### Step 1: Backend Deployment (Railway)

#### 1.1 Prepare Railway Project
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd web/backend
railway init
```

#### 1.2 Configure Environment
Create `railway.toml`:
```toml
[build]
builder = "NIXPACKS"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "jobez-api"
source = "."
```

#### 1.3 Environment Variables
Set in Railway dashboard:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-here
ENVIRONMENT=production
CORS_ORIGINS=https://yourdomain.vercel.app
```

#### 1.4 Deploy Backend
```bash
# Deploy to Railway
railway up

# Get deployment URL
railway domain
```

### Step 2: Frontend Deployment (Vercel)

#### 2.1 Prepare Vercel Project
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Initialize project
cd web/frontend
vercel
```

#### 2.2 Configure Environment
Create `.env.production`:
```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NEXT_PUBLIC_ENVIRONMENT=production
```

#### 2.3 Update API Client
In `web/frontend/src/api/client.ts`:
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
```

#### 2.4 Deploy Frontend
```bash
# Deploy to Vercel
vercel --prod
```

## 🔧 Option 2: AWS Deployment

### Step 1: Database (RDS)

#### 1.1 Create RDS Instance
```bash
# Using AWS CLI
aws rds create-db-instance \
  --db-instance-identifier jobez-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username jobez \
  --master-user-password your-secure-password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --multi-az \
  --storage-type gp2 \
  --publicly-accessible
```

#### 1.2 Configure Security
```bash
# Create security group
aws ec2 create-security-group \
  --group-name jobez-db-sg \
  --description "Security group for JobEz database"

# Allow inbound traffic
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --source sg-xxxxxxxxx
```

### Step 2: Backend (ECS/Fargate)

#### 2.1 Create ECR Repository
```bash
# Create repository
aws ecr create-repository --repository-name jobez-backend

# Build and push Docker image
cd web/backend
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin xxxxxxxx.dkr.ecr.us-west-2.amazonaws.com

docker build -t jobez-backend .
docker tag jobez-backend:latest xxxxxxxx.dkr.ecr.us-west-2.amazonaws.com/jobez-backend:latest
docker push xxxxxxxx.dkr.ecr.us-west-2.amazonaws.com/jobez-backend:latest
```

#### 2.2 Create ECS Task Definition
```json
{
  "family": "jobez-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "jobez-backend",
      "image": "xxxxxxx.dkr.ecr.us-west-2.amazonaws.com/jobez-backend:latest",
      "portMappings": [
        {
          "containerPort": 8001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "postgresql://user:pass@host:5432/dbname"
        },
        {
          "name": "ENVIRONMENT",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/jobez-backend",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 2.3 Create ECS Service
```bash
# Create service
aws ecs create-service \
  --cluster jobez-cluster \
  --service-name jobez-backend \
  --task-definition jobez-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxxxxxx],securityGroups=[sg-xxxxxxxxx],assignPublicIp=ENABLED}"
```

### Step 3: Frontend (S3 + CloudFront)

#### 3.1 Build and Deploy to S3
```bash
# Build frontend
cd web/frontend
npm run build

# Deploy to S3
aws s3 sync out/ s3://jobez-frontend --delete
aws s3 website s3://jobez-frontend/ --index-document index.html --error-document index.html
```

#### 3.2 Configure CloudFront
```bash
# Create CloudFront distribution
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## 🔧 Option 3: DigitalOcean Deployment

### Step 1: Database Setup
```bash
# Create managed database
doctl databases create jobez-db \
  --engine pg \
  --version 14 \
  --num-nodes 1 \
  --size db-s-2vcpu-4gb \
  --region nyc1
```

### Step 2: Backend Droplet
```bash
# Create droplet
doctl compute droplet create jobez-backend \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-4gb \
  --region nyc1 \
  --enable-private-networking

# SSH into droplet
ssh root@droplet-ip
```

#### 2.1 Setup Backend
```bash
# Install dependencies
apt update
apt install -y python3 python3-pip postgresql-client nginx

# Clone repository
git clone https://github.com/yourusername/jobez.git
cd jobez/web/backend

# Install Python dependencies
pip3 install -r requirements.txt

# Setup systemd service
sudo tee /etc/systemd/system/jobez-backend.service > /dev/null <<EOF
[Unit]
Description=JobEz Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/jobez/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Start service
systemctl enable jobez-backend
systemctl start jobez-backend
```

### Step 3: Frontend App Platform
```bash
# Create app
doctl apps create --spec file://app-spec.yaml
```

## 🔒 Security Configuration

### SSL/TLS Setup
```bash
# Using Certbot (for manual deployments)
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com

# Or use CloudFlare SSL (recommended)
# Add domain to CloudFlare dashboard
# Enable SSL/TLS encryption
```

### Firewall Rules
```bash
# UFW (Ubuntu)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Environment Security
```bash
# Secure environment variables
echo "DATABASE_URL=postgresql://..." >> .env
chmod 600 .env

# Use secrets management
# AWS Secrets Manager
# Railway Environment Variables
# DigitalOcean App Secrets
```

## 📊 Monitoring & Logging

### Application Monitoring
```bash
# Sentry for error tracking
npm install @sentry/node
# Configure in backend

# Google Analytics for frontend
# Add GA4 tracking ID to Next.js config
```

### Infrastructure Monitoring
```bash
# AWS CloudWatch (if using AWS)
# Set up dashboards for:
# - CPU utilization
# - Memory usage
# - Database connections
# - API response times

# DigitalOcean Monitoring (if using DO)
# Built-in monitoring for droplets and databases
```

### Log Aggregation
```bash
# ELK Stack (optional)
# Elasticsearch + Logstash + Kibana
# For centralized log management

# Or use cloud provider logs
# AWS CloudWatch Logs
# DigitalOcean App Logs
```

## 🔄 CI/CD Pipeline

### GitHub Actions (Recommended)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: railway up

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: vercel --prod
```

## 🔧 Production Checklist

### Pre-Deployment Checklist
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups enabled
- [ ] Monitoring configured
- [ ] Error tracking set up
- [ ] Performance testing completed
- [ ] Security scanning done
- [ ] Documentation updated

### Post-Deployment Checklist
- [ ] Verify all services running
- [ ] Test critical user flows
- [ ] Check monitoring dashboards
- [ ] Validate SSL certificates
- [ ] Test backup restoration
- [ ] Performance benchmarks
- [ ] Load testing
- [ ] Security audit

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool settings
# Increase max_connections in postgresql.conf
```

#### API Response Time Issues
```bash
# Check logs
tail -f /var/log/jobez-backend.log

# Monitor resources
htop
iostat
```

#### Frontend Build Issues
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Emergency Procedures

#### Database Recovery
```bash
# Restore from backup
psql $DATABASE_URL < backup.sql

# Point-in-time recovery (PostgreSQL)
pg_basebackup -D backup_dir
```

#### Rollback Deployment
```bash
# Railway
railway rollback

# Vercel
vercel rollback [deployment-url]

# Manual deployment
git checkout previous-commit
# Redeploy
```

## 📈 Scaling Strategies

### Horizontal Scaling
```bash
# Backend scaling
# Railway: Add more containers
# AWS: Increase ECS desired count
# DO: Load balancer + multiple droplets

# Database scaling
# Read replicas
# Connection pooling
# Caching layer (Redis)
```

### Performance Optimization
```bash
# Frontend optimization
# Code splitting
# Image optimization
# CDN distribution
# Service workers

# Backend optimization
# API response caching
# Database query optimization
# Connection pooling
```

## 💰 Cost Optimization

### Recommended Plans

#### Development/Staging
- **Frontend**: Vercel Pro ($20/month)
- **Backend**: Railway ($5-20/month)
- **Database**: Shared PostgreSQL ($5-15/month)
- **Total**: ~$30-55/month

#### Production (Small)
- **Frontend**: Vercel Pro ($20/month)
- **Backend**: Railway ($20-50/month)
- **Database**: Managed PostgreSQL ($25-75/month)
- **Monitoring**: Sentry ($26/month)
- **Total**: ~$91-171/month

#### Production (Enterprise)
- **Frontend**: AWS S3 + CloudFront (~$50/month)
- **Backend**: AWS ECS (~$100-500/month)
- **Database**: AWS RDS (~$100-300/month)
- **Monitoring**: New Relic (~$100/month)
- **Total**: ~$350-950/month

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- **Daily**: Check error logs, monitor performance
- **Weekly**: Review security updates, backup verification
- **Monthly**: Performance analysis, cost optimization
- **Quarterly**: Security audit, dependency updates

### Monitoring Alerts
- High error rates
- Slow response times
- Database connection issues
- SSL certificate expiration
- High resource utilization

---

## 🎯 Deployment Success Metrics

### Technical KPIs
- **Uptime**: > 99.9%
- **Response Time**: < 200ms (API)
- **Page Load**: < 3 seconds
- **Error Rate**: < 1%

### Business KPIs
- **User Registration**: Conversion rate
- **Assessment Completion**: > 80%
- **Job Match Accuracy**: > 70%
- **User Retention**: > 40% (30 days)

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Environment**: Production Ready
