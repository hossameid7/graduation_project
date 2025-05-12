import csv
import os
import glob
import datetime
import random
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from api.models import Transformer, TransformerMeasurement

User = get_user_model()

class Command(BaseCommand):
    help = 'Bulk import transformer measurements from multiple CSV files with FDD and RUL values'

    def add_arguments(self, parser):
        parser.add_argument('data_dir', type=str, help='Directory containing transformer CSV files')
        parser.add_argument('--username', type=str, required=True, help='Username of the owner of the transformers')
        parser.add_argument('--fdd_labels', type=str, required=True, help='Path to FDD labels CSV file')
        parser.add_argument('--rul_labels', type=str, required=True, help='Path to RUL labels CSV file')

    def load_labels(self, label_file):
        labels = {}
        if not os.path.exists(label_file):
            raise CommandError(f'Label file "{label_file}" does not exist')
            
        with open(label_file, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                transformer_file = row['id']
                value = float(row.get('category', row.get('predicted', 0)))
                labels[transformer_file] = value
        return labels

    def handle(self, *args, **options):
        data_dir = options['data_dir']
        username = options['username']
        fdd_labels_path = options['fdd_labels']
        rul_labels_path = options['rul_labels']
        RECORDS_PER_FILE = 20  # Number of records to import per file

        if not os.path.exists(data_dir):
            raise CommandError(f'Data directory "{data_dir}" does not exist')

        # Load FDD and RUL labels
        try:
            fdd_labels = self.load_labels(fdd_labels_path)
            rul_labels = self.load_labels(rul_labels_path)
        except Exception as e:
            raise CommandError(f'Error loading label files: {str(e)}')

        try:
            # Get or create user
            user, created = User.objects.get_or_create(username=username)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created new user: {username}'))

            # Get list of all CSV files in the data directory
            csv_files = glob.glob(os.path.join(data_dir, '*.csv'))
            if not csv_files:
                raise CommandError(f'No CSV files found in directory: {data_dir}')

            total_transformers = 0
            total_measurements = 0

            # Process each transformer file
            for csv_file_path in csv_files:
                transformer_filename = os.path.basename(csv_file_path)
                
                # Skip if this transformer has no labels
                if transformer_filename not in fdd_labels or transformer_filename not in rul_labels:
                    self.stdout.write(
                        self.style.WARNING(f'Skipping {transformer_filename} - No labels found')
                    )
                    continue

                # Get FDD and RUL values for this transformer
                fdd_value = fdd_labels[transformer_filename]
                rul_value = rul_labels[transformer_filename]

                # Create transformer with name from filename (without .csv extension)
                transformer_name = os.path.splitext(transformer_filename)[0]
                transformer, created = Transformer.objects.get_or_create(
                    name=transformer_name,
                    user=user
                )
                if created:
                    total_transformers += 1

                measurements_created = 0
                try:
                    with open(csv_file_path, 'r') as csvfile:
                        reader = csv.DictReader(csvfile)
                        rows = list(reader)  # Convert to list to get total count
                        total_rows = len(rows)
                        
                        # Calculate step size to evenly distribute 20 records
                        step = max(1, total_rows // RECORDS_PER_FILE)
                        selected_indices = range(0, total_rows, step)[:RECORDS_PER_FILE]
                        
                        for idx in selected_indices:
                            try:
                                row = rows[idx]
                                # Create measurement with FDD and RUL from labels
                                measurement = TransformerMeasurement.objects.create(
                                    transformer=transformer,
                                    co=float(row['CO']),
                                    h2=float(row['H2']),
                                    c2h2=float(row['C2H2']),
                                    c2h4=float(row['C2H4']),
                                    fdd=fdd_value,
                                    rul=rul_value,
                                    timestamp=datetime.datetime.now() - datetime.timedelta(seconds=random.randint(0, 1000000)),
                                    temperature=None  # Add temperature if available in your data
                                )
                                measurements_created += 1

                            except Exception as e:
                                self.stdout.write(
                                    self.style.WARNING(
                                        f'Error creating measurement for {transformer_name}: {str(e)}\nRow data: {row}'
                                    )
                                )
                                continue

                    total_measurements += measurements_created
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Imported {measurements_created} measurements for transformer "{transformer_name}" '
                            f'with FDD={fdd_value}, RUL={rul_value}'
                        )
                    )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'Error processing file {transformer_filename}: {str(e)}'
                        )
                    )
                    continue

            self.stdout.write(
                self.style.SUCCESS(
                    f'\nImport completed:\n'
                    f'- Created {total_transformers} new transformers\n'
                    f'- Imported {total_measurements} total measurements\n'
                    f'- All data assigned to user: {username}'
                )
            )

        except Exception as e:
            raise CommandError(f'Error during bulk import: {str(e)}')