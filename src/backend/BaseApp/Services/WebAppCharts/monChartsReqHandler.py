from django.http import JsonResponse
from django.db.models.functions import TruncSecond, TruncHour, TruncDay, TruncWeek, TruncMonth, TruncMinute, Cast, Round
from django.db.models import Avg, Max, Min, FloatField, F, CharField, Value, Func, DateTimeField
from BaseApp.models.models import *
from BaseApp.models.ipmonitor import *
import logging, datetime as dt

logger = logging.getLogger('webapp_logs')

class MonChartsReqHandler:
    def __init__(self):
        pass

    keys_map = {
        'cpu_utilization': {"model": CpuMonitoring, "suffix": "%", "precision": 2},
        'memory_utilization': {"model": MemoryMonitoring, "suffix": "%", "precision": 2},
        'ctx_switches': {"model": CpuMonitoring, "suffix": ""},
        'hw_irq': {"model": CpuMonitoring, "suffix": ""},
        'sw_irq': {"model": CpuMonitoring, "suffix": ""},
        'syscalls': {"model": CpuMonitoring, "suffix": ""},
        'bytes_received': {"model": NetworkPortMonitoring, "suffix": " Bytes"},
        'bytes_sent': {"model": NetworkPortMonitoring, "suffix": " Bytes"},
        'network_utilization': {"model": NetworkPortMonitoring, "suffix": "%", "precision": 2},
        'packets_received': {"model": NetworkPortMonitoring, "suffix": " Packets"},
        'packets_sent': {"model": NetworkPortMonitoring, "suffix": " Packets"},
        'drop_in': {"model": NetworkPortMonitoring, "suffix": " Packets"},
        'drop_out': {"model": NetworkPortMonitoring, "suffix": " Packets"},
        'error_in': {"model": NetworkPortMonitoring, "suffix": " Errors"},
        'error_out': {"model": NetworkPortMonitoring, "suffix": " Errors"},
        'disk_usage_percent': {"model": DiskMonitoring, "suffix": "%", "precision": 2},
        'total_disk_size': {"model": DiskMonitoring, "suffix": " GB", "precision": 2},
        'total_disk_usage': {"model": DiskMonitoring, "suffix": " GB", "precision": 2},
        'unallocated_disk_space': {"model": DiskMonitoring, "suffix": " GB", "precision": 2},
        'allocated_disk_space': {"model": DiskMonitoring, "suffix": " GB", "precision": 2},
        'read_count_io': {"model": DiskMonitoring, "suffix": " IO/s", "precision": 2},
        'write_count_io': {"model": DiskMonitoring, "suffix": " IO/s", "precision": 2},
        'bytes_read_io': {"model": DiskMonitoring, "suffix": " Bytes/s", "precision": 2},
        'bytes_write_io': {"model": DiskMonitoring, "suffix": " Bytes/s", "precision": 2},
        'read_time_io': {"model": DiskMonitoring, "suffix": " ms", "precision": 2},
        'write_time_io': {"model": DiskMonitoring, "suffix": " ms", "precision": 2},
        'used_space_perc': {"model": PartitionMonitoring, "suffix": "%", "precision": 2},
        'used_space': {"model": PartitionMonitoring, "suffix": " GB", "precision": 2},
        'free_space': {"model": PartitionMonitoring, "suffix": " GB", "precision": 2},
        'ip_status': {"model": IPMonitorCheckpoint, "suffix": "%", "precision": 0},
        'min_latency': {"model": IPMonitorCheckpoint, "suffix": " ms", "precision": 4},
        'max_latency': {"model": IPMonitorCheckpoint, "suffix": " ms", "precision": 4},
        'jitter': {"model": IPMonitorCheckpoint, "suffix": " ms", "precision": 4},
    }

    ip_monitoring_keys = [
        'ip_status',
        'min_latency',
        'max_latency',
        'jitter',
    ]

    @staticmethod
    def handle_request(request):
        # Process the request and return the appropriate response
        try:
            logger.info(f"Request data: {request.data}")
            fromDT = request.data.get('fromDT')
            toDT = request.data.get('toDT')
            key = request.data.get('key')
            agent_uuid = request.data.get('agent_uuid')
            component = request.data.get('component')
            ts_field = 'created_at' if key in MonChartsReqHandler.ip_monitoring_keys else 'checkpoint__timestamp_utc'
            db_key = key

            # logger.info(f"Parsed parameters - fromDT: {fromDT}, toDT: {toDT}, key: {key}, agent_uuid: {agent_uuid}")

            if not fromDT or not toDT or not key or not agent_uuid:
                return JsonResponse({"status": "error", "message": "fromDT, toDT, key, and agent_uuid are required"}, status=400)
            if key not in MonChartsReqHandler.keys_map:
                return JsonResponse({"status": "error", "message": f"Invalid key: {key}"}, status=400)

            fromDT = dt.datetime.fromisoformat(fromDT.replace('Z', '+00:00')) if 'Z' in fromDT else dt.datetime.fromisoformat(fromDT)
            toDT = dt.datetime.fromisoformat(toDT.replace('Z', '+00:00')) if 'Z' in toDT else dt.datetime.fromisoformat(toDT)
            duration = toDT - fromDT
            duration_hours = duration.total_seconds() / 3600

            if duration_hours <= 1:
                # bucket = TruncSecond(ts_field, second=10) # Show only Time
                bucket = Func(
                    F(ts_field),
                    template="to_timestamp(floor(extract(epoch from %(expressions)s) / 10) * 10)",
                    output_field=DateTimeField()
                )
                time_fmt = "%H:%M:%S"
            elif duration_hours <= 24:
                bucket = TruncMinute(ts_field) #Show only Hour and Minute
                time_fmt = "%H:%M"
            elif duration_hours <= 24 * 7:
                bucket = TruncHour(ts_field) # Show only Date and Hour
                time_fmt = "%d-%m %H:%M"
            else:
                bucket = TruncDay(ts_field) # Show only Date
                time_fmt = "%Y-%m-%d"
            

            if key in MonChartsReqHandler.ip_monitoring_keys:
                MonClass = MonChartsReqHandler.keys_map[key]["model"].objects.filter(
                    ip_monitor__uuid = agent_uuid,
                    created_at__range=(fromDT, toDT)
                )
                if key == "ip_status": db_key = "status_value"
                logger.info(MonClass)
            elif component is None:
                MonClass = MonChartsReqHandler.keys_map[key]["model"].objects.filter(
                checkpoint__agent__uuid=agent_uuid,
                checkpoint__timestamp_utc__range=(fromDT, toDT)
                )
            else:
                MonClass = MonChartsReqHandler.keys_map[key]["model"].objects.filter(
                checkpoint__agent__uuid=agent_uuid,
                checkpoint__timestamp_utc__range=(fromDT, toDT),
                component__uuid = component
                )

            metrics = (
                MonClass
                .annotate(bucket=bucket)
                .values('bucket')
                .annotate(
                    timestamp=F('bucket'),
                    series1=Round(Min(Cast(db_key, FloatField())), precision=MonChartsReqHandler.keys_map[key].get("precision", 0)),
                    series1_name = Value(f"MIN", output_field=CharField()),
                    series1_suffix = Value(MonChartsReqHandler.keys_map[key]["suffix"], output_field=CharField()),
                    series2=Round(Avg(Cast(db_key, FloatField())), precision=MonChartsReqHandler.keys_map[key].get("precision", 0)),
                    series2_name = Value(f"AVG", output_field=CharField()),
                    series2_suffix = Value(MonChartsReqHandler.keys_map[key]["suffix"], output_field=CharField()),
                    series3=Round(Max(Cast(db_key, FloatField())), precision=MonChartsReqHandler.keys_map[key].get("precision", 0)),
                    series3_name = Value(f"MAX", output_field=CharField()),
                    series3_suffix = Value(MonChartsReqHandler.keys_map[key]["suffix"], output_field=CharField()),
                )
                .values('timestamp', 'series1', 'series1_name', 'series1_suffix', 'series2', 'series2_name', 'series2_suffix', 'series3', 'series3_name', 'series3_suffix')
                .order_by('timestamp')
            )            

            response_data = list(metrics)
            for item in response_data:
                if item['timestamp']: # Check to ensure it's not None
                    item['timestamp'] = item['timestamp'].strftime(time_fmt)

            logger.info(f"Response data: {response_data}")
            return JsonResponse({f"status": "success", "data": response_data}, status=200)
        except Exception as e:
            logger.error(f"Error handling monitoring chart request: {e}")
            return JsonResponse({"status": "error", "message": str(e)}, status=500)

        

