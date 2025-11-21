/**
 * Mode Detection Service
 * Detects and manages storage modes (FULL, FALLBACK, LOCAL_ONLY)
 */

import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { cassandraClient, StorageMode } from '../../../core/cassandra/client';
import { checkDatabaseHealth } from '../../../core/prisma/client';
import { getS3Service } from '../../s3-bucket/services/s3Service';

export interface ModeDetectionResult {
  mode: StorageMode;
  seaweedfsAvailable: boolean;
  fallbackAvailable: boolean;
  postgresqlAvailable: boolean;
  cassandraAvailable: boolean;
  timestamp: Date;
  details: {
    seaweedfsLatency?: number;
    fallbackPath?: string;
    fallbackFreeSpace?: number;
    errors: string[];
  };
}

export interface ServiceHealth {
  backend: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  latency?: number;
  errorRate?: number;
  freeSpace?: number;
  lastChecked: Date;
}

class ModeDetectionService {
  private currentMode: StorageMode = StorageMode.LOCAL_ONLY;
  private lastCheck: Date | null = null;
  private checkInterval = 30000; // 30 seconds
  private fallbackPath = '.local-storage';
  private healthCheckTimeout = 5000; // 5 seconds
  private monitoringInterval: NodeJS.Timeout | null = null;
  private modeChangeCallbacks: ((mode: StorageMode) => void)[] = [];

  constructor() {
    this.initializeFallbackStorage();
  }

  /**
   * Initialize fallback storage directory
   */
  private async initializeFallbackStorage(): Promise<void> {
    try {
      const fullPath = path.resolve(this.fallbackPath);

      // Create directory structure
      await fs.mkdir(fullPath, { recursive: true, mode: 0o755 });
      await fs.mkdir(path.join(fullPath, 'users'), { recursive: true });
      await fs.mkdir(path.join(fullPath, 'temp'), { recursive: true });
      await fs.mkdir(path.join(fullPath, 'resources'), { recursive: true });

      console.log(`Fallback storage initialized at: ${fullPath}`);
    } catch (error) {
      console.error('Failed to initialize fallback storage:', error);
    }
  }

  /**
   * Detect current storage mode
   */
  async detectMode(): Promise<ModeDetectionResult> {
    const errors: string[] = [];
    const startTime = Date.now();

    // Check PostgreSQL
    const postgresqlAvailable = await this.checkPostgreSQL();
    if (!postgresqlAvailable) {
      errors.push('PostgreSQL unavailable');
    }

    // Check Cassandra
    const cassandraAvailable = await this.checkCassandra();
    if (!cassandraAvailable) {
      errors.push('Cassandra unavailable');
    }

    // Check SeaweedFS
    const { available: seaweedfsAvailable, latency: seaweedfsLatency } = await this.checkSeaweedFS();
    if (!seaweedfsAvailable) {
      errors.push('SeaweedFS unavailable');
    }

    // Check fallback storage
    const { available: fallbackAvailable, freeSpace: fallbackFreeSpace } = await this.checkFallbackStorage();
    if (!fallbackAvailable) {
      errors.push('Fallback storage unavailable');
    }

    // Determine mode based on availability
    let mode: StorageMode;

    if (postgresqlAvailable && cassandraAvailable && seaweedfsAvailable) {
      mode = StorageMode.FULL;
    } else if (postgresqlAvailable && cassandraAvailable && fallbackAvailable) {
      mode = StorageMode.FALLBACK;
    } else {
      // If essential services are down, we can't operate properly
      // This would typically not happen as LOCAL_ONLY is handled client-side
      mode = StorageMode.LOCAL_ONLY;
    }

    // Log mode change if needed
    if (mode !== this.currentMode) {
      await this.logModeChange(this.currentMode, mode, errors);
      this.currentMode = mode;
      this.notifyModeChange(mode);
    }

    // Log health metrics
    await this.logHealthMetrics({
      seaweedfs: seaweedfsAvailable,
      fallback: fallbackAvailable,
      postgresql: postgresqlAvailable,
      cassandra: cassandraAvailable,
      latency: seaweedfsLatency,
      freeSpace: fallbackFreeSpace
    });

    this.lastCheck = new Date();

    return {
      mode,
      seaweedfsAvailable,
      fallbackAvailable,
      postgresqlAvailable,
      cassandraAvailable,
      timestamp: new Date(),
      details: {
        seaweedfsLatency,
        fallbackPath: this.fallbackPath,
        fallbackFreeSpace,
        errors
      }
    };
  }

  /**
   * Check SeaweedFS availability
   */
  private async checkSeaweedFS(): Promise<{ available: boolean; latency?: number }> {
    if (process.env.USE_LOCAL_STORAGE === 'true') {
      return { available: false };
    }

    const startTime = Date.now();

    try {
      const s3Service = getS3Service();
      const bucketName = process.env.SEAWEEDFS_BUCKET || 'ecards';

      // Try to check if bucket exists (this is a lightweight operation)
      const exists = await Promise.race([
        s3Service.bucketExists(bucketName),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.healthCheckTimeout)
        )
      ]);

      const latency = Date.now() - startTime;

