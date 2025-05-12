#!/usr/bin/env python3
import csv
import random
import datetime
import math
import os

def generate_synthetic_data(
    filename, 
    start_date=datetime.datetime(2023, 1, 1), 
    days=30, 
    readings_per_day=24,
    transformer_count=1,
    add_anomalies=True
):
    """
    Generate synthetic transformer measurement data.
    
    Args:
        filename: Output CSV filename
        start_date: Starting date for the dataset
        days: Number of days to generate data for
        readings_per_day: Number of readings per day
        transformer_count: Number of transformers to generate data for
        add_anomalies: Whether to add anomalies to the data
    """
    # Base values and variations for each gas
    gases = {
        'h2': {'base': 100, 'daily_variation': 20, 'hourly_variation': 5},
        'co': {'base': 300, 'daily_variation': 50, 'hourly_variation': 10},
        'c2h2': {'base': 50, 'daily_variation': 10, 'hourly_variation': 2},
        'c2h4': {'base': 150, 'daily_variation': 30, 'hourly_variation': 5},
        'temperature': {'base': 75, 'daily_variation': 5, 'hourly_variation': 2},
    }
    
    # Create anomaly periods (if enabled)
    anomaly_periods = []
    if add_anomalies:
        # Add 1-3 anomaly periods
        for _ in range(random.randint(1, 3)):
            anomaly_start = random.randint(0, days - 3)  # Start day of anomaly
            anomaly_length = random.randint(1, 3)        # Length in days
            severity = random.uniform(1.5, 3.0)          # Severity multiplier
            anomaly_periods.append({
                'start': anomaly_start,
                'end': anomaly_start + anomaly_length,
                'severity': severity
            })
    
    # Prepare the data
    all_data = []
    
    # For each transformer
    for transformer_id in range(1, transformer_count + 1):
        # Create a starting point with some variation between transformers
        transformer_bases = {}
        for gas, values in gases.items():
            transformer_bases[gas] = values['base'] * random.uniform(0.8, 1.2)
        
        # For each day
        for day in range(days):
            # Calculate daily variations (slow changes over days)
            daily_factors = {}
            for gas, values in gases.items():
                # Use sine wave for natural cyclical variations
                daily_factors[gas] = math.sin(day / 10) * values['daily_variation']
            
            # For each reading in the day
            for reading in range(readings_per_day):
                # Calculate time
                hours = (24 / readings_per_day) * reading
                current_time = start_date + datetime.timedelta(days=day, hours=hours)
                
                # Calculate hourly variations
                hourly_factors = {}
                for gas, values in gases.items():
                    # Add some random hourly variation
                    hourly_factors[gas] = random.uniform(-1, 1) * values['hourly_variation']
                
                # Check if we're in an anomaly period
                anomaly_factor = 1.0
                for anomaly in anomaly_periods:
                    if anomaly['start'] <= day < anomaly['end']:
                        anomaly_factor = anomaly['severity']
                        # Gradually increase and decrease anomaly
                        progress = (day - anomaly['start']) / (anomaly['end'] - anomaly['start'])
                        if progress < 0.3:
                            # Ramp up
                            anomaly_factor = 1.0 + (anomaly['severity'] - 1.0) * (progress / 0.3)
                        elif progress > 0.7:
                            # Ramp down
                            anomaly_factor = anomaly['severity'] - (anomaly['severity'] - 1.0) * ((progress - 0.7) / 0.3)
                
                # Calculate final values for each gas
                values = {}
                for gas, base in transformer_bases.items():
                    base_value = base + daily_factors[gas] + hourly_factors[gas]
                    # Apply anomaly factor, but more to some gases than others
                    if gas in ['h2', 'c2h2']:  # These gases are more affected by anomalies
                        values[gas] = base_value * (anomaly_factor ** 1.5)
                    else:
                        values[gas] = base_value * anomaly_factor
                    # Ensure values are positive
                    values[gas] = max(1.0, values[gas])
                
                # Add row to data
                all_data.append({
                    'transformer': transformer_id,
                    'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S'),
                    'h2': round(values['h2'], 1),
                    'co': round(values['co'], 1),
                    'c2h2': round(values['c2h2'], 1),
                    'c2h4': round(values['c2h4'], 1),
                    'temperature': round(values['temperature'], 1)
                })
    
    # Sort by timestamp
    all_data.sort(key=lambda x: x['timestamp'])
    
    # Write to CSV
    with open(filename, 'w', newline='') as csvfile:
        fieldnames = ['timestamp', 'transformer', 'co', 'h2', 'c2h2', 'c2h4', 'temperature']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in all_data:
            writer.writerow(row)
    
    print(f"Generated {len(all_data)} readings for {transformer_count} transformers spanning {days} days")
    print(f"Data saved to {filename}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate synthetic transformer measurement data')
    parser.add_argument('--output', type=str, default='synthetic_data.csv', help='Output CSV filename')
    parser.add_argument('--days', type=int, default=30, help='Number of days to generate data for')
    parser.add_argument('--readings', type=int, default=24, help='Readings per day')
    parser.add_argument('--transformers', type=int, default=2, help='Number of transformers')
    parser.add_argument('--start', type=str, default='2023-01-01', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--no-anomalies', action='store_true', help='Disable anomaly generation')
    
    args = parser.parse_args()
    
    start_date = datetime.datetime.strptime(args.start, '%Y-%m-%d')
    
    generate_synthetic_data(
        args.output,
        start_date=start_date,
        days=args.days,
        readings_per_day=args.readings,
        transformer_count=args.transformers,
        add_anomalies=not args.no_anomalies
    ) 