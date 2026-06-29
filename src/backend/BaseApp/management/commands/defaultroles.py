from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from BaseApp.models.roles import Role, PermissionSet

class Command(BaseCommand):
    help = 'Create/Manage Default Roles'
    default_roles = ['Administrator', 'Administrator (Read-Only)', 'Global User']

    def add_arguments(self, parser):
        parser.add_argument(
            '--bootstrap',
            action='store_true',
            help='Run the bootstrap setup sequence',
        )

        parser.add_argument(
            '--redeploy-default-permissions',
            action='store_true',
            help='Check and redeploy default permissions for existing roles',
        )

        parser.add_argument(
            '--get-permissions',
            type=str,
            help='Get permissions for a specific role (or "all" for all roles)',
        )

    def create_permission_set(self, role):
        if role.role_name == 'Administrator':
            for module in PermissionSet.get_modules():
                role.permissionset_set.create(module=module, create=True, read=True, update=True, delete=True)
            role.save()
        elif role.role_name == 'Administrator (Read-Only)':
            for module in PermissionSet.get_modules():
                role.permissionset_set.create(module=module, create=False, read=True, update=False, delete=False)
            role.save()
        elif role.role_name == 'Global User':
            role.permissionset_set.create(module='monitoring', create=False, read=True, update=False, delete=False)
            role.save()

    def bootstrap_roles(self):
        for role_name in Command.default_roles:
            self.stdout.write(self.style.NOTICE('Running bootstrap setup sequence...'))
            if not Role.objects.filter(role_name=role_name).exists():
                role = Role.objects.create(role_name=role_name)
                self.stdout.write(self.style.SUCCESS(f'Successfully created role: {role_name}'))
                self.create_permission_set(role)
            else:
                self.stdout.write(self.style.WARNING(f'Role already exists: {role_name}'))

    def handle(self, *args, **options):
        try:
            if options['bootstrap']:
                self.bootstrap_roles()

            elif options['redeploy_default_permissions']:
                self.stdout.write(self.style.NOTICE('Redeploying default permissions for existing roles...'))
                for role_name in Command.default_roles:
                    try:
                        role = Role.objects.get(role_name=role_name)
                        role.permissionset_set.all().delete()
                        self.create_permission_set(role)
                        self.stdout.write(self.style.SUCCESS(f'Successfully redeployed permissions for role: {role_name}'))
                    except Role.DoesNotExist:
                        self.stdout.write(self.style.ERROR(f'Role does not exist: {role_name}'))
                        self.bootstrap_roles()
            elif options['get_permissions']:
                role_name = options['get_permissions']
                try:
                    if role_name == 'all':
                        role_name = Command.default_roles
                    else:
                        role_name = [role_name]
                    for rn in role_name:
                        role = Role.objects.get(role_name=rn)
                        self.stdout.write(self.style.NOTICE(f'Role: {rn}')) 
                        permissions = role.permissionset_set.all()
                        for perm in permissions:
                            self.stdout.write(f'Module: {perm.module}\n\tCreate: {perm.create}\n\tRead: {perm.read}\n\tUpdate: {perm.update}\n\tDelete: {perm.delete}\n\n')
                        self.stdout.write('---')
                except Role.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'Role does not exist: {role_name}'))
                    
                      
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error creating role {role_name}: {e}'))