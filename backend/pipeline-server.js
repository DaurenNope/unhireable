/**
 * Unhireable Pipeline API Server
 * 
 * Provides endpoints to execute scanner, evaluator, and import scripts
 * Dashboard calls these to run the full pipeline automatically
 */

import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Project root path
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

// Active pipeline processes (for cancellation)
const activePipelines = new Map();

/**
 * GET /api/health - Check server status
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        projectRoot: PROJECT_ROOT
    });
});

/**
 * GET /api/status - Check pipeline data files status
 */
app.get('/api/status', (req, res) => {
    const files = {
        rawJobs: fs.existsSync(path.join(DATA_DIR, 'jobs_raw.json')),
        evaluatedJobs: fs.existsSync(path.join(DATA_DIR, 'jobs_evaluated.json')),
        extensionImport: fs.existsSync(path.join(DATA_DIR, 'extension_jobs_import.json')),
        config: fs.existsSync(path.join(DATA_DIR, 'config.yml'))
    };
    
    // Get counts if files exist
    const counts = {};
    if (files.rawJobs) {
        try {
            const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jobs_raw.json'), 'utf8'));
            counts.rawJobs = raw.length;
        } catch (e) { counts.rawJobs = 0; }
    }
    if (files.evaluatedJobs) {
        try {
            const evald = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'jobs_evaluated.json'), 'utf8'));
            counts.evaluatedJobs = evald.length;
        } catch (e) { counts.evaluatedJobs = 0; }
    }
    if (files.extensionImport) {
        try {
            const ext = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'extension_jobs_import.json'), 'utf8'));
            counts.extensionJobs = ext.length;
        } catch (e) { counts.extensionJobs = 0; }
    }
    
    res.json({ files, counts, timestamp: new Date().toISOString() });
});

/**
 * POST /api/pipeline/run - Run full pipeline
 * Body: { scan: boolean, evaluate: boolean, import: boolean, minScore?: number }
 */
app.post('/api/pipeline/run', async (req, res) => {
    const pipelineId = Date.now().toString();
    const { scan = true, evaluate = true, import: doImport = true, minScore = 3.0 } = req.body;
    
    // Send initial response with pipeline ID
    res.json({ 
        pipelineId, 
        status: 'started',
        steps: { scan, evaluate, import: doImport }
    });
    
    // Run pipeline asynchronously
    runPipelineAsync(pipelineId, { scan, evaluate, import: doImport, minScore });
});

/**
 * POST /api/pipeline/stop - Stop running pipeline
 */
app.post('/api/pipeline/stop/:pipelineId', (req, res) => {
    const { pipelineId } = req.params;
    const pipeline = activePipelines.get(pipelineId);
    
    if (pipeline) {
        pipeline.cancelled = true;
        // Kill any running processes
        if (pipeline.process) {
            pipeline.process.kill('SIGTERM');
        }
        res.json({ status: 'stopped', pipelineId });
    } else {
        res.status(404).json({ error: 'Pipeline not found' });
    }
});

/**
 * GET /api/pipeline/status/:pipelineId - Get pipeline progress
 */
app.get('/api/pipeline/status/:pipelineId', (req, res) => {
    const { pipelineId } = req.params;
    const pipeline = activePipelines.get(pipelineId);
    
    if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
    }
    
    res.json({
        pipelineId,
        status: pipeline.status,
        currentStep: pipeline.currentStep,
        progress: pipeline.progress,
        logs: pipeline.logs.slice(-50), // Last 50 log entries
        error: pipeline.error,
        results: pipeline.results
    });
});

/**
 * POST /api/scan - Run scanner only
 */
app.post('/api/scan', async (req, res) => {
    const { limit = 50, maxPages = 2 } = req.body;
    
    try {
        const result = await runScanner({ limit, maxPages });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, details: err.stderr });
    }
});

/**
 * POST /api/evaluate - Run evaluator only
 */
app.post('/api/evaluate', async (req, res) => {
    try {
        const result = await runEvaluator();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, details: err.stderr });
    }
});

/**
 * POST /api/import - Run import script only
 */
