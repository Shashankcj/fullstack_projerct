from datetime import timedelta, datetime
from django.utils.timezone import now, localtime, is_naive, make_aware, get_current_timezone
from ....models import CpuMonitoring, MemoryMonitoring, DiskMonitoring
from dateutil.relativedelta import relativedelta
from django.utils.dateparse import parse_datetime
from django.db.models import Avg, Q, Case, When, FloatField, Count, Value
from django.db.models.functions import Cast, Replace, TruncWeek
from django.core.cache import cache
from django.conf import settings
import logging
from typing import Dict, List, Tuple, Optional, Type, Any
from decimal import InvalidOperation
import time
from functools import wraps

logger = logging.getLogger(__name__)

# ============= UNIFIED CONFIGURATION =============
UNIFIED_MONITORING_CONFIG = getattr(settings, 'UNIFIED_MONITORING_CONFIG', {
    'CACHE_TIMEOUT': {
        'minutely': 0,      # No caching for real-time data
        'hourly': 300,      # 5 minutes
        'daily': 3600,      # 1 hour
        'weekly': 21600,    # 6 hours
        'monthly': 86400,   # 24 hours
        'custom': 600       # 10 minutes
    },
    'MAX_RANGE_DAYS': 730,
    'SLOW_QUERY_THRESHOLD': 5.0,
    'MAX_FAILURES': 5,
    'CIRCUIT_BREAKER_TIMEOUT': 300,
    'ENABLE_QUERY_LOGGING': True,
    'ENABLE_PERFORMANCE_MONITORING': True,
    'ADAPTIVE_THRESHOLDS': {
        'HOURLY_TO_DAILY_HOURS': 48,
        'DAILY_TO_WEEKLY_DAYS': 90,
    }
})

def parse_iso_datetime(datetime_str: str):
    """Parse ISO 8601 datetime string and make it timezone-aware"""
    try:
        dt = parse_datetime(datetime_str)
        if dt is None:
            raise ValueError(f"Could not parse datetime string: {datetime_str}")
        
        if is_naive(dt):
            dt = make_aware(dt, timezone=get_current_timezone())
        return dt
    except Exception as e:
        logger.error(f"Error parsing datetime {datetime_str}: {e}")
        raise ValueError(f"Invalid datetime format: {datetime_str}")

def monitor_performance(func):
    """Decorator to monitor function performance"""
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        if not UNIFIED_MONITORING_CONFIG.get('ENABLE_PERFORMANCE_MONITORING', True):
            return func(self, *args, **kwargs)
            
        start_time = time.time()
        method_name = func.__name__
        
        try:
            result = func(self, *args, **kwargs)
            execution_time = time.time() - start_time
            
            resource_id = getattr(self.resource, 'id', 'unknown') if self.resource else 'unknown'
            logger.info(f"{self.resource_type.upper()} Stats {method_name} completed in {execution_time:.2f}s for {self.resource_type} {resource_id}")
            
            slow_threshold = UNIFIED_MONITORING_CONFIG.get('SLOW_QUERY_THRESHOLD', 5.0)
            if execution_time > slow_threshold:
                logger.warning(f"SLOW QUERY: {method_name} took {execution_time:.2f}s (threshold: {slow_threshold}s)")
            
            self._record_success(method_name)
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"{self.resource_type.upper()} Stats {method_name} failed after {execution_time:.2f}s: {e}")
            self._record_failure(method_name)
            raise
            
    return wrapper

