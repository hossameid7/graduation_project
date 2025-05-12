# Power Transformer Monitor

This project provides a full-stack monitoring system for power transformers, consisting of a Django backend and React frontend.

## Docker Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Production Setup

To run the application in production mode:

```bash
docker-compose up -d
```

This will:
- Build and start the backend on http://localhost:8000
- Build and start the frontend on http://localhost:3000

### Development Setup

For development with hot reloading:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This will:
- Start the backend on http://localhost:8000 with hot reloading
- Start the frontend Vite dev server on http://localhost:5173 with hot reloading

### Stopping the Application

```bash
# For production
docker-compose down

# For development
docker-compose -f docker-compose.dev.yml down
```

### Rebuilding Containers

If you make changes to Dockerfiles or add new dependencies:

```bash
# For production
docker-compose up -d --build

# For development
docker-compose -f docker-compose.dev.yml up -d --build
```

## Environment Variables

### Backend Environment Variables

- `DEBUG`: Enable/disable debug mode
- `SECRET_KEY`: Django secret key
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### Frontend Environment Variables

- `VITE_API_URL`: URL of the backend API server

## Email Configuration

The application supports sending screenshots of transformer status via email. To set this up:

1. Copy `.env.example` to `.env` in the BACK-END/power_analysis directory:
   ```bash
   cd BACK-END/power_analysis
   cp .env.example .env
   ```

2. Update the email settings in your `.env` file:
   ```
   EMAIL_HOST_USER=your-email@gmail.com
   EMAIL_HOST_PASSWORD=your-app-specific-password
   ```

If using Gmail:
1. Enable 2-Step Verification in your Google Account
2. Generate an App Password:
   - Go to your Google Account settings
   - Navigate to Security
   - Under "2-Step Verification", select "App passwords"
   - Select "Mail" and your device
   - Copy the generated password and use it as EMAIL_HOST_PASSWORD

Note: Keep your .env file secure and never commit it to version control.

## Project Structure

```
/
├── BACK-END/
│   ├── power_analysis/       # Django project directory
│   │   ├── api/              # API endpoints
│   │   ├── power_analysis/   # Django settings
│   │   └── manage.py         # Django management script
│   └── requriements.txt      # Python dependencies
│
├── FRONT-END/
│   └── project/              # React project directory
│       ├── src/              # React source code
│       ├── public/           # Static files
│       └── package.json      # NPM dependencies
│
├── docker-compose.yml        # Production Docker Compose config
└── docker-compose.dev.yml    # Development Docker Compose config
```

## Accessing the Application

- Backend API: http://localhost:8000
- Frontend (Production): http://localhost:3000
- Frontend (Development): http://localhost:5173



To add data from dataset : 

be at project dir:

python manage.py import_csv_temp  MOCK_DATA.csv --transformer_name b --username a