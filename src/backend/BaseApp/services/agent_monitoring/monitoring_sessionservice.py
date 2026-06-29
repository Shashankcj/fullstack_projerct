from django.utils import timezone

class MonitoringSessionService:
    @staticmethod
    def end_session(agent):
        from BaseApp.models import MonitoringSession
        active_session = MonitoringSession.objects.filter(agent=agent, ended_at__isnull=True).last()
        if active_session:
            active_session.ended_at = timezone.now()
            active_session.save(update_fields=["ended_at"])
