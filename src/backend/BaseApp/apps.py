from django.apps import AppConfig

class BaseappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'BaseApp'

    def ready(self):
        import BaseApp.signals, logging
        # from redis_client import rdb
        # BaseappConfig.load_global_config_to_redis(rdb)

        