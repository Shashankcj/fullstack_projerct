import logging
import time
from collections import defaultdict

from django.core.cache import cache
from django.db.models import OuterRef, Subquery, Q
from django.db.models.signals import post_save
from django.dispatch import receiver

from BaseApp.models.models import (
    Agent,
    Alert,
    MonitoringCheckpoint,
    CpuMonitoring,
    MemoryMonitoring,
    PartitionMonitoring,
    NetworkPortMonitoring,
    IPAddress,
)
from BaseApp.models.global_config import GlobalConfig
from BaseApp.models.ipmonitor import IPMonitor, IPMonitorCheckpoint


CACHE_TTL = 30
METRIC_NAMES = ("cpu", "memory", "disk", "network")


def _normalize_priority(priority):
    priority = (priority or "p1").lower()

    allowed = {
        "p1",
        "p2",
        "p3",
        "p4",
        "np",
        "all"
    }

    return priority if priority in allowed else "p1"


def _safe_float(value):
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _get_cache_key(
    prefix,
    priority,
    page=None,
    limit=None,
    search=None,
    status_filter=None,
    os_filter=None,
    device_type_filter=None,
    health_filter=None,
):
    parts = [
        prefix,
        str(priority).lower(),
        f"p{page}" if page is not None else "",
        f"l{limit}" if limit is not None else "",
        f"s:{(search or '').strip().lower()}",
        f"st:{(status_filter or '').strip().lower()}",
        f"os:{(os_filter or '').strip().lower()}",
        f"dt:{(device_type_filter or '').strip().lower()}",
        f"h:{(health_filter or '').strip().lower()}",
    ]
    return ":".join(parts)


def _get_latest_checkpoints_bulk(agents):
    agent_uuids = [a.uuid for a in agents]

    # Subquery: get the latest checkpoint ID per agent
    latest_cp_subquery = (
        MonitoringCheckpoint.objects
        .filter(agent_id=OuterRef("uuid"))
        .order_by("-timestamp_utc")
        .values("uuid")[:1]
    )

    # Annotate agents with their latest checkpoint ID
    agents_with_cp = (
        Agent.objects
        .filter(uuid__in=agent_uuids)
        .annotate(latest_cp_id=Subquery(latest_cp_subquery))
    )

    # Fetch those checkpoints by their actual IDs
    cp_ids = [
        a.latest_cp_id
        for a in agents_with_cp
        if a.latest_cp_id is not None
    ]

    checkpoints = MonitoringCheckpoint.objects.filter(uuid__in=cp_ids).select_related("agent")

    return {cp.agent.uuid: cp for cp in checkpoints}


def _get_metric_snapshots_bulk(agents, checkpoint_map):
    checkpoint_ids = [
        cp.uuid
        for cp in checkpoint_map.values()
        if cp
    ]

    cpu = {
        x.checkpoint_id: x.cpu_utilization
        for x in CpuMonitoring.objects.filter(
            checkpoint_id__in=checkpoint_ids
        )
    }

    memory = {
        x.checkpoint_id: x.memory_utilization
        for x in MemoryMonitoring.objects.filter(
            checkpoint_id__in=checkpoint_ids
        )
    }

    disk = defaultdict(lambda: None)
    for x in PartitionMonitoring.objects.filter(
        checkpoint_id__in=checkpoint_ids
    ):
        current = disk[x.checkpoint_id]
        if current is None or x.used_space_perc > current:
            disk[x.checkpoint_id] = x.used_space_perc

    network = defaultdict(lambda: None)
    for x in NetworkPortMonitoring.objects.filter(
        checkpoint_id__in=checkpoint_ids
    ):
        current = network[x.checkpoint_id]
        if current is None or x.network_utilization > current:
            network[x.checkpoint_id] = x.network_utilization

    snapshots = {}
    for agent in agents:
        cp = checkpoint_map.get(agent.uuid)
        if not cp:
            snapshots[agent.uuid] = {
                "cpu": None,
                "memory": None,
                "disk": None,
                "network": None,
            }
            continue

        snapshots[agent.uuid] = {
            "cpu": cpu.get(cp.uuid),
            "memory": memory.get(cp.uuid),
            "disk": disk.get(cp.uuid),
            "network": network.get(cp.uuid),
        }

    return snapshots


