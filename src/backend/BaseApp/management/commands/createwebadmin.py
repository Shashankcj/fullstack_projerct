from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from BaseApp.models.models import WebUser
from BaseApp.models.roles import Role
import getpass

class Command(BaseCommand):
    help = 'Create a web admin user'

    def add_arguments(self, parser):
        pass

    def handle(self, *args, **options):
        try:
            role = Role.objects.get(role_name='Administrator')

        except Role.DoesNotExist as e:
            # raise CommandError(f'Error in command execution: {e}')
            self.stdout.write(self.style.ERROR(f'Error fetching Administrator role instance : {e}'))
            call_command('defaultroles', bootstrap=True)
            role = Role.objects.get(role_name='Administrator')


        try:
            while True:
                username = input("Enter username for web admin user (default: webadmin): ") or "webadmin"
                if not WebUser.objects.filter(username=username).exists():
                    break
                else:
                    self.stdout.write(self.style.WARNING(f'Username already exists: {username}. Please choose a different username.'))

            while True:
                email = input("Enter email for web admin user (required - default: webadmin@example.com): ") or "webadmin@example.com"
                if not WebUser.objects.filter(email=email).exists():
                    break
                else:
                    self.stdout.write(self.style.WARNING(f'Email already exists: {email}. Please choose a different email.'))

            while True:
                password = getpass.getpass("Enter password for web admin user : ")
                if password.strip() == "":
                    self.stdout.write(self.style.WARNING('Password cannot be empty. Please try again.'))
                    continue
                confirm_password = getpass.getpass("Confirm password: ")
                if password == confirm_password:
                    break
                else:
                    self.stdout.write(self.style.WARNING('Passwords do not match. Please try again.'))

            WebUser.objects.create(
                role = role,
                username=username,
                email=email,
                password=make_password(password),
                is_user_enabled=True,
                is_email_verified = True,
                is_email_override=True,
            )
            self.stdout.write(self.style.SUCCESS(f'Successfully created web admin user: {username}'))
            
        except Exception as e:
            raise CommandError(f'Error creating web admin user: {e}')