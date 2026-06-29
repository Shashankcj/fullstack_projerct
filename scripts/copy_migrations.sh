#!/bin/bash
set -e
source venv/bin/activate
echo "Running collectstatic..."
yes yes | python manage.py collectstatic

echo "Finding Django path..."
DJANGO_BASE_PATH=$(python -c "import django; print(django.__path__[0])")

echo "Django path: $DJANGO_BASE_PATH"

if [ ! -d "$DJANGO_BASE_PATH/contrib/admin/templates" ]; then
    echo "Django admin templates not found!"
    exit 1
fi

cd src/backend

VENV=$(python -c "import site; print(site.getsitepackages()[0])")

for DIST in dist/manage.dist dist/celery_entry.dist
do
    echo "Copying migrations to $DIST"

    mkdir -p "$DIST/rest_framework_simplejwt/token_blacklist"
    cp -r \
      "$VENV/rest_framework_simplejwt/token_blacklist/migrations" \
      "$DIST/rest_framework_simplejwt/token_blacklist/"

    mkdir -p "$DIST/django_celery_beat"
    cp -r \
      "$VENV/django_celery_beat/migrations" \
      "$DIST/django_celery_beat/"
done