from django.core.management.base import BaseCommand
from BaseApp.models import GlobalConfig
from BaseApp.models.priority_group import PriorityGroup


class Command(BaseCommand):
    help = 'Manage Global Configuration Settings'

    # ─────────────────────────────────────────────
    # DEFAULT GLOBAL CONFIG VALUES
    # ─────────────────────────────────────────────
    DEFAULT_VALUES = {
        # ── DEFAULT (no priority group) ────────────
        'monitoring.cpuThreshold':              '90',
        'monitoring.cpu_warning_threshold':     '75',
        'monitoring.ramThreshold':              '85',
        'monitoring.ram_warning_threshold':     '70',
        'monitoring.diskThreshold':             '89',
        'monitoring.disk_warning_threshold':    '75',
        'monitoring.networkThreshold':          '80',
        'monitoring.network_warning_threshold': '5',
        'monitoring.repeatFrequency':           '5',   # critical repeat
        'monitoring.warning_repeatFrequency':   '10',  # ✅ warning repeat
        'monitoring.ip_ping_interval':          '30',

        # ── PRIORITY 1 ─────────────────────────────
        'monitoring_p1.cpuThreshold':              '90',
        'monitoring_p1.cpu_warning_threshold':     '75',
        'monitoring_p1.ramThreshold':              '85',
        'monitoring_p1.ram_warning_threshold':     '70',
        'monitoring_p1.diskThreshold':             '90',
        'monitoring_p1.disk_warning_threshold':    '75',
        'monitoring_p1.networkThreshold':          '80',
        'monitoring_p1.network_warning_threshold': '5',
        'monitoring_p1.repeatFrequency':           '1',   # critical repeat
        'monitoring_p1.warning_repeatFrequency':   '3',   # ✅ warning repeat
        'monitoring_p1.ip_ping_interval':          '5',

        # ── PRIORITY 2 ─────────────────────────────
        'monitoring_p2.cpuThreshold':              '85',
        'monitoring_p2.cpu_warning_threshold':     '70',
        'monitoring_p2.ramThreshold':              '80',
        'monitoring_p2.ram_warning_threshold':     '65',
        'monitoring_p2.diskThreshold':             '85',
        'monitoring_p2.disk_warning_threshold':    '70',
        'monitoring_p2.networkThreshold':          '90',
        'monitoring_p2.network_warning_threshold': '5',
        'monitoring_p2.repeatFrequency':           '2',   # critical repeat
        'monitoring_p2.warning_repeatFrequency':   '5',   # ✅ warning repeat
        'monitoring_p2.ip_ping_interval':          '10',

        # ── PRIORITY 3 ─────────────────────────────
        'monitoring_p3.cpuThreshold':              '85',
        'monitoring_p3.cpu_warning_threshold':     '70',
        'monitoring_p3.ramThreshold':              '80',
        'monitoring_p3.ram_warning_threshold':     '65',
        'monitoring_p3.diskThreshold':             '90',
        'monitoring_p3.disk_warning_threshold':    '75',
        'monitoring_p3.networkThreshold':          '90',
        'monitoring_p3.network_warning_threshold': '5',
        'monitoring_p3.repeatFrequency':           '3',   # critical repeat
        'monitoring_p3.warning_repeatFrequency':   '7',   # ✅ warning repeat
        'monitoring_p3.ip_ping_interval':          '20',

        # ── PRIORITY 4 ─────────────────────────────
        'monitoring_p4.cpuThreshold':              '90',
        'monitoring_p4.cpu_warning_threshold':     '75',
        'monitoring_p4.ramThreshold':              '90',
        'monitoring_p4.ram_warning_threshold':     '75',
        'monitoring_p4.diskThreshold':             '90',
        'monitoring_p4.disk_warning_threshold':    '75',
        'monitoring_p4.networkThreshold':          '90',
        'monitoring_p4.network_warning_threshold': '5',
        'monitoring_p4.repeatFrequency':           '4',   # critical repeat
        'monitoring_p4.warning_repeatFrequency':   '8',   # ✅ warning repeat
        'monitoring_p4.ip_ping_interval':          '25',

        # ── SHARED CONFIG ──────────────────────────
        'monitoring.ip_ping_count':   '2',
        'monitoring.ip_ping_timeout': '4',
        'alert.enable_email_alerts':  str(True),
        'dataretention.auditlogs':    '365',
    }

    # ─────────────────────────────────────────────
    def add_arguments(self, parser):
        parser.add_argument(
            '--bootstrap',
            action='store_true',
            help='Create default global configuration entries',
        )
        parser.add_argument(
            '--load-to-redis',
            action='store_true',
            help='Load configuration to Redis',
        )

    # ─────────────────────────────────────────────
    def handle(self, *args, **options):

        # ── STEP 1: BOOTSTRAP DB CONFIG ────────────
        if options['bootstrap']:
            self.stdout.write(self.style.NOTICE('Bootstrapping global configuration...'))

            for item_key in GlobalConfig.ALLOWED_KEYS:
                default_value = Command.DEFAULT_VALUES.get(item_key, '')

                if not GlobalConfig.objects.filter(item_key=item_key).exists():
                    GlobalConfig.objects.create(
                        item_key=item_key,
                        item_value=default_value
                    )
                    self.stdout.write(self.style.SUCCESS(f'Created config: {item_key}'))
                else:
                    self.stdout.write(self.style.WARNING(f'Already exists: {item_key}'))

            self.stdout.write(self.style.NOTICE('Bootstrapping PriorityGroups...'))

            PRIORITY_GROUPS = ["p1", "p2", "p3", "p4", "np"]

            for priority in PRIORITY_GROUPS:
                group, created = PriorityGroup.objects.get_or_create(
                    priority_name=priority
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(
                        f'Created PriorityGroup: {priority} (UUID: {group.uuid})'
                    ))
                else:
                    self.stdout.write(self.style.WARNING(
                        f'Already exists: PriorityGroup {priority}'))

            self.stdout.write(self.style.SUCCESS('Bootstrap completed successfully!'))

        # ── STEP 2: LOAD TO REDIS ──────────────────
        elif options['load_to_redis']:
            from BaseApp.redis_client import rdb

            self.stdout.write(self.style.NOTICE('Loading GlobalConfig → Redis...'))

            GlobalConfig.load_global_config_to_redis(rdb)

            self.stdout.write(self.style.SUCCESS('All configurations loaded successfully!'))

        # ── NO ARGUMENT PROVIDED ───────────────────
        else:
            self.stdout.write(self.style.WARNING(
                'No option provided. Use:\n'
                '--bootstrap OR --load-to-redis'
            ))