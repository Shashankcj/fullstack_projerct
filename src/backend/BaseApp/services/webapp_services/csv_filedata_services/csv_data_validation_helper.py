import io
import logging
import csv
from django.core.validators import validate_ipv4_address, validate_ipv6_address
from django.core.exceptions import ValidationError
from BaseApp.models import Agent, Device, IPAddress

logger = logging.getLogger(__name__)

class DeviceCSVValidator:
    """CSV validator that returns hostname, IP, status, and OS for frontend display"""
    
    def __init__(self):
        self.valid_statuses = ['Active', 'Inactive', 'Maintenance', 'Retired', 'Unknown']
        self.supported_os = [
            'Windows', 'Ubuntu', 'Linux', 'macOS', 'CentOS', 'RHEL', 
            'Debian', 'Fedora', 'SUSE', 'FreeBSD', 'Android', 'iOS'
        ]
    
    def validate_ip_address(self, ip_address):
        """Validate IP address format"""
        if not ip_address:
            return False
        
        try:
            validate_ipv4_address(ip_address)
            return True
        except ValidationError:
            try:
                validate_ipv6_address(ip_address)
                return True
            except ValidationError:
                return False
    
    def validate_os(self, os_name):
        """Validate operating system"""
        if not os_name:
            return False
        return any(supported_os.lower() in os_name.lower() 
                  for supported_os in self.supported_os)
    
    def normalize_csv_record(self, row):
        """Normalize CSV record - include all fields for frontend display"""
        return {
            'hostname': ( 
                row.get('hostname') or 
                row.get('device_name') or 
                row.get('name') or 
                row.get('computer_name') or ''
            ).strip(),
            'ip_address': ( 
                row.get('ip_address') or 
                row.get('ip') or 
                row.get('address') or ''
            ).strip(),
            'status': (
                row.get('status') or 
                row.get('isActive') or 
                row.get('active') or 'Inactive'
            ).strip(),
            'os': (
                row.get('os') or 
                row.get('operating_system') or 
                row.get('platform') or 'Unknown'
            ).strip()
        }
    
    def validate_device_record(self, device_data, row_number):
        """Validate hostname, IP, status, and OS"""
        errors = []
        
        # Hostname validation
        if not device_data['hostname']:
            errors.append({
                'row': row_number,
                'field': 'hostname',
                'message': f'Hostname is required on row {row_number}'
            })
        elif len(device_data['hostname']) > 100:
            errors.append({
                'row': row_number,
                'field': 'hostname',
                'message': f'Hostname too long on row {row_number} (max 100 characters)'
            })
        
        # IP validation
        if not device_data['ip_address']:
            errors.append({
                'row': row_number,
                'field': 'ip_address',
                'message': f'IP address is required on row {row_number}'
            })
        elif not self.validate_ip_address(device_data['ip_address']):
            errors.append({
                'row': row_number,
                'field': 'ip_address',
                'message': f'Invalid IP address format on row {row_number}: {device_data["ip_address"]}'
            })
        
        # Status validation (normalize if invalid)
        if device_data['status'] not in self.valid_statuses:
            device_data['status'] = 'Inactive'
        
        # OS validation (warn but don't fail)
        if device_data['os'] and not self.validate_os(device_data['os']):
            device_data['os'] = device_data['os']  # Keep original but flag as unsupported
            device_data['os_warning'] = True
        
        return errors
    
    def get_existing_devices_from_db(self):
        """Fetch hostname, IP, status, and OS from database"""
        try:
            agents_with_ips = Agent.objects.select_related('device').prefetch_related(
                'device__nic__port__ip'
            ).all()
            
            devices_by_ip = {}
            devices_by_hostname = {}
            all_devices = []
            
            for agent in agents_with_ips:
                # Get all IP addresses for this agent
                ip_addresses = []
                if hasattr(agent, 'device') and agent.device:
                    for nic in agent.device.nic.all():
                        for port in nic.port.all():
                            for ip_obj in port.ip.all():
                                ip_addresses.append(ip_obj.address)
                
                # Create device record with all required fields
                device_record = {
                    'agent_uuid': str(agent.uuid),
                    'hostname': agent.hostname or 'Unknown',
                    'ip_addresses': ip_addresses,
                    'primary_ip': ip_addresses[0] if ip_addresses else None,
                    'status': agent.status or 'Unknown',
                    'os': agent.os or 'Unknown',
                }
                
                all_devices.append(device_record)
                
                # Index by hostname
                if agent.hostname:
                    devices_by_hostname[agent.hostname.lower()] = device_record
                
                # Index by IP addresses
                for ip_addr in ip_addresses:
                    devices_by_ip[ip_addr.lower()] = device_record
            
            logger.info(f"📊 Database devices loaded: {len(all_devices)} total devices")
            return {
                'all': all_devices,
                'by_ip': devices_by_ip,
                'by_hostname': devices_by_hostname,
            }
        except Exception as e:
            logger.error(f"Error fetching devices from database: {e}")
            return {'all': [], 'by_ip': {}, 'by_hostname': {}}
    
    def detect_csv_duplicates(self, csv_devices):
        """Detect duplicates within CSV file"""
        duplicates = []
        seen_ips = {}
        seen_hostnames = {}
        
        for i, device in enumerate(csv_devices):
            row_num = i + 2
            
            # Check IP duplicates
            ip_key = device['ip_address'].lower()
            if ip_key in seen_ips:
                duplicates.append({
                    'type': 'csv_duplicate',
                    'field': 'ip_address',
                    'value': device['ip_address'],
                    'rows': [seen_ips[ip_key], row_num],
                    'message': f'Duplicate IP address in CSV: {device["ip_address"]} (rows {seen_ips[ip_key]} and {row_num})'
                })
            else:
                seen_ips[ip_key] = row_num
            
            # Check hostname duplicates
            hostname_key = device['hostname'].lower()
            if hostname_key in seen_hostnames:
                duplicates.append({
                    'type': 'csv_duplicate',
                    'field': 'hostname',
                    'value': device['hostname'],
                    'rows': [seen_hostnames[hostname_key], row_num],
                    'message': f'Duplicate hostname in CSV: {device["hostname"]} (rows {seen_hostnames[hostname_key]} and {row_num})'
                })
            else:
                seen_hostnames[hostname_key] = row_num
        
        return duplicates
    
    def compare_with_database(self, csv_devices, db_devices):
        """Compare CSV devices with database"""
        results = {
            'new_devices': [],
            'existing_matches': [],
            'conflicts': []
        }
        
        for i, csv_device in enumerate(csv_devices):
            row_num = i + 2
            
            # Check for exact IP match
            ip_match = db_devices['by_ip'].get(csv_device['ip_address'].lower())
            # Check for hostname match  
            hostname_match = db_devices['by_hostname'].get(csv_device['hostname'].lower())
            
            # Prepare device data for frontend display
            frontend_device = {
                'hostname': csv_device['hostname'],
                'ip_address': csv_device['ip_address'], 
                'status': csv_device['status'],
                'os': csv_device['os'],
                'row_number': row_num,
                'source': 'csv_import'
            }
            
            if ip_match and hostname_match and ip_match == hostname_match:
                # Perfect match
                results['existing_matches'].append({
                    **frontend_device,
                    'id': ip_match['agent_uuid'],
                    'import_status': 'existing',
                    'match_type': 'perfect_match',
                    'existing_device': {
                        'hostname': ip_match['hostname'],
                        'ip_address': ip_match['primary_ip'], 
                        'status': ip_match['status'],
                        'os': ip_match['os']
                    }
                })
            
            elif ip_match and not hostname_match:
                # IP exists but hostname different
                results['conflicts'].append({
                    **frontend_device,
                    'import_status': 'conflict',
                    'reason': f'IP {csv_device["ip_address"]} exists with different hostname: {ip_match["hostname"]}',
                    'conflict_type': 'ip_exists_different_hostname',
                    'existing_device': {
                        'hostname': ip_match['hostname'],
                        'ip_address': ip_match['primary_ip'],
                        'status': ip_match['status'], 
                        'os': ip_match['os']
                    }
                })
            
            elif hostname_match and not ip_match:
                # Hostname exists but IP different
                results['conflicts'].append({
                    **frontend_device,
                    'import_status': 'conflict',
                    'reason': f'Hostname {csv_device["hostname"]} exists with different IP: {hostname_match["primary_ip"]}',
                    'conflict_type': 'hostname_exists_different_ip',
                    'existing_device': {
                        'hostname': hostname_match['hostname'],
                        'ip_address': hostname_match['primary_ip'],
                        'status': hostname_match['status'],
                        'os': hostname_match['os']
                    }
                })
            
            else:
                # New device
                results['new_devices'].append({
                    **frontend_device,
                    'id': f'new-{row_num}',
                    'import_status': 'new'
                })
        
        return results
    
    def process_csv_file(self, csv_file, group_name):
        """Main method to process CSV file and return data for frontend"""
        logger.info(f"🔄 Processing CSV file: {csv_file.name} for group: {group_name}")
        
        try:
            # Read CSV content
            content = csv_file.read().decode('utf-8')
            csv_file.seek(0)
            
            # Parse CSV
            csv_reader = csv.DictReader(io.StringIO(content))
            
            valid_devices = []
            validation_errors = []
            row_number = 1
            
            # Step 1: Basic validation
            for row in csv_reader:
                row_number += 1
                
                normalized_device = self.normalize_csv_record(row)
                device_errors = self.validate_device_record(normalized_device, row_number)
                
                if device_errors:
                    validation_errors.extend(device_errors)
                else:
                    valid_devices.append(normalized_device)
            
            # If validation failed, return early
            if validation_errors:
                logger.warning(f"⚠️ CSV validation failed with {len(validation_errors)} errors")
                return {
                    'success': False,
                    'error': f'CSV validation failed with {len(validation_errors)} errors',
                    'validation_errors': validation_errors,
                    'devices': [],
                    'stats': {
                        'total': row_number - 1,
                        'valid': 0,
                        'invalid': len(validation_errors),
                        'new': 0,
                        'existing': 0,
                        'conflicts': 0,
                        'csv_duplicates': 0,
                        'success': 0
                    }
                }
            
            # Step 2: Check for CSV duplicates
            csv_duplicates = self.detect_csv_duplicates(valid_devices)
            
            # Step 3: Compare with database
            logger.info("🔍 Comparing with database devices...")
            db_devices = self.get_existing_devices_from_db()
            comparison_results = self.compare_with_database(valid_devices, db_devices)
            
            # Step 4: Compile results for frontend
            all_processed_devices = (
                comparison_results['new_devices'] + 
                comparison_results['existing_matches'] + 
                comparison_results['conflicts']
            )
            
            # Calculate statistics
            stats = {
                'total': len(valid_devices),
                'valid': len(valid_devices),
                'invalid': len(validation_errors),
                'new': len(comparison_results['new_devices']),
                'existing': len(comparison_results['existing_matches']),
                'conflicts': len(comparison_results['conflicts']),
                'csv_duplicates': len(csv_duplicates),
                'success': len(comparison_results['new_devices']) + len(comparison_results['existing_matches'])
            }
            
            logger.info(f"✅ CSV processing complete: {stats}")
            
            return {
                'success': True,
                'devices': all_processed_devices, 
                'validation': {
                    'errors': validation_errors,
                    'csv_duplicates': csv_duplicates,
                },
                'stats': stats,
                'group_name': group_name
            }
            
        except UnicodeDecodeError as e:
            logger.error(f"❌ CSV encoding error: {e}")
            return {
                'success': False,
                'error': 'Invalid CSV file encoding. Please ensure the file is UTF-8 encoded.',
                'stats': {'total': 0, 'valid': 0, 'invalid': 0, 'new': 0, 'existing': 0, 'conflicts': 0, 'csv_duplicates': 0, 'success': 0}
            }
        
        except Exception as e:
            logger.error(f"❌ CSV processing error: {e}")
            return {
                'success': False,
                'error': f'Error processing CSV file: {str(e)}',
                'stats': {'total': 0, 'valid': 0, 'invalid': 0, 'new': 0, 'existing': 0, 'conflicts': 0, 'csv_duplicates': 0, 'success': 0}
            }


# Convenience function
def validate_and_process_csv(csv_file, group_name):
    """Validate CSV and return data with hostname, IP, status, and OS for frontend"""
    validator = DeviceCSVValidator()
    return validator.process_csv_file(csv_file, group_name)
