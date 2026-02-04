# ITAD Platform Backend

Node.js + Express + TypeScript backend for the IT Asset Disposition (ITAD) SaaS workflow platform.

## Overview

This backend provides a RESTful API for managing IT asset disposition workflows, including booking management, job tracking, CO2e calculations, buyback estimates, and ERP integration.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT with httpOnly cookies
- **Security:** Helmet, CSRF protection, rate limiting
- **File Upload:** Multer with S3 support
- **PDF Generation:** PDFKit
- **Logging:** Winston

## Project Structure

```
backend/
├── src/
│   ├── app.ts                 # Express app configuration
│   ├── server.ts              # Server entry point
│   ├── config/                # Configuration
│   │   ├── database.ts       # Prisma client
│   │   ├── env.ts            # Environment config
│   │   └── env-validation.ts # Environment validation
│   ├── routes/               # API route definitions
│   ├── controllers/          # Request handlers
│   ├── services/             # Business logic
│   ├── repositories/         # Data access layer
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts          # Authentication & authorization
│   │   ├── csrf.ts          # CSRF protection
│   │   ├── validator.ts     # Request validation
│   │   └── workflow.ts      # Workflow state machine
│   ├── utils/               # Utility functions
│   │   ├── errors.ts        # Error handling
│   │   ├── jwt.ts           # JWT utilities
│   │   ├── password.ts      # Password hashing
│   │   ├── co2.ts           # CO2 calculations
│   │   └── logger.ts        # Logging utilities
│   └── types/               # TypeScript types
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/          # Database migrations
├── scripts/                 # Utility scripts
├── ecosystem.config.js      # PM2 configuration
└── package.json
```

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL database (local or AWS RDS)
- AWS S3 bucket (optional, for file storage in production)

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/itad_db?schema=public"
# For production with AWS RDS:
DATABASE_URL_PROD="postgresql://postgres:password@your-rds-instance.region.rds.amazonaws.com:5432/itaddb?schema=public"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
JWT_EXPIRES_IN="7d"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=20971520  # 20MB in bytes

# ERP Integration
MOCK_ERP_ENABLED=false
ERP_BASE_URL="https://your-erp-api.com/api/erp"

# Warehouse Location (for CO2 calculations)
WAREHOUSE_POSTCODE="RM13 8BT"
WAREHOUSE_LAT=51.5174
WAREHOUSE_LNG=0.1904

# Email Configuration (EmailJS)
EMAILJS_ENABLED=true
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_TEMPLATE_ID=your_template_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com
SUPPORT_EMAIL=support@yourdomain.com

# CORS (optional, defaults to FRONTEND_URL)
CORS_ORIGIN=https://your-frontend-domain.com

