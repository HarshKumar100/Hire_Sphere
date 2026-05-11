import express from 'express';
import {
  createProfile, getProfile, updateProfile, uploadCompanyLogo,
  createDrive, getMyDrives, getDriveById, updateDrive, closeDrive,
  getApplicants, shortlistApplicants, rejectApplicants,
  updateApplicationStatus, addInterviewFeedback, createOffer,
  getDashboard, aiShortlistCandidates, hrOverrideScore,
  parseJD, extractJDFile,
} from '../controllers/recruiterController.js';
import { getMyNotifications, markAsRead, markAllAsRead, deleteNotification } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { uploadSingle } from '../middleware/uploadMiddleware.js';
import { validate, sanitizeInput } from '../middleware/validationMiddleware.js';
import { createRecruiterValidator } from '../validators/userValidator.js';
import { createDriveValidator, updateDriveValidator, driveIdValidator } from '../validators/driveValidator.js';
import { updateApplicationStatusValidator, addInterviewFeedbackValidator } from '../validators/applicationValidator.js';
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorizeRoles('recruiter'));

router.post('/profile', sanitizeInput, createRecruiterValidator, validate, createProfile);
router.get('/profile', getProfile);
router.patch('/profile', sanitizeInput, updateProfile);
router.post('/logo', uploadLimiter, uploadSingle('logo'), uploadCompanyLogo);

router.get('/dashboard', getDashboard);

router.post('/drives', sanitizeInput, createDriveValidator, validate, createDrive);
router.get('/drives', getMyDrives);
router.get('/drives/:id', driveIdValidator, validate, getDriveById);
router.patch('/drives/:id', sanitizeInput, updateDriveValidator, validate, updateDrive);
router.patch('/drives/:id/close', closeDrive);

router.get('/drives/:id/applicants', getApplicants);
router.post('/applicants/shortlist', sanitizeInput, shortlistApplicants);
router.post('/applicants/reject', sanitizeInput, rejectApplicants);
router.patch('/applications/:id/status', sanitizeInput, updateApplicationStatusValidator, validate, updateApplicationStatus);
router.post('/applications/:id/interview-feedback', sanitizeInput, addInterviewFeedbackValidator, validate, addInterviewFeedback);

router.post('/applications/:applicationId/offer', uploadLimiter, uploadSingle('offerLetter'), createOffer);

// AI Shortlist & HR Override
router.post('/drives/:id/ai-shortlist', sanitizeInput, aiShortlistCandidates);
router.patch('/applications/:id/hr-override', sanitizeInput, hrOverrideScore);

// JD Parsing (Step 2) + JD File Upload (Step 1)
router.post('/parse-jd', sanitizeInput, parseJD);
router.post('/extract-jd-file', uploadLimiter, uploadSingle('jdFile'), extractJDFile);

router.get('/notifications', getMyNotifications);
router.patch('/notifications/:id/read', markAsRead);
router.patch('/notifications/read-all', markAllAsRead);
router.delete('/notifications/:id', deleteNotification);

export default router;
