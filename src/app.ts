import express, { Express } from 'express';
import cors from 'cors';
import { errorHandler } from './utils/errors';
import authRoutes from './routes/auth.routes';
import bookingRoutes from './routes/booking.routes';
import jobRoutes from './routes/job.routes';
import dashboardRoutes from './routes/dashboard.routes';
import assetCategoriesRoutes from './routes/asset-categories.routes';
import clientsRoutes from './routes/clients.routes';
import driverRoutes from './routes/driver.routes';
import sitesRoutes from './routes/sites.routes';
import usersRoutes from './routes/users.routes';
import invitesRoutes from './routes/invites.routes';
import co2Routes from './routes/co2.routes';
import sanitisationRoutes from './routes/sanitisation.routes';
import gradingRoutes from './routes/grading.routes';
import notificationRoutes from './routes/notification.routes';
import organisationProfileRoutes from './routes/organisation-profile.routes';
import testEmailRoutes from './routes/test-email.routes';

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increase limit for image uploads

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/asset-categories', assetCategoriesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/invites', invitesRoutes);
app.use('/api/co2', co2Routes);
app.use('/api/sanitisation', sanitisationRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/organisation-profile', organisationProfileRoutes);

// Test email route (for debugging - remove in production or add auth)
if (process.env.NODE_ENV === 'development') {
  app.use('/api/test-email', testEmailRoutes);
}

// Error handler (must be last)
app.use(errorHandler);

export default app;