def _get_all_thresholds():
    return {
        "p1": GlobalConfig.get_priority_dashboard_thresholds("p1"),
        "p2": GlobalConfig.get_priority_dashboard_thresholds("p2"),
        "p3": GlobalConfig.get_priority_dashboard_thresholds("p3"),
        "p4": GlobalConfig.get_priority_dashboard_thresholds("p4"),
        "np": GlobalConfig.get_priority_dashboard_thresholds("np"),
    }

def _get_thresholds(priority):
    return GlobalConfig.get_priority_dashboard_thresholds(
        priority
    )


def _get_thresholds_for_priority(priority):
    """Return thresholds for a given priority, handling 'all'."""
    if priority == "all":
        return _get_all_thresholds()
    return _get_thresholds(priority)

def _classify_value(value, warning, critical):
    if value is None:
        return "no_data"
    if value < warning:
        return "healthy"
    if value < critical:
        return "warning"
    return "critical"


def _empty_metric_counts():
    return {"healthy": 0, "warning": 0, "critical": 0, "no_data": 0}


def _empty_summary_counts():
    return {name: _empty_metric_counts() for name in METRIC_NAMES}


def _count_metric(summary_counts, metric_name, value, warning, critical):
    bucket = _classify_value(value, warning, critical)
    summary_counts[metric_name][bucket] += 1


def _build_summary_counts(agents, thresholds, all_threshold=False):
    counts = _empty_summary_counts()

    checkpoint_map = _get_latest_checkpoints_bulk(agents)
    snapshots = _get_metric_snapshots_bulk(agents, checkpoint_map)

    for agent in agents:
        threshold = thresholds

        if all_threshold:

            priority_name = "p1"

            if agent.priority:
                priority_name = (
                    agent.priority.priority_name.lower()
                )

            threshold = thresholds.get(
                priority_name,
                thresholds["p4"]
            )

        


        cpu_warn = threshold["cpu"]["warning"]
        cpu_critical = threshold["cpu"]["critical"]

        mem_warn = threshold["memory"]["warning"]
        mem_critical = threshold["memory"]["critical"]

        disk_warn = threshold["disk"]["warning"]
        disk_critical = threshold["disk"]["critical"]

        net_warn = threshold["network"]["warning"]
        net_critical = threshold["network"]["critical"]

        metrics = snapshots[agent.uuid]

        if metrics["cpu"] is None:
            counts["cpu"]["no_data"] += 1
        else:
            _count_metric(counts, "cpu", metrics["cpu"], cpu_warn, cpu_critical)

        if metrics["memory"] is None:
            counts["memory"]["no_data"] += 1
        else:
            _count_metric(counts, "memory", metrics["memory"], mem_warn, mem_critical)

        if metrics["disk"] is None:
            counts["disk"]["no_data"] += 1
        else:
            _count_metric(counts, "disk", metrics["disk"], disk_warn, disk_critical)

        if metrics["network"] is None:
            counts["network"]["no_data"] += 1
        else:
            _count_metric(counts, "network", metrics["network"], net_warn, net_critical)

    return counts


def _build_server_payload_bulk(agents):
    """Return server payloads using bulk DB fetches — avoids N+1 queries."""
    if not agents:
        return []

    agents_list = list(agents)

    checkpoint_map = _get_latest_checkpoints_bulk(agents_list)
    snapshots = _get_metric_snapshots_bulk(agents_list, checkpoint_map)

    #  Use .uuid (Device PK is uuid, not id)
    device_uuids = [
        a.device.uuid
        for a in agents_list
        if getattr(a, "device", None)
    ]

    ip_map = {}
    if device_uuids:
        rows = IPAddress.objects.filter(
            port__nic__device__uuid__in=device_uuids          
        ).values_list("port__nic__device__uuid", "address")   
        ip_map = {dev_uuid: addr for dev_uuid, addr in rows}

    servers = []
    for agent in agents_list:
        snap = snapshots.get(
            agent.uuid,
            {"cpu": None, "memory": None, "disk": None, "network": None}
        )

        cpu_util  = round(snap["cpu"])       if snap["cpu"]     is not None else None
        mem_util  = round(snap["memory"])    if snap["memory"]  is not None else None
        disk_util = round(snap["disk"])      if snap["disk"]    is not None else None
        net_util  = round(snap["network"], 1) if snap["network"] is not None else None

        device = getattr(agent, "device", None)
        ip_address  = ip_map.get(device.uuid) if device else None  
        device_type = device.dev_phy_vm        if device else None

        servers.append({
            "name":         agent.hostname,
            "uuid":         str(agent.uuid),
            "status":       agent.status,
            "priority":     agent.priority.priority_name.lower() if agent.priority else None,
            "health_status": agent.health_status if agent.status == "Active" else None,
            "cpu":          cpu_util,
            "memory":       mem_util,
            "disk":         disk_util,
            "network":      net_util,
            "ip":           ip_address,
            "device_type":  device_type,
            "os":           agent.os,
        })

    return servers