      return {
        available: exists,
        latency
      };
    } catch (error) {
      console.warn('SeaweedFS health check failed:', error);
      return { available: false };
    }
  }

  /**
   * Check fallback storage availability
   */
  private async checkFallbackStorage(): Promise<{ available: boolean; freeSpace?: number }> {
    try {
      const fullPath = path.resolve(this.fallbackPath);

      // Check if directory exists and is writable
      await fs.access(fullPath, fs.constants.W_OK);

      // Get disk space (platform-specific)
      const stats = await fs.stat(fullPath);

      // Note: Getting actual free space requires platform-specific solutions
      // For now, we'll just check if the directory is accessible

      return {
        available: true,
        freeSpace: undefined // Would need disk-usage package for accurate info
      };
    } catch (error) {
      console.warn('Fallback storage check failed:', error);
      return { available: false };
    }
  }

  /**
   * Check PostgreSQL availability
   */
  private async checkPostgreSQL(): Promise<boolean> {
    try {
      return await Promise.race([
        checkDatabaseHealth(),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), this.healthCheckTimeout)
        )
      ]);
    } catch (error) {
      console.warn('PostgreSQL health check failed:', error);
      return false;
    }
  }

  /**
   * Check Cassandra availability
   */
  private async checkCassandra(): Promise<boolean> {
    try {
      return await Promise.race([
        cassandraClient.healthCheck(),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), this.healthCheckTimeout)
        )
      ]);
    } catch (error) {
      console.warn('Cassandra health check failed:', error);
      return false;
    }
  }

  /**
   * Log mode change to Cassandra
   */
  private async logModeChange(fromMode: StorageMode, toMode: StorageMode, errors: string[]): Promise<void> {
    try {
      await cassandraClient.logModeTransition({
        userId: 'system', // System-level transition
        fromMode,
        toMode,
        trigger: 'auto',
        reason: errors.length > 0 ? errors.join(', ') : 'Service availability change',
        transitionTime: new Date(),
        success: true,
        errorDetails: errors.length > 0 ? JSON.stringify(errors) : undefined
      });
    } catch (error) {
      console.error('Failed to log mode transition:', error);
    }
  }

  /**
   * Log health metrics to Cassandra
   */
  private async logHealthMetrics(metrics: {
    seaweedfs: boolean;
    fallback: boolean;
    postgresql: boolean;
    cassandra: boolean;
    latency?: number;
    freeSpace?: number;
  }): Promise<void> {
    const backends = [
      { name: 'seaweedfs', available: metrics.seaweedfs, latency: metrics.latency },
      { name: 'fallback', available: metrics.fallback, freeSpace: metrics.freeSpace },
      { name: 'postgresql', available: metrics.postgresql },
      { name: 'cassandra', available: metrics.cassandra }
    ];

    for (const backend of backends) {
      try {
        await cassandraClient.logStorageHealth({
          backend: backend.name,
          checkTime: new Date(),
          status: backend.available ? 'healthy' : 'unavailable',
          latencyMs: backend.latency,
          freeSpaceBytes: backend.freeSpace,
          metadataJson: JSON.stringify({
            mode: this.currentMode,
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error(`Failed to log health for ${backend.name}:`, error);
      }
    }
  }

  /**
   * Get current mode
   */
  getCurrentMode(): StorageMode {
    return this.currentMode;
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<ServiceHealth[]> {
    const result = await this.detectMode();

    return [
      {
        backend: 'seaweedfs',
        status: result.seaweedfsAvailable ? 'healthy' : 'unavailable',
        latency: result.details.seaweedfsLatency,
        lastChecked: new Date()
      },
      {
        backend: 'fallback',
        status: result.fallbackAvailable ? 'healthy' : 'unavailable',
        freeSpace: result.details.fallbackFreeSpace,
        lastChecked: new Date()
      },
      {
        backend: 'postgresql',
        status: result.postgresqlAvailable ? 'healthy' : 'unavailable',
        lastChecked: new Date()
      },
      {
        backend: 'cassandra',
        status: result.cassandraAvailable ? 'healthy' : 'unavailable',
        lastChecked: new Date()
      }
    ];
  }

  /**
   * Start mode monitoring
   */
  startModeMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      await this.detectMode();
    }, this.checkInterval);

    // Initial detection
    this.detectMode();
  }

  /**
   * Stop mode monitoring
   */
  stopModeMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Register callback for mode changes
   */
  onModeChange(callback: (mode: StorageMode) => void): void {
    this.modeChangeCallbacks.push(callback);
  }

  /**
   * Notify all registered callbacks of mode change
   */
  private notifyModeChange(mode: StorageMode): void {
    this.modeChangeCallbacks.forEach(callback => {
      try {
        callback(mode);
      } catch (error) {
        console.error('Error in mode change callback:', error);
      }
    });
  }

  /**
   * Force mode (for testing purposes)
   */
  async forceMode(mode: StorageMode): Promise<void> {
    const previousMode = this.currentMode;
    this.currentMode = mode;

    await this.logModeChange(previousMode, mode, ['Manually forced']);
    this.notifyModeChange(mode);
  }

  /**
   * Check if SeaweedFS is available (quick check)
   */
  async isSeaweedFSAvailable(): Promise<boolean> {
    const { available } = await this.checkSeaweedFS();
    return available;
  }

  /**
   * Check if fallback storage is available (quick check)
   */
  async isFallbackAvailable(): Promise<boolean> {
    const { available } = await this.checkFallbackStorage();
    return available;
  }

  /**
   * Get fallback storage path
   */
  getFallbackPath(): string {
    return path.resolve(this.fallbackPath);
  }
}

// Export singleton instance
export const modeDetectionService = new ModeDetectionService();

// Export types
export { StorageMode } from '../../../core/cassandra/client';