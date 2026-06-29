# BaseApp/views/jobs.py

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from django.db.models import Q
import django_filters

from BaseApp.models.jobs import Job
from BaseApp.serializer import JobSerializer
from BaseApp.utils import check_permission
import os
import json
import csv
from django.http import HttpResponse
from django.conf import settings
settings.JOB_RESULTS_DIR.mkdir(parents=True, exist_ok=True)



# ===============================
# Pagination
# ===============================
class Pagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


# ===============================
# Filters
# ===============================
class JobFilter(django_filters.FilterSet):
    job_type = django_filters.CharFilter(field_name="job_type", lookup_expr="icontains")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    result = django_filters.CharFilter(field_name="result", lookup_expr="iexact")
    user = django_filters.CharFilter(field_name="user", lookup_expr="icontains")
    start_date = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    end_date = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")
    search = django_filters.CharFilter(method="filter_by_search")

    def filter_by_search(self, queryset, name, value):
        return queryset.filter(
            Q(job_type__icontains=value) |
            Q(user__icontains=value) |
            Q(status__icontains=value) |
            Q(result__icontains=value)
        )

    class Meta:
        model = Job
        fields = [
            "job_type", "status", "result",
            "user", "start_date", "end_date", "search"
        ]


@api_view(["GET"])
@check_permission(module="monitoring", allowed_action="read")
def get_jobs(request):
    try:
        filter_params = [
            "job_type", "status", "result",
            "user", "start_date", "end_date", "search"
        ]

        has_filter = any(request.query_params.get(p) for p in filter_params)

        queryset = Job.objects.all().order_by("-created_at")

        if not has_filter:
            queryset = queryset[:200]

        filterset = JobFilter(request.query_params, queryset=queryset)

        paginator = Pagination()
        page = paginator.paginate_queryset(filterset.qs, request)

        serializer = JobSerializer(page, many=True)
        return paginator.get_paginated_response({"jobs": serializer.data})

    except Exception:
        return Response(
            {"error": "Failed to retrieve jobs"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



# add at bottom of BaseApp/views/jobs.py




RESULTS_DIR = settings.JOB_RESULTS_DIR

@api_view(["GET"])
@check_permission(module="monitoring", allowed_action="read")
def download_job_result_csv(request, uuid):
    try:
        Job.objects.get(uuid=uuid)

        file_path = RESULTS_DIR / f"job_{uuid}.json"
        if not file_path.exists():
            return Response(
                {"error": "Job result file not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        with open(file_path, "r") as f:
            data = json.load(f)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="job_{uuid}.csv"'

        writer = csv.writer(response)

        writer.writerow(["SECTION", "KEY", "VALUE"])
        writer.writerow(["SUMMARY", "mode", data.get("mode")])

        for k, v in data.get("summary", {}).items():
            writer.writerow(["SUMMARY", k, v])

        writer.writerow([])

        def write_table(section_name, rows):
            if not rows:
                return

            writer.writerow([section_name])
            headers = list(rows[0].keys())
            writer.writerow(headers)

            for row in rows:
                writer.writerow([row.get(h) for h in headers])

            writer.writerow([])

        write_table("DUPLICATES_IN_DATABASE", data.get("duplicates_in_database_details", []))
        write_table("DUPLICATES_IN_CSV", data.get("duplicates_in_csv_details", []))
        write_table("CREATED_IPS", data.get("created_ips", []))
        write_table("UPDATED_IPS", data.get("updated_ips", []))

        if data.get("error_details"):
            write_table(
                "ERRORS",
                [{"error": e} for e in data.get("error_details", [])]
            )

        return response

    except Job.DoesNotExist:
        return Response(
            {"error": "Job not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["GET"])
@check_permission(module="monitoring",allowed_action="read")
def get_jobs_filter_options(request):
    """Retrieve filter options for alerts."""
    try:
        query_set=Job.objects.all()
     
        job_types=set(query_set.values_list('job_type', flat=True))
        users= set(query_set.values_list('user', flat=True))
        result= set(query_set.values_list('result', flat=True))
        
        
        return Response({
            'job_type': sorted(list(job_types)),
            'user': sorted(list(users)),
            'result':sorted(list(result))
        })
        
    except Exception as e:
        return Response({'error': 'Failed to retrieve filter options'}, status=500)