def get_dashboard_summary(priority="P1"):
    t0 = time.time()
    priority = _normalize_priority(priority)
    logger = logging.getLogger(__name__)
    logger.info("summary start priority=%s", priority)

    cache_key = _get_cache_key("dashboard", priority)

    cached = cache.get(cache_key)
    if cached:
        logger.info("summary cache hit %.3fs", time.time() - t0)
        return cached

    thresholds = _get_thresholds_for_priority(priority)
    logger.info("thresholds %.3fs", time.time() - t0)

    all_agents = Agent.objects.select_related("priority")

    if priority != "all":
        all_agents = all_agents.filter(
            priority__priority_name=priority
        )

    t1 = time.time()
    total_servers = all_agents.count()
    active_agents = all_agents.filter(status="Active")
    active_servers = active_agents.count()
    inactive_servers = total_servers - active_servers
    logger.info("agent counts %.3fs", time.time() - t1)

    t2 = time.time()
    metric_counts = _build_summary_counts(all_agents, thresholds, all_threshold=(priority == "all"))
    logger.info("metric counts %.3fs", time.time() - t2)

    server_healthy = active_agents.filter(health_status="green").count()
    server_warning = active_agents.filter(health_status="amber").count()
    server_critical = active_agents.filter(health_status="red").count()
    server_maintenance = active_agents.filter(health_status="maintenance").count()
    server_no_data = inactive_servers

    latest_ip_checkpoint = (
        IPMonitorCheckpoint.objects
        .filter(ip_monitor=OuterRef("pk"))
        .order_by("-created_at")
    )
    t3 = time.time()
    ip_monitors = (
        IPMonitor.objects
        .annotate(
            latest_status=Subquery(
                latest_ip_checkpoint.values("status")[:1]
            )
        )
    )

    if priority != "all":
        ip_monitors = ip_monitors.filter(
            priority__priority_name=priority
        )

    ip_total = ip_monitors.count()
    ip_up = ip_monitors.filter(latest_status="Up").count()
    ip_down = ip_monitors.filter(latest_status="Down").count()
    logger = logging.getLogger(__name__)
    logger.info("ip monitor %.3fs", time.time() - t3)

    data = {
        "total_servers": total_servers,
        "thresholds": thresholds,
        "health": {
            "healthy": server_healthy,
            "warning": server_warning,
            "critical": server_critical,
            "maintenance": server_maintenance,
            "no_data": server_no_data,
        },
        "cpu_donut": {
            **metric_counts["cpu"],
        },
        "memory_donut": {
            **metric_counts["memory"],
        },
        "disk_donut": {
            **metric_counts["disk"],
        },
        "network_donut": {
            **metric_counts["network"],
        },
        "ip_monitoring": {
            "total": ip_total,
            "up": ip_up,
            "down": ip_down,
        },
        "devices": {
            "total": total_servers,
            "active": active_servers,
            "inactive": inactive_servers,
        },
    }

    logger.info("summary total %.3fs", time.time() - t0)
    cache.set(cache_key, data, CACHE_TTL)
    return data

