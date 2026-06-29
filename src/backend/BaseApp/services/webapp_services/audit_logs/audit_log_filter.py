
import django_filters
from BaseApp.models.audit_logs import AuditLog
from django.db.models import Q

class AuditLogFilter(django_filters.FilterSet):
    user = django_filters.CharFilter(lookup_expr='icontains')
    action = django_filters.CharFilter(lookup_expr='iexact')
    model_name = django_filters.CharFilter(lookup_expr='icontains')  # Search enabled
    #  Dynamically get choices from model field
    severity_display  = django_filters.CharFilter(
        method='filter_severity_display',
        label='Severity'
    )
    start_date = django_filters.DateTimeFilter(
        field_name='timestamp',
        lookup_expr='gte',
    )
    
    end_date = django_filters.DateTimeFilter(
        field_name='timestamp',
        lookup_expr='lte',
    )

    
    # Multi-field search - searches across all fields
    search = django_filters.CharFilter(method='filter_search', label='Search All Fields')
    
    def filter_search(self, queryset, name, value):
        """
        Search across multiple fields: user, model_name, severity, description
        """
        if not value:
            return queryset
        
        q_objects =(
            Q(user__icontains=value) |
            Q(model_name__icontains=value) |
            Q(description__icontains=value) |
            Q(action__icontains=value) |
            Q(ip__icontains=value)
        )
        #  If searching for severity display name, convert to DB values
        if hasattr(AuditLog,'SEVERITY_CHOICES'):
             # Find matching DB values for the search term
            matching_actions = []
            for action_value, display_name in AuditLog.SEVERITY_CHOICES:
                if value.lower() in display_name.lower():
                    matching_actions.append(action_value)
            
            if matching_actions:
                print(f"matching actions for severity '{value}': {matching_actions}")
                q_objects |= Q(action__in=matching_actions)
        
        return queryset.filter(q_objects)
    class Meta:
        model = AuditLog
        fields = ['user', 'action', 'model_name','timestamp']

    def filter_severity_display(self, queryset, name, value):
        """
        Filter by severity display name (Success, Info, Warning, Critical)
        Frontend sends display names, we map them to database values
        """
        if not value:
            return queryset
        
        # Check if model has SEVERITY_CHOICES
        if hasattr(AuditLog, 'SEVERITY_CHOICES'):
            for db_value, display_name in AuditLog.SEVERITY_CHOICES:
                if display_name.lower() == value.lower():
                    return queryset.filter(severity=db_value)
    