// Document Routes
import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const documentController = new DocumentController();

// Get documents for a job
router.get('/job/:jobId', authenticate, documentController.getJobDocuments.bind(documentController));

// Get documents for a booking
router.get('/booking/:bookingId', authenticate, documentController.getBookingDocuments.bind(documentController));

// Download a document
router.get('/:id/download', authenticate, documentController.downloadDocument.bind(documentController));

// Get all documents for current user
router.get('/', authenticate, documentController.getMyDocuments.bind(documentController));

export default router;