def get_dashboard_servers(
    priority="P1",
    page=1,
    limit=10,
    search=None,
    status_filter=None,
    os_filter=None,
    device_type_filter=None,
    health_filter=None,
):
    priority = _normalize_priority(priority)
    search = (search or "").strip()

    cache_key = _get_cache_key(
        "servers",
        priority,
        page,
        limit,
        search,
        status_filter,
        os_filter,
        device_type_filter,
        health_filter,
    )
    cached = cache.get(cache_key)
    if cached:
        return cached

    thresholds = _get_thresholds_for_priority(priority)

    base_qs = (
        Agent.objects
        .select_related("priority", "device")
        .order_by("-last_seen")
    )

    if priority != "all":
        base_qs = base_qs.filter(
            priority__priority_name=priority
        )

    # ---------------- SEARCH BLOCK ----------------
    if search:
        health_search_map = {
            "healthy": "green",
            "warning": "amber",
            "critical": "red",
            "maintenance": "maintenance",
        }
        health_search_value = health_search_map.get(search.lower(), search)

        base_qs = base_qs.filter(
            Q(hostname__icontains=search) |
            Q(os__icontains=search) |
            Q(device__dev_phy_vm__icontains=search) |
            Q(status__iexact=search) |
            Q(health_status__iexact=health_search_value) |
            Q(device__nic__port__ip__address__icontains=search)
        ).distinct()

    # ---------------- STATUS FILTER ----------------
    if status_filter:
        base_qs = base_qs.filter(status=status_filter)

    # ---------------- OS FILTER ----------------
    if os_filter:
        os_value = os_filter.lower()
        if os_value == "linux":
            base_qs = base_qs.filter(os__in=[
                "Red Hat Enterprise Linux",
                "Ubuntu",
                "centos",
                "debian",
                "fedora",
            ])
        elif os_value == "windows":
            base_qs = base_qs.filter(os="Windows")
        else:
            base_qs = base_qs.filter(os=os_filter)

    # ---------------- DEVICE TYPE FILTER ----------------
    if device_type_filter:
        base_qs = base_qs.filter(device__dev_phy_vm__icontains=device_type_filter)

    # ---------------- HEALTH FILTER ----------------
    if health_filter:
        hf = health_filter.lower()

        if hf == "unknown":
            base_qs = base_qs.filter(
                Q(health_status__isnull=True) | Q(health_status="")
            )
        else:
            health_map = {
                "healthy": "green",
                "warning": "amber",
                "critical": "red",
                "maintenance": "maintenance",
            }

            db_value = health_map.get(hf)

            if db_value:
                base_qs = (
                    base_qs
                    .filter(status="Active", health_status__iexact=db_value)
                    .exclude(Q(health_status__isnull=True) | Q(health_status=""))
                )
            else:
                base_qs = base_qs.none()

    # ---------------- AGGREGATION + PAGINATION ----------------
    total = base_qs.count()
    active = base_qs.filter(status="Active").count()
    inactive = base_qs.filter(status="Inactive").count()

    agents = list(base_qs[(page - 1) * limit : page * limit])
    servers = _build_server_payload_bulk(agents)

    data = {
        "servers": servers,
        "total": total,
        "active": active,
        "inactive": inactive,
        "thresholds": thresholds,
    }

    cache.set(cache_key, data, CACHE_TTL)
    return data

def get_dashboard_alerts(priority="P1", limit=5):
    priority = _normalize_priority(priority)
    cache_key = _get_cache_key("alerts", priority)

    cached = cache.get(cache_key)
    if cached:
        return cached

    alerts = Alert.objects.order_by("-created_at")

    if priority != "all":
        alerts = alerts.filter(
            agent__priority__priority_name=priority
        )

    alerts = alerts[:limit]

    data = [
        {
            "message": alert.message[:100],
            "severity": alert.severity,
            "type": alert.alert_type,
            "timestamp": str(alert.created_at),
        }
        for alert in alerts
    ]

    cache.set(cache_key, data, CACHE_TTL)
    return data


# Invalidate dashboard-related caches when new checkpoints are saved
@receiver(post_save, sender=MonitoringCheckpoint)
def _invalidate_dashboard_cache_on_checkpoint(sender, instance, **kwargs):
    priorities = ["p1", "p2", "p3", "p4", "np", "all"]
    try:
        for p in priorities:
            cache.delete(_get_cache_key("dashboard", p))
            cache.delete(_get_cache_key("servers", p))
            cache.delete(_get_cache_key("alerts", p))
    except Exception:
        logger = logging.getLogger(__name__)
        logger.exception("Failed to invalidate dashboard cache for checkpoint %s", getattr(instance, "uuid", None))