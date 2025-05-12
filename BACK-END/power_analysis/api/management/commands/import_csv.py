import csv
import os
import datetime
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from api.models import Transformer, TransformerMeasurement

User = get_user_model()

class Command(BaseCommand):
    help = 'Import transformer measurements from CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')
        parser.add_argument('--transformer_id', type=int, help='Transformer ID to associate with measurements')
        parser.add_argument('--transformer_name', type=str, help='Create or use transformer with this name')
        parser.add_argument('--username', type=str, help='Username of the owner of the transformer')

    def handle(self, *args, **options):
        csv_file_path = options['csv_file']
        transformer_id = options.get('transformer_id')
        transformer_name = options.get('transformer_name')
        username = options.get('username')

        if not os.path.exists(csv_file_path):
            raise CommandError(f'CSV file "{csv_file_path}" does not exist')

        try:
            # Get or create user
            if username:
                user, created = User.objects.get_or_create(username=username)
                if created:
                    self.stdout.write(self.style.SUCCESS(f'Created new user: {username}'))
            else:
                raise CommandError('Username is required')

            # Get or create transformer
            if transformer_id:
                try:
                    transformer = Transformer.objects.get(id=transformer_id, user=user)
                except Transformer.DoesNotExist:
                    raise CommandError(f'Transformer with ID {transformer_id} does not exist for user {username}')
            elif transformer_name:
                transformer, created = Transformer.objects.get_or_create(
                    name=transformer_name,
                    user=user
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f'Created new transformer: {transformer_name}'))
            else:
                raise CommandError('Either transformer_id or transformer_name is required')

            measurements_created = 0
            with open(csv_file_path, 'r') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    try:
                        # Parse the timestamp string into a datetime object
                        timestamp = datetime.datetime.strptime(row['timestamp'], '%m/%d/%Y %H:%M')
                        
                        # Create measurement
                        measurement = TransformerMeasurement.objects.create(
                            transformer=transformer,
                            co=float(row['co']),
                            h2=float(row['h2']),
                            c2h2=float(row['c2h2']),
                            c2h4=float(row['c2h4']),
                            fdd=float(row['fdd']),
                            rul=float(row['rul']),
                            timestamp=timestamp,
                            temperature=float(row['temperature']) if row['temperature'] else None
                        )
                        measurements_created += 1

                    except Exception as e:
                        self.stdout.write(
                            self.style.WARNING(
                                f'Error creating measurement: {str(e)}\nRow data: {row}'
                            )
                        )
                        continue

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully imported {measurements_created} measurements for transformer "{transformer.name}"'
                )
            )

        except Exception as e:
            raise CommandError(f'Error importing data: {str(e)}')