app.post('/api/import', async (req, res) => {
    const { minScore = 3.0 } = req.body;
    
    try {
        const result = await runImport({ minScore });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, details: err.stderr });
    }
});

/**
 * GET /api/jobs - Get jobs data
 */
app.get('/api/jobs', (req, res) => {
    const { type = 'evaluated' } = req.query;
    
    let filePath;
    switch (type) {
        case 'raw':
            filePath = path.join(DATA_DIR, 'jobs_raw.json');
            break;
        case 'extension':
            filePath = path.join(DATA_DIR, 'extension_jobs_import.json');
            break;
        case 'evaluated':
        default:
            filePath = path.join(DATA_DIR, 'jobs_evaluated.json');
    }
    
    if (!fs.existsSync(filePath)) {
        return res.json([]);
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read jobs file' });
    }
});

// ==================== Pipeline Execution Functions ====================

async function runPipelineAsync(pipelineId, options) {
    const pipeline = {
        id: pipelineId,
        status: 'running',
        currentStep: null,
        progress: 0,
        logs: [],
        error: null,
        results: {},
        cancelled: false,
        process: null
    };
    
    activePipelines.set(pipelineId, pipeline);
    
    const log = (message) => {
        const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
        pipeline.logs.push(entry);
        console.log(`[Pipeline ${pipelineId}] ${message}`);
    };
    
    try {
        // Step 1: Scan
        if (options.scan && !pipeline.cancelled) {
            pipeline.currentStep = 'scan';
            pipeline.progress = 10;
            log('🔍 Starting scan...');
            
            try {
                const scanResult = await runScanner({ limit: 50, maxPages: 2 }, pipeline);
                pipeline.results.scan = scanResult;
                pipeline.progress = 25;
                log(`✅ Scan complete: ${scanResult.count} jobs found`);
            } catch (err) {
                log(`❌ Scan failed: ${err.message}`);
                throw err;
            }
        }
        
        // Step 2: Evaluate
        if (options.evaluate && !pipeline.cancelled) {
            pipeline.currentStep = 'evaluate';
            pipeline.progress = 30;
            log('⚖️ Starting evaluation...');
            
            try {
                const evalResult = await runEvaluator(pipeline);
                pipeline.results.evaluate = evalResult;
                pipeline.progress = 60;
                log(`✅ Evaluation complete: ${evalResult.count} jobs evaluated`);
            } catch (err) {
                log(`❌ Evaluation failed: ${err.message}`);
                throw err;
            }
        }
        
        // Step 3: Import
        if (options.import && !pipeline.cancelled) {
            pipeline.currentStep = 'import';
            pipeline.progress = 65;
            log('📥 Starting import...');
            
            try {
                const importResult = await runImport({ minScore: options.minScore }, pipeline);
                pipeline.results.import = importResult;
                pipeline.progress = 80;
                log(`✅ Import complete: ${importResult.count} jobs imported`);
            } catch (err) {
                log(`❌ Import failed: ${err.message}`);
                throw err;
            }
        }
        
        // Complete
        if (!pipeline.cancelled) {
            pipeline.status = 'complete';
            pipeline.progress = 100;
            pipeline.currentStep = null;
            log('🎉 Pipeline complete!');
        } else {
            pipeline.status = 'cancelled';
            log('⏹ Pipeline cancelled');
        }
        
    } catch (err) {
        pipeline.status = 'error';
        pipeline.error = err.message;
        log(`❌ Pipeline error: ${err.message}`);
    } finally {
        // Clean up after 5 minutes
        setTimeout(() => {
            activePipelines.delete(pipelineId);
        }, 5 * 60 * 1000);
    }
}

