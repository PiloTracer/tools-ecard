/**
 * Batch Parsing Service
 * Node.js integration layer for Python batch parser
 * Spawns Python process to parse batch files and store to hybrid database
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appConfig } from '../../../core/config';
import { createLogger } from '../../../core/utils/logger';

const log = createLogger('BatchParsing');

/**
 * Resolve a file inside the api-server/batch-parsing directory.
 * Dev runs unbundled (src/features/batch-parsing/services → up 4 = app root),
 * but the prd image bundles to a single dist/server.js — there __dirname is
 * /app/dist and the up-4 relative path lands at '/'. Fall back to the process
 * working directory (the app root in every deployment).
 */
function resolveBatchParsingPath(filename: string): string {
  const fromDirname = path.join(__dirname, '../../../../batch-parsing', filename);
  if (fs.existsSync(fromDirname)) {
    return fromDirname;
  }
  return path.join(process.cwd(), 'batch-parsing', filename);
}

// Exported for the batch-import mapping helpers (canonical snapshot lookup).
export { resolveBatchParsingPath };

/** Minimal structural shape of an explicit field-mapping entry (Pass 3). */
export interface ExplicitFieldMapping {
  sourceColumn: string;
  targetField: string;
}

export interface BatchParsingOptions {
  batchId: string;
  filePath: string;
  verbose?: boolean;
  workPhonePrefix?: string;      // e.g., "2222" for Costa Rica landlines
  defaultCountryCode?: string;   // e.g., "+(506)" for Costa Rica
  /** Max records to import; -1 = unlimited */
  maxRecords?: number;
  /** Explicit user field mapping (Pass 3); consulted by the parser before auto-mapping */
  mapping?: ExplicitFieldMapping[];
}

export interface BatchParsingResult {
  success: boolean;
  records_total?: number;
  records_processed?: number;
  /** Headers no mapping pass claimed; values are kept in each record's `extra` map. */
  unmapped_columns?: string[];
  error?: string;
}

export class BatchParsingService {
  private pythonPath: string;
  private parserScriptPath: string;
  private postgresUrl: string;
  private cassandraHosts: string;
  private cassandraKeyspace: string;

  constructor() {
    // Python executable path (use 'python3' or 'python' depending on system)
    this.pythonPath = process.env.PYTHON_PATH || 'python3';

    // Path to parser.py script (bundle-safe — see resolveBatchParsingPath)
    this.parserScriptPath = resolveBatchParsingPath('parser.py');

    // Database connection parameters
    this.postgresUrl = process.env.DATABASE_URL || '';
    this.cassandraHosts = process.env.CASSANDRA_HOSTS || 'cassandra';
    this.cassandraKeyspace = process.env.CASSANDRA_KEYSPACE || 'ecards';
  }