# AWS S3 (optional, for production file storage)
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your-bucket-name
USE_S3_STORAGE=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# OpenRouteService (for route calculations)
OPENROUTESERVICE_API_KEY=your_api_key
```

### 3. Database Setup

#### Generate Prisma Client

```bash
npm run db:generate
```

#### Apply Database Schema

For development:
```bash
npm run db:push
```

For production:
```bash
npx prisma migrate deploy
```

#### Open Prisma Studio (Optional)

```bash
npm run db:studio
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reload enabled.

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Using PM2 (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit

# Stop
pm2 stop ecosystem.config.js
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - Logout user (protected)
- `POST /api/auth/change-password` - Change password (protected)

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - List bookings (with filters)
- `GET /api/bookings/:id` - Get booking details
- `PATCH /api/bookings/:id/status` - Update booking status (admin)
- `POST /api/bookings/:id/assign-driver` - Assign driver (admin)

### Jobs
- `GET /api/jobs` - List jobs (with filters)
- `GET /api/jobs/:id` - Get job details
- `PATCH /api/jobs/:id/status` - Update job status
- `PATCH /api/jobs/:id/evidence` - Update job evidence (driver)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Asset Categories
- `GET /api/asset-categories` - List asset categories
- `POST /api/asset-categories` - Create category (admin)
- `PATCH /api/asset-categories/:id` - Update category (admin)
- `DELETE /api/asset-categories/:id` - Delete category (admin)

### Clients
- `GET /api/clients` - List clients
- `GET /api/clients/:id` - Get client details
- `POST /api/clients` - Create client (admin)
- `PATCH /api/clients/:id` - Update client (admin)

### Sites
- `GET /api/sites` - List sites
- `GET /api/sites/:id` - Get site details
- `POST /api/sites` - Create site
- `PATCH /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Delete site

### Users
- `GET /api/users` - List users (admin)
- `GET /api/users/:id` - Get user details (admin)
- `PATCH /api/users/:id` - Update user (admin)
- `PATCH /api/users/:id/status` - Update user status (admin)

### Drivers
- `GET /api/drivers` - List drivers
- `GET /api/drivers/:id` - Get driver details

### Invites
- `POST /api/invites` - Create invite (admin)
- `GET /api/invites/:token` - Get invite details
- `POST /api/invites/:token/accept` - Accept invite

### CO2 Calculations
- `POST /api/co2/calculate` - Calculate CO2e impact
- `GET /api/co2/job/:jobId` - Get CO2e data for job

### Buyback
- `POST /api/buyback/calculate` - Calculate buyback estimate
- `GET /api/buyback/job/:jobId` - Get buyback data for job

### Sanitisation
- `POST /api/sanitisation/complete` - Complete sanitisation (admin)
- `GET /api/sanitisation/job/:jobId` - Get sanitisation data

### Grading
- `POST /api/grading/complete` - Complete grading (admin)
- `GET /api/grading/job/:jobId` - Get grading data

### Documents
- `GET /api/documents` - List documents
- `POST /api/documents` - Upload document
- `GET /api/documents/:id` - Get document
- `DELETE /api/documents/:id` - Delete document

### Notifications
- `GET /api/notifications` - List notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read

### Organisation Profile
- `GET /api/organisation-profile` - Get organisation profile
- `PATCH /api/organisation-profile` - Update organisation profile

## User Roles

- **admin** - Full system access, manages workflows, users, and settings
- **client** - Creates bookings, views own jobs and reports
- **reseller** - Manages clients, views referred clients' jobs
- **driver** - Mobile PWA user, manages assigned jobs and uploads evidence

## Workflow States

### Booking Lifecycle
```
created → scheduled → collected → sanitised → graded → completed
```

### Job Workflow
```
booked → routed → en_route → arrived → collected → warehouse → sanitised → graded → completed
```

## Security Features

- **JWT Authentication** - Tokens stored in httpOnly cookies
- **CSRF Protection** - Token-based CSRF validation
- **Password Hashing** - bcryptjs with salt rounds
- **Rate Limiting** - Request rate limiting per IP
- **Input Validation** - express-validator for request validation
- **XSS Protection** - Input sanitization with sanitize-html
- **Security Headers** - Helmet.js for security headers
- **CORS** - Configurable CORS policy
- **File Upload Security** - File type and size validation

## Database Schema

Key models:
- **User** - System users with roles
- **Tenant** - Organisation/company (single tenant)
- **Client** - Clients (can belong to reseller)
- **Site** - Client sites/locations
- **Booking** - Initial booking requests
- **Job** - Workflow execution instances
- **AssetCategory** - Asset types with CO2e values
- **Evidence** - Driver uploads (photos, signatures)
- **CO2Result** - CO2 calculation results
- **BuybackResult** - Buyback estimates and final values
- **Document** - Uploaded documents
- **Certificate** - Generated certificates
- **Notification** - User notifications
- **OrganisationProfile** - Organisation settings

## ERP Integration

The backend supports ERP integration for finance tracking. Configure in `.env`:

- Set `MOCK_ERP_ENABLED=false` to use real ERP
- Set `ERP_BASE_URL` to your ERP API endpoint
- Implement ERP client in `src/services/mock-erp.service.ts` if needed

## CO2 Calculation

CO2 calculations include:
- Reuse savings based on asset categories
- Travel emissions based on vehicle type and distance
- Net impact calculation
- Equivalencies (trees, household days, car miles, flight hours)

## Error Handling

All errors are handled centrally via `errorHandler` middleware. Custom error classes:
- `ValidationError` - 400 Bad Request
- `UnauthorizedError` - 401 Unauthorized
- `ForbiddenError` - 403 Forbidden
- `NotFoundError` - 404 Not Found
- `AppError` - Generic application error (500)

## Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Unhandled exceptions
- `logs/rejections.log` - Unhandled promise rejections

Log levels: `error`, `warn`, `info`, `debug`

## Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Build
npm run build            # Build TypeScript to JavaScript

# Production
npm start                # Start production server

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to database (development)
npm run db:migrate       # Create migration (development)
npx prisma migrate deploy # Apply migrations (production)
npm run db:studio        # Open Prisma Studio

# Utilities
npm run db:cleanup       # Cleanup database
npm run db:check-categories # Check categories
npm run db:update-categories # Update categories
```

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Configure production database (RDS)
3. Set secure `JWT_SECRET` (minimum 32 characters)
4. Configure S3 for file storage (optional)
5. Set up reverse proxy (Nginx) with SSL
6. Use PM2 for process management
7. Configure log rotation
8. Set up monitoring and alerts

## Notes

- Single-tenant system (one company, one brand)
- ERP is external integration only (not used as database)
- Finance logic (invoices, VAT, payments) is ERP-owned
- Backend controls workflows, permissions, documents, and business logic
- File uploads can use local storage or AWS S3

## Support

For issues or questions, contact: support@yourdomain.com
