# Power Transformer Monitor

This project provides a full-stack monitoring system for power transformers, consisting of a Django backend and React frontend with TypeScript.

## Features

- Real-time transformer monitoring
- Multi-language support (English, Arabic, Russian)
- PDF report generation with proper RTL support
- Email notifications and reports
- Interactive data visualization
- Predictive maintenance using ML models
- User authentication and authorization
- Mobile-responsive design

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- Visual Studio Code (recommended)

### Backend Setup

1. Create a virtual environment:
```powershell
cd BACK-END
python -m venv env
.\env\Scripts\Activate.ps1
```

2. Install dependencies:
```powershell
pip install -r requirements.txt
```

3. Run migrations:
```powershell
cd power_analysis
python manage.py migrate
```

4. Start the development server:
```powershell
python manage.py runserver
```

### Frontend Setup

1. Install dependencies:
```powershell
cd FRONT-END/project
npm install
```

2. Start the development server:
```powershell
npm run dev
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

## Tech Stack

### Backend
- Django 5.1
- Django REST Framework 3.16
- Channels 4.0 for WebSocket support
- JWT Authentication
- ML models with NumPy, Pandas, and scikit-learn

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- i18next for internationalization
- React Query
- Recharts and Plotly.js for data visualization
- jsPDF for PDF generation

## Development

The application runs on:
- Backend API: http://localhost:8000
- Frontend Dev Server: http://localhost:5173

## License

This project is proprietary software. All rights reserved.