function runScanner(options = {}, pipeline = null) {
    return new Promise((resolve, reject) => {
        const args = [
            'scanner/llm-agnostic-scan.mjs',
            `--limit=${options.limit || 50}`,
            `--max-pages=${options.maxPages || 2}`
        ];
        
        const proc = spawn('node', args, {
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        if (pipeline) {
            pipeline.process = proc;
        }
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            if (pipeline) {
                pipeline.logs.push(`[Scanner] ${data.toString().trim()}`);
            }
        });
        
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            if (pipeline) {
                pipeline.logs.push(`[Scanner Error] ${data.toString().trim()}`);
            }
        });
        
        proc.on('close', (code) => {
            if (pipeline) pipeline.process = null;
            
            if (code !== 0) {
                reject({ message: `Scanner exited with code ${code}`, stderr });
            } else {
                // Read results
                try {
                    const rawPath = path.join(DATA_DIR, 'jobs_raw.json');
                    if (!fs.existsSync(rawPath)) {
                        resolve({ count: 0, message: 'No jobs file generated' });
                        return;
                    }
                    const jobs = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
                    resolve({ count: jobs.length, message: 'Scan complete' });
                } catch (err) {
                    resolve({ count: 0, message: 'Scan complete but could not read results' });
                }
            }
        });
        
        proc.on('error', (err) => {
            if (pipeline) pipeline.process = null;
            reject({ message: `Failed to start scanner: ${err.message}` });
        });
    });
}

function runEvaluator(pipeline = null) {
    return new Promise((resolve, reject) => {
        // Check if evaluator output already exists (OpenCode runs separately)
        const evalPath = path.join(DATA_DIR, 'jobs_evaluated.json');
        
        if (fs.existsSync(evalPath)) {
            // Check if file was modified recently (within last 5 minutes)
            const stats = fs.statSync(evalPath);
            const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
            
            if (ageMinutes < 5) {
                try {
                    const jobs = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
                    if (pipeline) {
                        pipeline.logs.push(`[Evaluator] Using recently generated evaluation (${Math.round(ageMinutes)}m old)`);
                    }
                    resolve({ count: jobs.length, message: 'Using recent evaluation' });
                    return;
                } catch (err) {
                    // Continue to error case
                }
            }
        }
        
        // OpenCode evaluator needs to be run manually - it requires user interaction
        reject({ 
            message: 'Evaluator requires manual execution. Run: cd evaluator && opencode .',
            manual: true
        });
    });
}

function runImport(options = {}, pipeline = null) {
    return new Promise((resolve, reject) => {
        const args = [
            'scripts/import-to-extension.mjs',
            `--min-score=${options.minScore || 3.0}`
        ];
        
        const proc = spawn('node', args, {
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        if (pipeline) {
            pipeline.process = proc;
        }
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            if (pipeline) {
                pipeline.logs.push(`[Import] ${data.toString().trim()}`);
            }
        });
        
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            if (pipeline) {
                pipeline.logs.push(`[Import Error] ${data.toString().trim()}`);
            }
        });
        
        proc.on('close', (code) => {
            if (pipeline) pipeline.process = null;
            
            if (code !== 0) {
                reject({ message: `Import exited with code ${code}`, stderr });
            } else {
                // Read results
                try {
                    const extPath = path.join(DATA_DIR, 'extension_jobs_import.json');
                    if (!fs.existsSync(extPath)) {
                        resolve({ count: 0, message: 'No import file generated' });
                        return;
                    }
                    const jobs = JSON.parse(fs.readFileSync(extPath, 'utf8'));
                    resolve({ count: jobs.length, message: 'Import complete' });
                } catch (err) {
                    resolve({ count: 0, message: 'Import complete but could not read results' });
                }
            }
        });
        
        proc.on('error', (err) => {
            if (pipeline) pipeline.process = null;
            reject({ message: `Failed to start import: ${err.message}` });
        });
    });
}

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 Unhireable Pipeline API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running on http://localhost:${PORT}

Endpoints:
  GET  /api/health           - Health check
  GET  /api/status          - Check data files status
  GET  /api/jobs            - Get jobs (query: type=raw|evaluated|extension)
  
  POST /api/pipeline/run     - Run full pipeline
  POST /api/pipeline/stop/:id - Stop pipeline
  GET  /api/pipeline/status/:id - Get pipeline progress
  
  POST /api/scan             - Run scanner only
  POST /api/evaluate         - Run evaluator only
  POST /api/import           - Run import only

Project root: ${PROJECT_ROOT}
    `);
});
