// configs/monitoringConfigs.js

export const CPU_CONFIG = {
  type: 'simple',
  signatureFields: ['cpu_average', 'threads', 'status', 'updated_at'],
  metricConfig: {
    cpuPercent: { source: 'cpu_average', type: 'float' },
    threads: { source: 'threads', type: 'int' },
    status: { source: 'status', type: 'string', default: 'unknown' }
  },
  averagingFields: ['cpuPercent'],
  chartDataMapping: (metrics) => ({
    cpu: metrics.cpuPercent
  })
};

export const MEMORY_CONFIG = {
  type: 'simple',
  signatureFields: ['commit_kb', 'working_set_kb', 'private_kb', 'updated_at'],
  metricConfig: {
    commitKb: { source: 'commit_kb', type: 'float' },
    workingSetKb: { source: 'working_set_kb', type: 'float' },
    privateKb: { source: 'private_kb', type: 'float' }
  },
  averagingFields: ['commitKb', 'workingSetKb', 'privateKb'],
  chartDataMapping: (metrics) => ({
    commit: metrics.commitKb,
    working_set: metrics.workingSetKb,
    private: metrics.privateKb
  })
};

export const DISK_CONFIG = {
  type: 'rate',
  signatureFields: ['read_b_sec', 'write_b_sec', 'updated_at'],
  rateConfig: {
    sources: {
      read: 'read_b_sec',
      write: 'write_b_sec'
    },
    rateKeys: {
      read: 'readBytesPerSec',
      write: 'writeBytesPerSec'
    },
    minTimeDiff: 2.0, // Minimum 2 seconds between samples
    additionalMetrics: (rates, rawData) => ({
      responseTime: Math.min((rates.readBytesPerSec + rates.writeBytesPerSec) / (1024 * 1024) * 10, 200)
    })
  },
  averagingFields: ['readBytesPerSec', 'writeBytesPerSec'],
  chartDataMapping: (metrics) => ({
    read: metrics.readBytesPerSec,
    write: metrics.writeBytesPerSec
  })
};
