#!/bin/bash
set -e



cd src/backend
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


python -m nuitka   --standalone   --follow-imports   --assume-yes-for-downloads   --module-parameter=django-settings-module=CentralServer.settings     --include-data-file=BaseApp/urls.py=BaseApp/urls.py   --include-data-file=BaseApp/views.py=BaseApp/views.py   --include-data-file=CentralServer/urls.py=CentralServer/urls.py   --include-data-dir=Keys=Keys     --include-package=django   --include-package=daphne   --include-package=rest_framework   --include-package=channels   --include-package=channels_redis   --include-package=whitenoise   --include-package=rest_framework_simplejwt   --include-package=rest_framework_simplejwt.token_blacklist   --include-package=corsheaders   --include-package=oauth2_provider   --include-package=django_celery_beat   --include-package=celery   --include-package=requests   --include-package=BaseApp   --include-package=CentralServer   --include-package=redis   --include-package=zope.interface   --include-package=psycopg2   --include-package=cryptography   --include-package=autobahn   --include-package=h2   --include-package=txaio   --include-package=kombu   --include-package=billiard   --include-package=amqp   --include-package=msgpack   --include-package=asgiref   --include-package=hyperlink   --include-package=django.contrib.admin   --include-package=django.contrib.auth   --include-package=django.contrib.contenttypes   --include-package=django.contrib.sessions   --include-package=django.contrib.messages   --include-package=django.contrib.staticfiles     --include-package-data=BaseApp   --include-package-data=CentralServer   --include-package-data=django.contrib.admin   --include-package-data=django.contrib.auth   --include-package-data=django.contrib.contenttypes   --include-package-data=django.contrib.sessions   --include-package-data=django.contrib.messages   --include-package-data=django.contrib.staticfiles   --include-package-data=rest_framework   --include-package-data=rest_framework_simplejwt   --include-package-data=rest_framework_simplejwt.token_blacklist   --include-package-data=corsheaders   --include-package-data=oauth2_provider   --include-package-data=django_celery_beat   --include-package-data=daphne   --include-package-data=channels     --include-module=CentralServer.asgi   --include-module=CentralServer.wsgi   --include-module=CentralServer.urls     --include-data-dir=BaseApp/migrations=BaseApp/migrations   --include-data-dir="$DJANGO_BASE_PATH/contrib/admin/templates"=django/contrib/admin/templates   --include-data-dir="$DJANGO_BASE_PATH/forms/templates"=django/forms/templates   --include-data-dir=staticfiles=staticfiles     --output-dir=dist   --output-filename=genesis_server   manage.py

VENV=$(python -c "import site; print(site.getsitepackages()[0])")
DIST="dist/manage.dist"

echo "Copying migrations to $DIST"

mkdir -p "$DIST/rest_framework_simplejwt/token_blacklist"
cp -r \
    "$VENV/rest_framework_simplejwt/token_blacklist/migrations" \
    "$DIST/rest_framework_simplejwt/token_blacklist/"

mkdir -p "$DIST/django_celery_beat"
cp -r \
    "$VENV/django_celery_beat/migrations" \
    "$DIST/django_celery_beat/"