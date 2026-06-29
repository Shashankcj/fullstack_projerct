import functools
from django.utils import timezone
from asgiref.sync import sync_to_async as _sync_to_async
 
# --- Time Utilities ---
 
def now():
    """Returns the current timezone-aware datetime."""
    return timezone.now()


# --- Sync to Async Utilities ---
 
def sync_to_async(func=None, *, thread_sensitive=False):
    """
    A wrapper over asgiref.sync_to_async with defaults.
   
    By default, we assume most DB operations are thread-unsafe and set thread_sensitive=False.
    """
    if func is None:
        return lambda f: sync_to_async(f, thread_sensitive=thread_sensitive)
 
    return _sync_to_async(func, thread_sensitive=thread_sensitive)