  /**
   * Parse a batch file using Python parser
   * Spawns a child process and waits for completion
   */
  async parseBatch(options: BatchParsingOptions): Promise<BatchParsingResult> {
    const { batchId, filePath, verbose = false, workPhonePrefix, defaultCountryCode, maxRecords, mapping } = options;

    return new Promise((resolve, reject) => {
      // Determine storage mode from environment
      const storageMode = process.env.USE_LOCAL_STORAGE === 'true' ? 'local' : 'seaweedfs';

      const args = [
        this.parserScriptPath,
        '--batch-id', batchId,
        '--file-path', filePath,
        '--postgres-url', this.postgresUrl,
        '--cassandra-hosts', this.cassandraHosts,
        '--cassandra-keyspace', this.cassandraKeyspace,
        '--storage-mode', storageMode
      ];

      // Explicit user mapping (Pass 3): written to a temp JSON file the Python
      // parser validates and consults before its auto-mapping passes.
      let mappingTempPath: string | null = null;
      if (mapping && mapping.length > 0) {
        mappingTempPath = path.join(
          os.tmpdir(),
          `batch-mapping-${batchId}-${Date.now()}.json`
        );
        fs.writeFileSync(
          mappingTempPath,
          JSON.stringify({
            mappings: mapping.map((m) => ({
              source_column: m.sourceColumn,
              target_field: m.targetField,
            })),
          })
        );
        args.push('--mapping', mappingTempPath);
      }

      // Add phone formatting configuration if provided
      if (workPhonePrefix) {
        args.push('--work-phone-prefix', workPhonePrefix);
      }
      if (defaultCountryCode) {
        args.push('--default-country-code', defaultCountryCode);
      }
      if (maxRecords !== undefined && maxRecords >= 0) {
        args.push('--max-records', String(maxRecords));
      }

      if (verbose) {
        args.push('--verbose');
      }

      log.info({ batchId, storageMode, filePath }, 'Spawning Python parser for batch');

      const pythonProcess = spawn(this.pythonPath, args, {
        cwd: path.dirname(this.parserScriptPath),
        env: {
          ...process.env,
          // Ensure Python has access to SeaweedFS config
          SEAWEEDFS_ENDPOINT: process.env.SEAWEEDFS_ENDPOINT || '',
          SEAWEEDFS_BUCKET: process.env.SEAWEEDFS_BUCKET || 'repositories',
          SEAWEEDFS_ACCESS_KEY: process.env.SEAWEEDFS_ACCESS_KEY || '',
          SEAWEEDFS_SECRET_KEY: process.env.SEAWEEDFS_SECRET_KEY || '',
          SEAWEEDFS_REGION: process.env.SEAWEEDFS_REGION || 'us-east-1',
          LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || '/app/uploads'
        }
      });

      let stdoutData = '';
      let stderrData = '';

      // Collect stdout (contains JSON result)
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        if (verbose) {
          log.debug({ batchId, output: data.toString().trim() }, 'Python stdout');
        }
      });

      // Collect stderr (logs and errors). NOTE: Python's logging writes INFO/WARNING
      // to stderr by default, so stderr output is not necessarily an error — real
      // failures are reported on non-zero exit below.
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        log.warn({ batchId, output: data.toString().trim() }, 'Python stderr');
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (mappingTempPath) {
          fs.promises.unlink(mappingTempPath).catch(() => undefined);
        }
        if (code === 0) {
          // Success - parse JSON result from stdout
          try {
            // Extract JSON from stdout (last line should be JSON)
            const lines = stdoutData.trim().split('\n');
            const jsonLine = lines[lines.length - 1];
            const result = JSON.parse(jsonLine) as BatchParsingResult;

            log.info({
              batchId,
              recordsProcessed: result.records_processed,
              recordsTotal: result.records_total
            }, 'Batch parsed successfully');
            resolve(result);
          } catch (error) {
            log.error({ error, batchId, stdoutData }, 'Failed to parse Python output');
            resolve({
              success: false,
              error: `Failed to parse output: ${stdoutData}`
            });
          }
        } else {
          // Error
          log.error({ code, stderrData, batchId }, 'Python parser exited with error');

          // Try to extract JSON error from stdout
          try {
            const lines = stdoutData.trim().split('\n');
            const jsonLine = lines[lines.length - 1];
            const result = JSON.parse(jsonLine) as BatchParsingResult;
            resolve(result);
          } catch (error) {
            resolve({
              success: false,
              error: stderrData || `Python process exited with code ${code}`
            });
          }
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        log.error({ error, batchId }, 'Failed to start Python process');
        reject(new Error(`Failed to start Python parser: ${error.message}`));
      });
    });
  }

  /**
   * Inspect a LOCAL file's columns via the Python parser's --inspect mode
   * (Pass 3 preview): per-column auto-mapping + sample values, no DB access.
   * Single source of truth for header scoring — the TS side never reimplements it.
   */
  async inspectFile(localFilePath: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const args = [this.parserScriptPath, '--inspect', '--file-path', localFilePath];

      const pythonProcess = spawn(this.pythonPath, args, {
        cwd: path.dirname(this.parserScriptPath),
        env: { ...process.env },
      });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        try {
          const lines = stdoutData.trim().split('\n');
          const result = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
          resolve(result);
        } catch {
          resolve({
            success: false,
            error: stderrData || `Python inspect exited with code ${code}`,
          });
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python inspect: ${error.message}`));
      });
    });
  }

  /**
   * Check if Python parser dependencies are installed
   */
  async checkDependencies(): Promise<boolean> {
    return new Promise((resolve) => {
      const pythonProcess = spawn(this.pythonPath, [
        '-c',
        'import pandas, chardet, nameparser, phonenumbers, psycopg2, cassandra'
      ]);

      pythonProcess.on('close', (code) => {
        resolve(code === 0);
      });

      pythonProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Install Python dependencies from requirements.txt
   */
  async installDependencies(): Promise<void> {
    const requirementsPath = resolveBatchParsingPath('requirements.txt');

    return new Promise((resolve, reject) => {
      log.info('Installing Python dependencies');

      const pipProcess = spawn(this.pythonPath, [
        '-m',
        'pip',
        'install',
        '-r',
        requirementsPath
      ]);

      pipProcess.stdout.on('data', (data) => {
        log.debug({ output: data.toString().trim() }, 'pip output');
      });

      pipProcess.stderr.on('data', (data) => {
        log.error({ output: data.toString().trim() }, 'pip error');
      });

      pipProcess.on('close', (code) => {
        if (code === 0) {
          log.info('Python dependencies installed');
          resolve();
        } else {
          log.error({ code }, 'Failed to install dependencies');
          reject(new Error(`Failed to install dependencies (exit code: ${code})`));
        }
      });

      pipProcess.on('error', (error) => {
        reject(new Error(`Failed to run pip: ${error.message}`));
      });
    });
  }
}

// Export singleton instance
export const batchParsingService = new BatchParsingService();