class UnifiedMonitoringStatsCalculator:
    """Unified statistics calculator for CPU, Memory, Disk monitoring with absolute time ranges"""
    
    def __init__(self, resource, resource_type: str, model_class: Type, utilization_field: str):
        self.resource = resource
        self.resource_type = resource_type
        self.model_class = model_class
        self.utilization_field = utilization_field
        
        # Set utilization bounds
        self.MAX_UTILIZATION = 100.0
        self.MIN_UTILIZATION = 0.0
        
        # Dynamic cache prefix
        if hasattr(resource, 'id') and resource:
            self.cache_prefix = f"{resource_type}_stats_{resource.id}"
        elif resource is not None:
            self.cache_prefix = f"{resource_type}_stats_{resource}"
        else:
            self.cache_prefix = f"{resource_type}_stats_none"
            
        # Configuration
        self.cache_timeout = UNIFIED_MONITORING_CONFIG.get('CACHE_TIMEOUT', {})
        self.max_failures = UNIFIED_MONITORING_CONFIG.get('MAX_FAILURES', 5)
        self.circuit_timeout = UNIFIED_MONITORING_CONFIG.get('CIRCUIT_BREAKER_TIMEOUT', 300)
        self.adaptive_thresholds = UNIFIED_MONITORING_CONFIG.get('ADAPTIVE_THRESHOLDS', {
            'HOURLY_TO_DAILY_HOURS': 48,
            'DAILY_TO_WEEKLY_DAYS': 90,
        })
        
        # Metadata storage
        self._last_calculation_metadata = {}

    @classmethod
    def create(cls, resource, resource_type: str, model_class: Type, utilization_field: str):
        """Factory method with validation"""
        if resource is None:
            logger.warning(f"{resource_type} is None, returning empty calculator")
            
        return cls(resource, resource_type, model_class, utilization_field)

    # ============= CIRCUIT BREAKER METHODS =============
    def _is_circuit_open(self, operation: str) -> bool:
        """Check if circuit breaker is open for an operation"""
        failure_key = f"{self.cache_prefix}_failures_{operation}"
        failures = cache.get(failure_key, 0)
        
        if failures >= self.max_failures:
            logger.warning(f"Circuit breaker OPEN for {operation}: {failures} failures")
            return True
        return False

    def _record_failure(self, operation: str):
        """Record a failure for circuit breaker"""
        failure_key = f"{self.cache_prefix}_failures_{operation}"
        failures = cache.get(failure_key, 0) + 1
        cache.set(failure_key, failures, self.circuit_timeout)
        logger.warning(f"Recorded failure for {operation}: total {failures}")

    def _record_success(self, operation: str):
        """Reset failure count on success"""
        failure_key = f"{self.cache_prefix}_failures_{operation}"
        cache.delete(failure_key)

    # ============= CACHING METHODS =============
    def _get_cached_or_calculate(self, cache_key: str, calculation_func, cache_type: str):
        """Generic method for caching calculations"""
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            logger.debug(f"Cache hit for {cache_key}")
            return cached_result
            
        result = calculation_func()
        if result:  # Only cache successful results
            timeout = self.cache_timeout.get(cache_type, 300)
            cache.set(cache_key, result, timeout)
            logger.debug(f"Cached result for {cache_key} (TTL: {timeout}s)")
            
        return result

    # ============= VALIDATION METHODS =============
    def _validate_date_inputs(self, start_date_str: str, end_date_str: str, granularity: str = None) -> Tuple[bool, str]:
        """Comprehensive date validation with proper ISO8601 datetime parsing"""
        try:
            # Input validation with robust datetime parsing
            try:
                start_dt = parse_iso_datetime(start_date_str)
                end_dt = parse_iso_datetime(end_date_str)
            except ValueError as e:
                return False, f"Invalid datetime format: {e}"
            
            start = localtime(start_dt)
            end = localtime(end_dt)
            
            if start >= end:
                return False, "Start datetime must be earlier than end datetime"
            
            now_local = localtime(now())
            if end > now_local:
                return False, "End datetime cannot be in the future"
            
            # Granularity-specific validation
            if granularity == 'minutely':
                time_diff = end - start
                minutes_diff = time_diff.total_seconds() / 60
                
                if minutes_diff > 60:
                    return False, f"Minutely granularity is limited to 60 minutes maximum. Requested: {minutes_diff:.1f} minutes"
                if minutes_diff < 1:
                    return False, "Minutely granularity requires at least 1 minute range"
                if start.date() != end.date():
                    return False, "For minutely granularity, start and end must be on the same day"
            else:
                # Check maximum range for other granularities
                max_days = UNIFIED_MONITORING_CONFIG.get('MAX_RANGE_DAYS', 730)
                days_diff = (end - start).days
                if days_diff > max_days:
                    return False, f"Date range cannot exceed {max_days} days"
                    
                if (end - start).total_seconds() < 3600:
                    return False, "Date range must be at least 1 hour"
            
            # Check if dates are too old (3 years limit)
            three_years_ago = now_local - timedelta(days=365*3)
            if start < three_years_ago:
                return False, "Start date cannot be more than 3 years in the past"
                
            return True, ""
            
        except Exception as e:
            logger.error(f"Date validation error: {e}")
            return False, f"Date validation failed: {e}"

    # ============= DATABASE METHODS =============
    def _parse_util(self, val) -> float:
        """Enhanced utility parsing with better error handling"""
        if val is None:
            return 0.0
            
        try:
            if isinstance(val, str):
                cleaned = val.replace('%', '').strip()
                if not cleaned:
                    return 0.0
                parsed = float(cleaned)
            else:
                parsed = float(val)
                
            if parsed < self.MIN_UTILIZATION:
                return self.MIN_UTILIZATION
            elif parsed > self.MAX_UTILIZATION:
                return self.MAX_UTILIZATION
                
            return round(parsed, 2)
            
        except (ValueError, TypeError, InvalidOperation) as e:
            logger.error(f"Failed to parse {self.resource_type} utilization value '{val}': {e}")
            return 0.0

    def _get_base_queryset(self):
        """Enhanced base queryset with better error handling"""
        if self.resource is None:
            return self.model_class.objects.none()
            
        try:
            # Dynamic field name based on resource type
            if self.resource_type == 'cpu':
                filter_field = 'cpu'
            elif self.resource_type == 'memory':
                filter_field = 'memory'
            elif self.resource_type == 'disk':
                filter_field = 'storage_disk'  # Special case for disk
            else:
                filter_field = self.resource_type
            
            return self.model_class.objects.filter(**{filter_field: self.resource}) \
                .select_related('checkpoint') \
                .order_by('checkpoint__created_at')
                
        except Exception as e:
            logger.error(f"Error creating base queryset: {e}")
            return self.model_class.objects.none()

    def _get_avg_annotation(self):
        """Helper method to get the average annotation for utilization"""
        return Avg(
            Case(
                When(**{f"{self.utilization_field}__isnull": True}, then=0.0),
                When(**{f"{self.utilization_field}__exact": ''}, then=0.0),
                default=Cast(
                    Replace(self.utilization_field, Value('%'), Value('')), 
                    FloatField()
                ),
                output_field=FloatField(),
            )
        )

    def _calculate_average_db(self, queryset) -> float:
        """Calculate average using database aggregation"""
        try:
            result = queryset.aggregate(avg_util=self._get_avg_annotation())
            avg = result.get('avg_util') or 0.0
            avg = max(self.MIN_UTILIZATION, min(self.MAX_UTILIZATION, avg))
            return round(avg, 2)
        except Exception as e:
            logger.error(f"Error calculating database average: {e}")
            return 0.0

    # ============= MAIN FIXED METHOD: ABSOLUTE TIME RANGES =============
    def _calculate_custom_date_stats(self, start_date_str: str, end_date_str: str, granularity: str = None) -> Dict[str, float]:
        """Calculate custom date stats with ABSOLUTE time ranges - FIXES Last 24 Hours issue"""
        try:
            # Parse the incoming datetime strings
            start_dt = parse_iso_datetime(start_date_str)
            end_dt = parse_iso_datetime(end_date_str)
            
            start = localtime(start_dt)
            end = localtime(end_dt)
            
            # ✅ NEW: Detect and fix "Last 24 Hours" queries that are showing calendar day instead of rolling window
            time_diff = end - start
            hours_diff = time_diff.total_seconds() / 3600
            
            # Check if this is approximately a 24-hour window
            now_local = localtime(now())
            is_near_now = abs((end - now_local).total_seconds()) < 300  # Within 5 minutes of now
            
            if 23.5 <= hours_diff <= 24.5 and is_near_now:
                # This appears to be a "Last 24 Hours" query
                # Override to ensure it's a true rolling 24-hour window from now
                logger.info("🔍 Detected 'Last 24 Hours' query - using rolling window from now")
                end = now_local
                start = end - timedelta(hours=24)
                logger.info(f"🔍 Adjusted to rolling window: {start} to {end}")
            
            logger.info(f"🔍 Absolute range: {start} to {end} (exact user selection)")

            # Query with absolute range
            qs = self._get_base_queryset().filter(
                checkpoint__created_at__gte=start,
                checkpoint__created_at__lte=end
            )

            # Debug data availability
            total_records = qs.count()
            logger.info(f"🔍 Found {total_records} records for absolute range")
            
            if total_records == 0:
                logger.warning(f"❌ No data found in absolute range {start} to {end}")
                return self._generate_empty_labels(start, end, granularity)

            days_range = (end - start).days
            hours_range = (end - start).total_seconds() / 3600
            minutes_range = (end - start).total_seconds() / 60

            # Get adaptive thresholds
            hourly_threshold = self.adaptive_thresholds.get('HOURLY_TO_DAILY_HOURS', 48)
            daily_threshold = self.adaptive_thresholds.get('DAILY_TO_WEEKLY_DAYS', 90)

            # Handle granularity logic
            if granularity == 'minutely':
                logger.info(f"Processing minutely granularity for {minutes_range:.1f} minutes")
                
                if minutes_range > 60:
                    logger.error(f"Minutely granularity limited to 60 minutes, requested: {minutes_range:.1f}")
                    return {}
                
                slot_size = timedelta(minutes=1)
                format_label = lambda dt: dt.strftime("%H:%M")
                current = start.replace(second=0, microsecond=0)
                selected_granularity = "minutely"
                
            elif granularity == 'hourly':
                if hours_range > hourly_threshold:
                    logger.info(f"Hourly range too large ({hours_range:.1f}h > {hourly_threshold}h), switching to daily")
                    slot_size = timedelta(days=1)
                    format_label = lambda dt: dt.strftime("%a %m/%d")
                    current = start.replace(hour=0, minute=0, second=0, microsecond=0)
                    selected_granularity = "daily"
                else:
                    logger.info(f"Processing hourly granularity for {hours_range:.1f} hours")
                    slot_size = timedelta(hours=1)
                    format_label = lambda dt: dt.strftime("%a %I %p")
                    current = start.replace(minute=0, second=0, microsecond=0)
                    selected_granularity = "hourly"
                    
            elif granularity == 'daily':
                if days_range > daily_threshold:
                    logger.info(f"Daily range too large ({days_range}d > {daily_threshold}d), switching to weekly")
                    return self._calculate_weekly_aggregation(qs, start, end)
                else:
                    logger.info(f"Processing daily granularity for {days_range} days")
                    slot_size = timedelta(days=1)
                    format_label = lambda dt: dt.strftime("%a %m/%d")
                    current = start.replace(hour=0, minute=0, second=0, microsecond=0)
                    selected_granularity = "daily"
                    
            elif granularity == 'weekly':
                logger.info(f"Processing weekly granularity for {days_range} days")
                return self._calculate_weekly_aggregation(qs, start, end)
                
            elif granularity == 'monthly':
                logger.info(f"Processing monthly granularity for {days_range} days")
                slot_size = "monthly"
                format_label = lambda dt: dt.strftime("%b %Y")
                current = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                selected_granularity = "monthly"
                
            else:
                # Auto-granularity based on time range
                logger.info(f"Auto-selecting granularity for {hours_range:.1f} hours ({days_range} days)")
                
                if minutes_range <= 60:  # Up to 1 hour
                    slot_size = timedelta(minutes=1)
                    format_label = lambda dt: dt.strftime("%H:%M")
                    current = start.replace(second=0, microsecond=0)
                    selected_granularity = "minutely"
                    
                elif hours_range <= 24:  # 1-24 hours
                    slot_size = timedelta(hours=1)
                    format_label = lambda dt: dt.strftime("%a %I %p")
                    current = start.replace(minute=0, second=0, microsecond=0)
                    selected_granularity = "hourly"
                    
                elif hours_range <= hourly_threshold:  # 24-48 hours
                    slot_size = timedelta(hours=1)
                    format_label = lambda dt: dt.strftime("%a %I %p")
                    current = start.replace(minute=0, second=0, microsecond=0)
                    selected_granularity = "hourly"
                    
                elif days_range <= daily_threshold:  # 2-90 days
                    slot_size = timedelta(days=1)
                    format_label = lambda dt: dt.strftime("%a %m/%d")
                    current = start.replace(hour=0, minute=0, second=0, microsecond=0)
                    selected_granularity = "daily"
                    
                elif days_range <= 365:  # 90 days to 1 year
                    return self._calculate_weekly_aggregation(qs, start, end)
                    
                else:  # More than 1 year
                    slot_size = "monthly"
                    format_label = lambda dt: dt.strftime("%b %Y")
                    current = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    selected_granularity = "monthly"

            # Process slot-based granularities
            logger.info(f"Processing {selected_granularity} slots from {current} to {end}")
            
            result = {}
            data_points = 0
            total_entries = 0
            expected_slots = []
            
            # Pre-generate all expected labels
            temp_current = current
            while temp_current < end:
                if slot_size == "monthly":
                    next_slot = temp_current + relativedelta(months=1)
                else:
                    next_slot = temp_current + slot_size
                
                next_slot = min(next_slot, end)
                label = format_label(temp_current)
                expected_slots.append((label, temp_current, next_slot))
                temp_current = next_slot
            
            logger.info(f"Generated {len(expected_slots)} expected {selected_granularity} slots")
            
            # Initialize all labels with 0.0
            for label, _, _ in expected_slots:
                result[label] = 0.0
            
            # Populate with actual data where available
            for label, slot_start, slot_end in expected_slots:
                entries = qs.filter(
                    checkpoint__created_at__gte=slot_start,
                    checkpoint__created_at__lt=slot_end
                )
                
                entry_count = entries.count() if entries.exists() else 0
                if entry_count > 0:
                    avg = self._calculate_average_db(entries)
                    result[label] = avg
                    data_points += 1
                    total_entries += entry_count
                    logger.debug(f"✅ {label}: {entry_count} entries, avg: {avg}%")
                else:
                    logger.debug(f"⭕ {label}: No data, keeping 0.0")

            logger.info(f"✅ Absolute range stats completed:")
            logger.info(f"   - Granularity: {selected_granularity}")
            logger.info(f"   - Range: {hours_range:.1f} hours absolute")
            logger.info(f"   - Total slots: {len(result)}")
            logger.info(f"   - Slots with data: {data_points}")
            logger.info(f"   - Total entries processed: {total_entries}")
            
            # Store metadata
            self._last_calculation_metadata = {
                'granularity': selected_granularity,
                'requested_granularity': granularity,
                'calculation_method': 'absolute_time_range',
                'minutes_range': round(minutes_range, 1) if selected_granularity == 'minutely' else None,
                'hours_range': round(hours_range, 1),
                'days_range': days_range,
                'slots_generated': len(result),
                'data_points': data_points,
                'total_entries': total_entries,
                'actual_start': start.isoformat(),
                'actual_end': end.isoformat(),
                'requested_start': start_date_str,
                'requested_end': end_date_str
            }

            return result

        except ValueError as e:
            logger.error(f"ValueError in absolute custom date stats: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error in absolute custom date stats: {e}")
            return {}

    def _generate_empty_labels(self, start, end, granularity):
        """Generate empty labels for time range"""
        result = {}
        try:
            if granularity == 'minutely':
                current = start.replace(second=0, microsecond=0)
                slot_size = timedelta(minutes=1)
                format_label = lambda dt: dt.strftime("%H:%M")
            elif granularity == 'hourly':
                current = start.replace(minute=0, second=0, microsecond=0)  
                slot_size = timedelta(hours=1)
                format_label = lambda dt: dt.strftime("%a %I %p")
            elif granularity == 'daily':
                current = start.replace(hour=0, minute=0, second=0, microsecond=0)
                slot_size = timedelta(days=1)
                format_label = lambda dt: dt.strftime("%a %m/%d")
            else:
                return {}
                
            while current < end:
                next_slot = current + slot_size
                next_slot = min(next_slot, end)
                label = format_label(current)
                result[label] = 0.0
                current = next_slot
                
            logger.info(f"Generated {len(result)} empty labels for {granularity}")
            return result
            
        except Exception as e:
            logger.error(f"Error generating empty labels: {e}")
            return {}

    def _calculate_weekly_aggregation(self, qs, start, end):
        """Calculate weekly aggregation"""
        try:
            # Calculate week boundaries for the entire range
            start_week = start - timedelta(days=start.weekday())  # Start of week (Monday)
            start_week = start_week.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Calculate how many weeks we need to cover the entire range
            total_days = (end - start).days
            weeks_needed = (total_days // 7) + 2  # Add buffer for partial weeks
            end_week = start_week + timedelta(weeks=weeks_needed)
            
            logger.info(f"Weekly aggregation: {start_week} to {end_week}")
            
            # Pre-generate ALL expected week labels using consistent boundaries
            result = {}
            expected_weeks = []
            current_week = start_week
            
            while current_week < end_week:
                next_week = current_week + timedelta(weeks=1)
                
                # Only include weeks that overlap with our actual date range
                if not (next_week <= start or current_week >= end):
                    week_num = current_week.isocalendar()[1]
                    year_short = str(current_week.year)[-2:]
                    label = f"Week {week_num}/{year_short}"
                    expected_weeks.append((label, current_week, next_week))
                    
                    # Initialize with 0.0 - CRITICAL for complete timeline
                    result[label] = 0.0
                    logger.debug(f"Pre-generated week: {label} ({current_week.date()} to {next_week.date()})")
                
                current_week = next_week
            
            logger.info(f"Generated {len(expected_weeks)} week labels for range {start.date()} to {end.date()}")
            
            # Process each expected week individually for precise control
            data_weeks = 0
            total_entries = 0
            
            for label, week_start, week_end in expected_weeks:
                # Filter data for this specific week with exact boundaries
                week_entries = qs.filter(
                    checkpoint__created_at__gte=week_start,
                    checkpoint__created_at__lt=week_end
                )
                
                entry_count = week_entries.count()
                if entry_count > 0:
                    avg = self._calculate_average_db(week_entries)
                    result[label] = round(avg, 2)
                    data_weeks += 1
                    total_entries += entry_count
                    logger.debug(f"✅ {label}: {entry_count} entries, avg: {avg}%")
                else:
                    # Keep the 0.0 value that was pre-initialized
                    logger.debug(f"⭕ {label}: No data, keeping 0.0")
            
            return result
            
        except Exception as e:
            logger.error(f"Error in weekly aggregation: {e}")
            return {}

    # ============= STANDARD STATS METHODS =============
    @monitor_performance
    def get_minutely_stats(self) -> Dict[str, float]:
        """Get minutely stats"""
        cache_key = f"{self.cache_prefix}_minutely"
        return self._get_cached_or_calculate(
            cache_key, self._calculate_minutely_stats, 'minutely'
        )

    def _calculate_minutely_stats(self) -> Dict[str, float]:
        """Internal method for calculating minutely stats"""
        if self._is_circuit_open('get_minutely_stats'):
            logger.warning("Circuit breaker open for minutely stats, returning empty result")
            return {}
            
        try:
            now_local = localtime(now())
            current_minute = now_local.replace(second=0, microsecond=0)
            result = {}
            interval = timedelta(minutes=1)
            
            for i in range(31, 1, -1):  # Exclude current incomplete minute
                minute_start = current_minute - i * interval
                minute_end = minute_start + interval
                
                qs = self._get_base_queryset().filter(
                    checkpoint__created_at__gte=minute_start,
                    checkpoint__created_at__lt=minute_end
                )
                
                avg = self._calculate_average_db(qs)
                label = minute_start.strftime("%H:%M")
                result[label] = avg
                
            logger.info(f"Successfully calculated minutely stats with {len(result)} data points")
            return result
            
        except Exception as e:
            logger.error(f"Error calculating minutely stats: {e}")
            return {}

    @monitor_performance
    def get_hourly_stats(self) -> Dict[str, float]:
        """Get hourly stats"""
        cache_key = f"{self.cache_prefix}_hourly"
        return self._get_cached_or_calculate(
            cache_key, self._calculate_hourly_stats, 'hourly'
        )

    def _calculate_hourly_stats(self) -> Dict[str, float]:
        """Internal method for calculating hourly stats"""
        if self._is_circuit_open('get_hourly_stats'):
            logger.warning("Circuit breaker open for hourly stats, returning empty result")
            return {}
            
        try:
            now_local = localtime(now())
            current_hour = now_local.replace(minute=0, second=0, microsecond=0)
            result = {}
            
            for i in range(7, 0, -1):
                hour_start = current_hour - timedelta(hours=i)
                hour_end = hour_start + timedelta(hours=1)
                
                qs = self._get_base_queryset().filter(
                    checkpoint__created_at__gte=hour_start,
                    checkpoint__created_at__lt=hour_end
                )
                
                avg = self._calculate_average_db(qs)
                label = hour_start.strftime("%a %I %p")
                result[label] = avg
                
            logger.info(f"Successfully calculated hourly stats with {len(result)} data points")
            return result
            
        except Exception as e:
            logger.error(f"Error calculating hourly stats: {e}")
            return {}

    @monitor_performance
    def get_daily_stats(self) -> Dict[str, float]:
        """Get daily stats"""
        cache_key = f"{self.cache_prefix}_daily"
        return self._get_cached_or_calculate(
            cache_key, self._calculate_daily_stats, 'daily'
        )

    def _calculate_daily_stats(self) -> Dict[str, float]:
        """Internal method for calculating daily stats"""
        if self._is_circuit_open('get_daily_stats'):
            logger.warning("Circuit breaker open for daily stats, returning empty result")
            return {}
            
        try:
            now_local = localtime(now())
            today = now_local.date()
            result = {}
            
            for i in range(7, 0, -1):
                day = today - timedelta(days=i)
                
                qs = self._get_base_queryset().filter(
                    checkpoint__created_at__date=day
                )
                
                avg = self._calculate_average_db(qs)
                label = day.strftime("%a %m/%d")
                result[label] = avg
                
            logger.info(f"Successfully calculated daily stats with {len(result)} data points")
            return result
            
        except Exception as e:
            logger.error(f"Error calculating daily stats: {e}")
            return {}

    @monitor_performance
    def get_weekly_stats(self) -> Dict[str, float]:
        """Get weekly stats"""
        cache_key = f"{self.cache_prefix}_weekly"
        return self._get_cached_or_calculate(
            cache_key, self._calculate_weekly_stats, 'weekly'
        )

    def _calculate_weekly_stats(self) -> Dict[str, float]:
        """Internal method for calculating weekly stats"""
        if self._is_circuit_open('get_weekly_stats'):
            logger.warning("Circuit breaker open for weekly stats, returning empty result")
            return {}
            
        try:
            now_local = localtime(now())
            current_week_start = now_local - timedelta(days=now_local.weekday())
            current_week_start = current_week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            result = {}
            week_starts = []
            
            for i in range(7, 0, -1):  # Last 7 complete weeks
                week_start = current_week_start - timedelta(weeks=i)
                week_starts.append(week_start)
                
            # Initialize all labels with 0.0
            for week_start in week_starts:
                week_num = week_start.isocalendar()[1]
                year_short = str(week_start.year)[-2:]
                label = f"Week {week_num}/{year_short}"
                result[label] = 0.0
                
            # Get data from last 7 weeks
            earliest_week = week_starts[0]
            
            try:
                weekly_data = self._get_base_queryset() \
                    .filter(
                        checkpoint__created_at__gte=earliest_week,
                        checkpoint__created_at__lt=current_week_start
                    ) \
                    .annotate(week_start=TruncWeek('checkpoint__created_at')) \
                    .values('week_start') \
                    .annotate(avg_util=self._get_avg_annotation()) \
                    .order_by('week_start')
                    
                data_weeks_found = 0
                for entry in weekly_data:
                    week_start = entry['week_start']
                    avg_value = entry['avg_util'] or 0.0
                    
                    week_num = week_start.isocalendar()[1]
                    year_short = str(week_start.year)[-2:]
                    label = f"Week {week_num}/{year_short}"
                    
                    if label in result:
                        result[label] = max(self.MIN_UTILIZATION, min(self.MAX_UTILIZATION, avg_value))
                        data_weeks_found += 1
                        logger.debug(f"✅ {label}: {avg_value:.2f}%")
                        
            except Exception as e:
                logger.error(f"Error in weekly aggregation: {e}")
                return {}
                
            logger.info(f"Successfully calculated weekly stats: {len(result)} weeks, {data_weeks_found} with data")
            return result
            
        except Exception as e:
            logger.error(f"Error calculating weekly stats: {e}")
            return {}

    @monitor_performance
    def get_monthly_stats(self) -> Dict[str, float]:
        """Get monthly stats"""
        cache_key = f"{self.cache_prefix}_monthly"
        return self._get_cached_or_calculate(
            cache_key, self._calculate_monthly_stats, 'monthly'
        )

    def _calculate_monthly_stats(self) -> Dict[str, float]:
        """Internal method for calculating monthly stats"""
        if self._is_circuit_open('get_monthly_stats'):
            logger.warning("Circuit breaker open for monthly stats, returning empty result")
            return {}
            
        try:
            now_local = localtime(now())
            current_month = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            result = {}
            
            for i in range(7, 0, -1):
                month_start = current_month - relativedelta(months=i)
                month_end = month_start + relativedelta(months=1)
                
                qs = self._get_base_queryset().filter(
                    checkpoint__created_at__gte=month_start,
                    checkpoint__created_at__lt=month_end
                )
                
                avg = self._calculate_average_db(qs)
                label = month_start.strftime("%b %Y")
                result[label] = avg
                
            logger.info(f"Successfully calculated monthly stats with {len(result)} data points")
            return result
            
        except Exception as e:
            logger.error(f"Error calculating monthly stats: {e}")
            return {}

    # ============= CUSTOM RANGE METHODS =============
    @monitor_performance
    def get_custom_date_stats(self, start_date_str: str, end_date_str: str) -> Dict[str, float]:
        """Get custom date stats with validation and circuit breaker"""
        if self._is_circuit_open('get_custom_date_stats'):
            logger.warning("Circuit breaker open for custom date stats, returning empty result")
            return {}
            
        # Input validation
        is_valid, error_msg = self._validate_date_inputs(start_date_str, end_date_str)
        if not is_valid:
            logger.error(f"Invalid date inputs: {error_msg}")
            return {}
            
        cache_key = f"{self.cache_prefix}_custom_{start_date_str}_{end_date_str}"
        return self._get_cached_or_calculate(
            cache_key, 
            lambda: self._calculate_custom_date_stats(start_date_str, end_date_str), 
            'custom'
        )

    @monitor_performance
    def get_custom_date_stats_with_granularity(self, start_date_str: str, end_date_str: str, granularity: str) -> Dict[str, float]:
        """Get custom date stats with specific granularity - MAIN METHOD FOR FIXING TIME RANGE ISSUE"""
        cache_key = f"{self.cache_prefix}_custom_{granularity}_{start_date_str}_{end_date_str}"
        return self._get_cached_or_calculate(
            cache_key, 
            lambda: self._calculate_custom_date_stats(start_date_str, end_date_str, granularity), 
            'custom'
        )

    # ============= HEALTH CHECK =============
    def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check for the calculator"""
        health_status = {
            'status': 'healthy',
            'timestamp': now().isoformat(),
            'resource_id': self.resource.id if hasattr(self.resource, 'id') else None,
            'resource_type': self.resource_type,
            'adaptive_thresholds': self.adaptive_thresholds,
            'checks': {}
        }
        
        try:
            # Circuit breaker status check
            operations = ['get_minutely_stats', 'get_hourly_stats', 'get_daily_stats', 'get_weekly_stats', 'get_monthly_stats']
            circuit_status = {op: 'open' if self._is_circuit_open(op) else 'closed' for op in operations}
            health_status['checks']['circuit_breakers'] = circuit_status
            
            # Cache connectivity test
            test_cache_key = f"{self.cache_prefix}_health_check"
            cache.set(test_cache_key, 'ok', 10)
            cache_test = cache.get(test_cache_key)
            health_status['checks']['cache'] = 'ok' if cache_test == 'ok' else 'error'
            cache.delete(test_cache_key)
            
            # Database connectivity test
            test_query = self._get_base_queryset().exists()
            health_status['checks']['database'] = 'ok' if test_query is not None else 'error'
            
            # Overall health status
            if any(check == 'error' for check in health_status['checks'].values() if isinstance(check, str)):
                health_status['status'] = 'unhealthy'
                
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            health_status['status'] = 'unhealthy'
            health_status['error'] = str(e)
            
        return health_status

    def get_all_stats(self) -> Dict[str, Dict[str, float]]:
        """Get all stats with enhanced error handling"""
        try:
            return {
                'minutely': self.get_minutely_stats(),
                'hourly': self.get_hourly_stats(),
                'daily': self.get_daily_stats(),
                'weekly': self.get_weekly_stats(),
                'monthly': self.get_monthly_stats(),
            }
        except Exception as e:
            logger.error(f"Error getting all stats: {e}")
            return {
                'minutely': {},
                'hourly': {},
                'daily': {},
                'weekly': {},
                'monthly': {},
            }


# ============= UNIFIED SERVICE CLASS =============
class UnifiedMonitoringService:
    """Single service to handle CPU, Memory, and Disk monitoring statistics"""
    
    @staticmethod
    def get_calculator(resource_type: str, resource):
        """Factory method to get the right calculator for any resource type"""
        if resource is None:
            logger.warning(f"{resource_type} is None")
            return None
            
        mapping = {
            'cpu': (CpuMonitoring, 'cpu_utilization'),
            'memory': (MemoryMonitoring, 'memory_utilization'), 
            'disk': (DiskMonitoring, 'disk_usage_percent')
        }
        
        if resource_type not in mapping:
            logger.error(f"Unknown resource type: {resource_type}")
            return None
            
        model_class, utilization_field = mapping[resource_type]
        return UnifiedMonitoringStatsCalculator.create(
            resource, resource_type, model_class, utilization_field
        )
    
    # ============= CPU METHODS =============
    @staticmethod
    def get_cpu_minutely_stats(cpu):
        calculator = UnifiedMonitoringService.get_calculator('cpu', cpu)
        return calculator.get_minutely_stats() if calculator else {}
    
    @staticmethod
    def get_cpu_hourly_stats(cpu):
        calculator = UnifiedMonitoringService.get_calculator('cpu', cpu)
        return calculator.get_hourly_stats() if calculator else {}
    
    @staticmethod
    def get_cpu_daily_stats(cpu):
        calculator = UnifiedMonitoringService.get_calculator('cpu', cpu)
        return calculator.get_daily_stats() if calculator else {}
    
    @staticmethod
    def get_cpu_weekly_stats(cpu):
        calculator = UnifiedMonitoringService.get_calculator('cpu', cpu)
        return calculator.get_weekly_stats() if calculator else {}
    
    @staticmethod
    def get_cpu_monthly_stats(cpu):
        calculator = UnifiedMonitoringService.get_calculator('cpu', cpu)
        return calculator.get_monthly_stats() if calculator else {}
    
    @staticmethod
    def get_cpu_custom_date_stats_with_granularity(cpu, start_date_str: str, end_date_str: str, granularity: str):
        calculator = UnifiedMonitoringService.get_calculator('cpu', cpu)
        return calculator.get_custom_date_stats_with_granularity(start_date_str, end_date_str, granularity) if calculator else {}

    # ============= MEMORY METHODS =============
    @staticmethod
    def get_memory_minutely_stats(memory):
        calculator = UnifiedMonitoringService.get_calculator('memory', memory)
        return calculator.get_minutely_stats() if calculator else {}
    
    @staticmethod
    def get_memory_hourly_stats(memory):
        calculator = UnifiedMonitoringService.get_calculator('memory', memory)
        return calculator.get_hourly_stats() if calculator else {}
    
    @staticmethod
    def get_memory_daily_stats(memory):
        calculator = UnifiedMonitoringService.get_calculator('memory', memory)
        return calculator.get_daily_stats() if calculator else {}
    
    @staticmethod
    def get_memory_weekly_stats(memory):
        calculator = UnifiedMonitoringService.get_calculator('memory', memory)
        return calculator.get_weekly_stats() if calculator else {}
    
    @staticmethod
    def get_memory_monthly_stats(memory):
        calculator = UnifiedMonitoringService.get_calculator('memory', memory)
        return calculator.get_monthly_stats() if calculator else {}
    
    @staticmethod
    def get_memory_custom_date_stats_with_granularity(memory, start_date_str: str, end_date_str: str, granularity: str):
        calculator = UnifiedMonitoringService.get_calculator('memory', memory)
        return calculator.get_custom_date_stats_with_granularity(start_date_str, end_date_str, granularity) if calculator else {}

    # ============= DISK METHODS =============
    @staticmethod
    def get_disk_minutely_stats(disk):
        calculator = UnifiedMonitoringService.get_calculator('disk', disk)
        return calculator.get_minutely_stats() if calculator else {}
    
    @staticmethod
    def get_disk_hourly_stats(disk):
        calculator = UnifiedMonitoringService.get_calculator('disk', disk)
        return calculator.get_hourly_stats() if calculator else {}
    
    @staticmethod
    def get_disk_daily_stats(disk):
        calculator = UnifiedMonitoringService.get_calculator('disk', disk)
        return calculator.get_daily_stats() if calculator else {}
    
    @staticmethod
    def get_disk_weekly_stats(disk):
        calculator = UnifiedMonitoringService.get_calculator('disk', disk)
        return calculator.get_weekly_stats() if calculator else {}
    
    @staticmethod
    def get_disk_monthly_stats(disk):
        calculator = UnifiedMonitoringService.get_calculator('disk', disk)
        return calculator.get_monthly_stats() if calculator else {}
    
    @staticmethod
    def get_disk_custom_date_stats_with_granularity(disk, start_date_str: str, end_date_str: str, granularity: str):
        calculator = UnifiedMonitoringService.get_calculator('disk', disk)
        return calculator.get_custom_date_stats_with_granularity(start_date_str, end_date_str, granularity) if calculator else {}


# ============= CONVENIENCE FUNCTION EXPORTS =============
# CPU Functions
get_cpu_minutely_stats = UnifiedMonitoringService.get_cpu_minutely_stats
get_cpu_hourly_stats = UnifiedMonitoringService.get_cpu_hourly_stats
get_cpu_daily_stats = UnifiedMonitoringService.get_cpu_daily_stats
get_cpu_weekly_stats = UnifiedMonitoringService.get_cpu_weekly_stats
get_cpu_monthly_stats = UnifiedMonitoringService.get_cpu_monthly_stats
get_cpu_custom_date_stats_with_granularity = UnifiedMonitoringService.get_cpu_custom_date_stats_with_granularity

# Memory Functions  
get_memory_minutely_stats = UnifiedMonitoringService.get_memory_minutely_stats
get_memory_hourly_stats = UnifiedMonitoringService.get_memory_hourly_stats
get_memory_daily_stats = UnifiedMonitoringService.get_memory_daily_stats
get_memory_weekly_stats = UnifiedMonitoringService.get_memory_weekly_stats
get_memory_monthly_stats = UnifiedMonitoringService.get_memory_monthly_stats
get_memory_custom_date_stats_with_granularity = UnifiedMonitoringService.get_memory_custom_date_stats_with_granularity

# Disk Functions
get_disk_minutely_stats = UnifiedMonitoringService.get_disk_minutely_stats
get_disk_hourly_stats = UnifiedMonitoringService.get_disk_hourly_stats
get_disk_daily_stats = UnifiedMonitoringService.get_disk_daily_stats
get_disk_weekly_stats = UnifiedMonitoringService.get_disk_weekly_stats
get_disk_monthly_stats = UnifiedMonitoringService.get_disk_monthly_stats
get_disk_custom_date_stats_with_granularity = UnifiedMonitoringService.get_disk_custom_date_stats_with_granularity
