# ITAD Platform Backend

Node.js + Express + TypeScript backend for the IT Asset Disposition (ITAD) SaaS workflow platform.

## Tech Stack

- **Node.js** with **TypeScript**
- **Express** for REST APIs
- **PostgreSQL** with **Prisma** ORM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Multer** for file uploads
- **PDFKit** for PDF generation

## Project Structure

```
backend/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Server entry point
│   ├── config/               # Configuration
│   │   ├── database.ts       # Prisma client
│   │   └── env.ts            # Environment config
│   ├── routes/               # API routes
│   ├── controllers/          # Request handlers
│   ├── services/             # Business logic
│   ├── repositories/         # Data access layer
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts          # Authentication & authorization
│   │   ├── validator.ts     # Request validation
│   │   └── workflow.ts      # Workflow state machine
│   ├── utils/               # Utility functions
│   │   ├── errors.ts        # Error handling
│   │   ├── jwt.ts           # JWT utilities
│   │   ├── password.ts      # Password hashing
│   │   └── co2.ts           # CO2 calculations
│   └── types/               # TypeScript types
├── prisma/
│   └── schema.prisma         # Database schema
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database
2. Copy `.env.example` to `.env` and update `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/itad_db?schema=public"
```

3. Generate Prisma client and push schema:

```bash
npm run db:generate
npm run db:push
```

Or use migrations:

```bash
npm run db:migrate
```

### 3. Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/itad_db?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV=development

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760

# Mock ERP
MOCK_ERP_ENABLED=true
ERP_BASE_URL="http://localhost:3001/api/erp"

# Warehouse Location (for CO2 calculations)
WAREHOUSE_POSTCODE="RM13 8BT"
WAREHOUSE_LAT=51.5174
WAREHOUSE_LNG=0.1904

# EmailJS (for sending invitation emails)
EMAILJS_ENABLED=true
EMAILJS_SERVICE_ID=service_xxxxx
EMAILJS_TEMPLATE_ID=template_xxxxx
EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxx
EMAILJS_PRIVATE_KEY=xxxxxxxxxxxxx  # Optional but recommended for Node.js/backend
FRONTEND_URL=http://localhost:5173
SUPPORT_EMAIL=support@example.com

# Note: If EMAILJS_PRIVATE_KEY is not set, you must enable 
# "API calls for non-browser applications" in EmailJS dashboard
```

### 4. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login
- `POST /api/auth/signup` - Signup
- `GET /api/auth/me` - Get current user

### Bookings

- `POST /api/bookings` - Create booking
- `GET /api/bookings` - List bookings
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings/:id/assign-driver` - Assign driver (admin)
- `PATCH /api/bookings/:id/status` - Update booking status (admin)

### Jobs

- `GET /api/jobs` - List jobs
- `GET /api/jobs/:id` - Get job by ID
- `PATCH /api/jobs/:id/status` - Update job status
- `PATCH /api/jobs/:id/evidence` - Update job evidence (driver)

### Dashboard

- `GET /api/dashboard/stats` - Get dashboard statistics

### Asset Categories

- `GET /api/asset-categories` - List asset categories
- `POST /api/asset-categories` - Create asset category (admin)

### Clients

- `GET /api/clients` - List clients
- `GET /api/clients/:id` - Get client by ID

## Roles

- **admin** - Full access, manages workflows
- **client** - Creates bookings, views own jobs
- **reseller** - Read-only access to referred clients' jobs
- **driver** - Mobile PWA user, manages assigned jobs

## Workflow States

### Booking Lifecycle
```
created → scheduled → collected → sanitised → graded → completed
```

### Job Workflow
```
booked → routed → en_route → arrived → collected → warehouse → sanitised → graded → completed
```

## Database Schema

The database schema is defined in `prisma/schema.prisma`. Key models:

- **User** - Users with roles
- **Tenant** - Company/brand (single tenant)
- **Client** - Clients (can belong to reseller)
- **Booking** - Initial booking request
- **Job** - Workflow execution
- **AssetCategory** - Asset types with CO2e values
- **Evidence** - Driver uploads (photos, signatures)
- **CO2Result** - CO2 calculation results
- **BuybackResult** - Buyback estimates and final values
- **FinanceStatus** - ERP finance tracking
- **Document** - Manual PDF uploads
- **Certificate** - Generated certificates
- **Invoice** - Invoice tracking
- **Commission** - Reseller commissions

## Mock ERP Integration

The backend includes a Mock ERP service (`src/services/mock-erp.service.ts`) that simulates ERP API calls. This can be replaced with real ERP integration by:

1. Setting `MOCK_ERP_ENABLED=false` in `.env`
2. Implementing real ERP client in `mock-erp.service.ts`
3. Updating `ERP_BASE_URL` to real ERP endpoint

## CO2 Calculation

CO2 calculations are performed using the same logic as the frontend:

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
- `AppError` - Generic application error

## Security

- Passwords are hashed using bcryptjs
- JWT tokens for authentication
- Role-based authorization middleware
- Input validation using express-validator
- CORS enabled for frontend

## Development

```bash
# Development with hot reload
npm run dev

# Build
npm run build

# Start production server
npm start

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

## Notes

- This is a single-tenant system (one company, one brand)
- ERP is external integration only (not used as database)
- Finance logic (invoices, VAT, payments) is ERP-owned
- Backend controls workflows, permissions, documents, and business logic
- No multi-tenancy or white-label features
