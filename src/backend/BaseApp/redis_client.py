import redis
from django.conf import settings
import logging

rdb = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=settings.REDIS_MON_DB)

    