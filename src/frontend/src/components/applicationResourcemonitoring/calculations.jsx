export class MonitoringCalculations {
  
  // Static storage for previous readings (for Disk IO rate calculations)
  static previousReadings = {};

  // ================ CORE CALCULATION METHODS ================

  // Generate data signature for change detection
  static generateDataSignature(data, fields = []) {
    if (!data || !fields.length) return null;
    return fields.map(field => data[field] || '').join('-');
  }

  // Calculate average from array of objects for a specific key
  static calculateAverage(dataArray, key) {
    if (!dataArray || dataArray.length === 0) return 0;
    const sum = dataArray.reduce((total, item) => total + (item[key] || 0), 0);
    return sum / dataArray.length;
  }

  // Calculate multiple averages at once (for Memory with 3 metrics, Disk with 2)
  static calculateMultipleAverages(dataArray, keys = []) {
    const averages = {};
    keys.forEach(key => {
      averages[`average${key.charAt(0).toUpperCase() + key.slice(1)}`] = this.calculateAverage(dataArray, key);
    });
    return averages;
  }

  // Update metrics history with configurable size (default 2 for your components)
  static updateMetricsHistory(currentHistory, newMetrics, maxSize = 2) {
    return [...currentHistory, newMetrics].slice(-maxSize);
  }

  // Update chart data with configurable points (default 20)
  static updateChartData(currentData, newDataPoint, maxPoints = 20) {
    return [...currentData, newDataPoint].slice(-maxPoints);
  }

  // Generate timestamp in your preferred format
  static generateTimestamp(format = 'chart') {
    const now = new Date();
    switch (format) {
      case 'chart':
        return now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit", 
          second: "2-digit"
        });
      case 'datetime':
        return now.toLocaleString();
      case 'iso':
        return now.toISOString();
      default:
        return now.toLocaleTimeString("en-US", { hour12: false });
    }
  }

  // ================ METRICS PROCESSING ================

  // Simple metrics processing (CPU, Memory)
  static processSimpleMetrics(rawData, metricConfig) {
    if (!rawData || !rawData.uuid) {
      console.log("❌ No app data or UUID");
      return null;
    }

    const currentTime = Date.now();
    const processed = { timestamp: currentTime };
    
    // Process each metric according to its configuration
    Object.entries(metricConfig).forEach(([key, config]) => {
      const rawValue = rawData[config.source];
      
      switch (config.type) {
        case 'float':
          processed[key] = parseFloat(rawValue) || 0;
          break;
        case 'int':
          processed[key] = parseInt(rawValue) || 0;
          break;
        case 'string':
          processed[key] = rawValue || config.default || 'unknown';
          break;
        default:
          processed[key] = rawValue || 0;
      }
    });

    return processed;
  }

  // Rate-based metrics processing (Disk IO with time-based calculations)
  static processRateMetrics(rawData, rateConfig) {
    if (!rawData || !rawData.uuid) {
      console.log("❌ No app data or UUID");
      return null;
    }

    const currentTime = Date.now();
    const uuid = rawData.uuid;
    
    // Extract current totals
    const currentTotals = {};
    Object.entries(rateConfig.sources).forEach(([key, source]) => {
      currentTotals[key] = parseFloat(rawData[source]) || 0;
    });

    console.log("🔍 DEBUG RATE CALCULATION:", {
      uuid: uuid.slice(0, 8),
      appName: rawData.name,
      currentTotals,
      timestamp: new Date(currentTime).toLocaleTimeString()
    });

    const prevReading = this.previousReadings[uuid];

    if (prevReading) {
      const timeDiffMs = currentTime - prevReading.timestamp;
      const timeDiffSec = timeDiffMs / 1000;

      console.log("⏱️ Time difference:", timeDiffSec, "seconds");

      // Require minimum time difference (configurable, default 2 seconds)
      if (timeDiffSec >= (rateConfig.minTimeDiff || 2.0)) {
        const rates = {};
        
        // Calculate rates for each metric
        Object.entries(rateConfig.sources).forEach(([key, source]) => {
          const diff = currentTotals[key] - prevReading.totals[key];
          rates[rateConfig.rateKeys[key]] = Math.max(0, diff / timeDiffSec);
        });

        // Add any additional calculated metrics
        if (rateConfig.additionalMetrics) {
          Object.assign(rates, rateConfig.additionalMetrics(rates, rawData));
        }

        console.log("📈 CALCULATED RATES:", rates);

        // Update previous readings
        this.previousReadings[uuid] = {
          totals: currentTotals,
          timestamp: currentTime
        };

        return {
          ...rates,
          timestamp: currentTime
        };
      } else {
        console.log("⏸️ Time difference too small, waiting...", timeDiffSec);
        return null; // Don't update if time difference is too small
      }
    } else {
      console.log("🆕 First sample - storing for next calculation");
    }

    // Store first reading
    this.previousReadings[uuid] = {
      totals: currentTotals,
      timestamp: currentTime
    };

    // Return initial state (usually zeros or fallback values)
    const initialRates = {};
    Object.values(rateConfig.rateKeys).forEach(key => {
      initialRates[key] = 0;
    });

    // Add any additional initial metrics
    if (rateConfig.additionalMetrics) {
      Object.assign(initialRates, rateConfig.additionalMetrics(initialRates, rawData));
    }

    return {
      ...initialRates,
      timestamp: currentTime
    };
  }

  // ================ FORMATTING UTILITIES ================

  // Format KB to human readable (for Memory)
  static formatKB(kb, decimals = 2) {
    if (kb === 0) return '0 MB';
    const mb = kb / 1024;
    if (mb >= 1000) {
      return `${(mb / 1024).toFixed(decimals)} GB`;
    }
    return `${mb.toFixed(decimals)} MB`;
  }

  // Format bytes per second (for Disk IO)
  static formatBytesPerSecond(bytesPerSec, decimals = 2) {
    if (bytesPerSec === 0) return '0 B/sec';
    
    const absBytes = Math.abs(bytesPerSec);
    
    if (absBytes >= 1024 * 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(decimals)} GB/sec`;
    } else if (absBytes >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(decimals)} MB/sec`;
    } else if (absBytes >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(decimals)} KB/sec`;
    } else {
      return `${Math.round(bytesPerSec)} B/sec`;
    }
  }

  // Format bytes to human readable (general purpose)
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  // Calculate percentage with bounds checking
  static calculatePercentage(value, total, decimals = 2) {
    if (!total || total === 0) return 0;
    const percentage = (value / total) * 100;
    return Math.min(Math.max(percentage, 0), 100).toFixed(decimals);
  }

  // ================ UNIVERSAL COMPONENT PROCESSING ================

  // Complete processing pipeline for any IO component
  static processComponentMetrics({
    selectedAppData,
    lastProcessedData,
    config,
    onMetricsUpdate,
    onHistoryUpdate,
    onChartUpdate,
    componentName = 'Component'
  }) {
    
    if (!selectedAppData) return { shouldProcess: false };

    // Generate data signature
    const dataSignature = this.generateDataSignature(selectedAppData, config.signatureFields);
    
    console.log(`🔍 ${componentName} Data signature check:`, {
      current: dataSignature,
      last: lastProcessedData,
      isNew: dataSignature !== lastProcessedData
    });

    // Only process if data actually changed
    if (dataSignature !== lastProcessedData) {
      console.log(`✅ New ${componentName} data detected, processing...`);
      
      let metrics;
      
      // Choose processing method based on component type
      if (config.type === 'rate') {
        metrics = this.processRateMetrics(selectedAppData, config.rateConfig);
      } else {
        metrics = this.processSimpleMetrics(selectedAppData, config.metricConfig);
      }
      
      if (metrics) {
        // Update current metrics
        onMetricsUpdate(prev => ({ ...prev, ...metrics }));

        // For rate-based components, only update history/chart if we have valid rates
        const shouldUpdateChart = config.type === 'rate' ? 
          (metrics[Object.values(config.rateConfig?.rateKeys || {})[0]] > 0) : 
          true;

        if (shouldUpdateChart) {
          console.log(`📊 Adding ${componentName} metrics to history and chart`);
          
          // Update history and calculate averages
          onHistoryUpdate(prev => {
            const updated = this.updateMetricsHistory(prev, metrics, 2);
            
            console.log(`📈 ${componentName} metrics history (last 2 samples):`, updated);
            
            // Calculate averages for specified fields
            const averages = this.calculateMultipleAverages(updated, config.averagingFields);
            
            console.log(`📊 2-Sample ${componentName} averages:`, averages);
            
            // Update calculated metrics with averages
            onMetricsUpdate(current => ({ ...current, ...averages }));

            return updated;
          });

          // Update chart data
          const timestamp = this.generateTimestamp('chart');
          const chartDataPoint = { time: timestamp, ...config.chartDataMapping(metrics) };
          
          onChartUpdate(prev => this.updateChartData(prev, chartDataPoint, 20));
        } else {
          console.log(`⏸️ ${componentName}: First sample or zero rates, waiting for next update`);
        }
      }

      return { shouldProcess: true, newSignature: dataSignature };
    } else {
      console.log(`⏭️ Same ${componentName} data, skipping calculation`);
      return { shouldProcess: false };
    }
  }
}
