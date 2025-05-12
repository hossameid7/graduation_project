# Power Transformer Monitoring System

## Overview
The Power Transformer Monitoring System is a comprehensive web-based platform for monitoring and predicting the health status of power transformers. It uses advanced machine learning models (CatBoost) to analyze gas concentrations and predict transformer health status and remaining useful life.

## Features

### Core Features
- **Multi-language Support**: Full support for English, Arabic, and Russian with RTL handling
- **Real-time Transformer Monitoring**: Dashboard with current status and historical data
- **Health Prediction**: Advanced ML-based prediction of transformer health status (FDD) and remaining useful life (RUL)
- **Historical Analysis**: Comprehensive history view with filtering and search capabilities
- **PDF Report Generation**: Generate detailed PDF reports of transformer measurements

### User Management
- Secure authentication system
- User profile management
- Role-based access control
- Company and personal information management

### Technical Features
- RESTful API architecture
- Real-time data visualization using Recharts
- Responsive design with Tailwind CSS
- Secure session management

## Technology Stack

### Frontend
- React 18 with TypeScript
- Zustand for state management
- React Query for data fetching
- i18next for internationalization
- Tailwind CSS for styling
- Recharts for data visualization
- Lucide React for icons

### Backend
- Django REST Framework
- SQLite database
- CatBoost ML models
- JWT authentication
- CORS support

## System Architecture
The system follows a client-server architecture with:
- **Frontend Layer**: React-based SPA
- **API Layer**: Django REST Framework
- **Data Layer**: SQLite + ML Models
- **Integration Layer**: RESTful APIs

For detailed architecture, see `architecture.puml`.

## Installation

### Frontend Setup
1. Navigate to FRONT-END/project
```bash
cd FRONT-END/project
npm install
npm run dev
```

### Backend Setup
1. Navigate to BACK-END/power_analysis
```bash
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## API Endpoints

### Authentication
- POST `/api/login/` - User login
- POST `/api/signup/` - User registration
- POST `/api/logout/` - User logout

### User Management
- GET/PUT `/api/profile/` - Get/Update user profile
- POST `/api/change-password/` - Change password
- DELETE `/api/profile/` - Delete account

### Transformer Management
- GET/POST `/api/transformers/` - List/Create transformers
- GET/PUT/DELETE `/api/transformers/{id}/` - Manage specific transformer

### Measurements
- GET/POST `/api/measurements/` - List/Create measurements
- GET `/api/measurements/{id}/` - Get specific measurement

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
REACT_APP_HUGGINGFACE_API_KEY=your_api_key_here
```

### Backend (.env)
```
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1
```

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License
Proprietary - All rights reserved


## To generate ERD from backend 

python manage.py graph_models -a --dot -o erd.dot
dot -Tpng erd.dot -o erd.png
