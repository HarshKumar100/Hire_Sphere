import Recruiter from '../models/Recruiter.js';
import Drive from '../models/Drive.js';
import Application from '../models/Application.js';
import Offer from '../models/Offer.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { uploadToFirebase } from '../config/firebase.js';
import { createNotification } from '../services/notificationService.js';
import { rankCandidatesForDrive, parseJobDescription, extractPdfTextFromBuffer as extractPdfFromBuffer } from '../services/aiService.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import https from 'https';
import http from 'http';
import fs from 'fs';

export const createProfile = async (req, res) => {
  try {
    const existingProfile = await Recruiter.findOne({ userId: req.user._id });
    if (existingProfile) {
      return sendErrorResponse(res, 'Profile already exists', 400);
    }

    const recruiter = await Recruiter.create({
      userId: req.user._id,
      ...req.body,
    });

    sendSuccessResponse(res, 'Profile created successfully. Awaiting admin approval.', { recruiter }, 201);
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const getProfile = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (!recruiter) {
      // Return null profile with 200 OK for new recruiters
      return sendSuccessResponse(res, 'Profile not found - new user', { recruiter: null });
    }

    sendSuccessResponse(res, 'Profile fetched successfully', { recruiter });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOneAndUpdate(
      { userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!recruiter) {
      return sendErrorResponse(res, 'Profile not found', 404);
    }

    sendSuccessResponse(res, 'Profile updated successfully', { recruiter });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const uploadCompanyLogo = async (req, res) => {
  try {
    if (!req.file) {
      return sendErrorResponse(res, 'Please upload a file', 400);
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (!recruiter) {
      return sendErrorResponse(res, 'Profile not found', 404);
    }

    if (recruiter.companyLogo?.publicId) {
      await deleteFromCloudinary(recruiter.companyLogo.publicId);
    }

    const uploadResult = await uploadToCloudinary(req.file.path, 'company-logos');

    recruiter.companyLogo = {
      url: uploadResult.url,
      publicId: uploadResult.public_id,
    };

    await recruiter.save();

    sendSuccessResponse(res, 'Company logo uploaded successfully', { recruiter });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const createDrive = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (!recruiter) {
      return sendErrorResponse(res, 'Recruiter profile not found', 404);
    }

    const drive = await Drive.create({
      recruiterId: recruiter._id,
      ...req.body,
      status: 'published',
      isApproved: true,
    });

    sendSuccessResponse(res, 'Drive created successfully', { drive }, 201);
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const getMyDrives = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (!recruiter) {
      return sendSuccessResponse(res, 'Profile required for drives', {
        drives: [],
        totalPages: 0,
        currentPage: 1,
        totalDrives: 0,
        profileRequired: true
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const query = { recruiterId: recruiter._id };
    if (status) query.status = status;

    const drives = await Drive.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get application counts for all drives
    const driveIds = drives.map(d => d._id);
    const applicationCounts = await Application.aggregate([
      { $match: { driveId: { $in: driveIds } } },
      { $group: { _id: '$driveId', count: { $sum: 1 } } }
    ]);

    // Create a map of driveId -> count
    const countMap = {};
    applicationCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Add applicationsCount to each drive
    const drivesWithCounts = drives.map(drive => ({
      ...drive,
      applicationsCount: countMap[drive._id.toString()] || 0,
    }));

    const count = await Drive.countDocuments(query);

    sendSuccessResponse(res, 'Drives fetched successfully', {
      drives: drivesWithCounts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalDrives: count,
    });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const getDriveById = async (req, res) => {
  try {
    const { id } = req.params;

    const drive = await Drive.findById(id).populate('recruiterId', 'companyName');

    if (!drive) {
      return sendErrorResponse(res, 'Drive not found', 404);
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (drive.recruiterId._id.toString() !== recruiter._id.toString()) {
      return sendErrorResponse(res, 'Unauthorized access', 403);
    }

    sendSuccessResponse(res, 'Drive details fetched successfully', { drive });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const updateDrive = async (req, res) => {
  try {
    const { id } = req.params;

    const drive = await Drive.findById(id);

    if (!drive) {
      return sendErrorResponse(res, 'Drive not found', 404);
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (drive.recruiterId.toString() !== recruiter._id.toString()) {
      return sendErrorResponse(res, 'Unauthorized access', 403);
    }

    // Update the drive
    const updateData = { ...req.body };

    updateData.status = 'published';
    updateData.isApproved = true;

    const updatedDrive = await Drive.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    sendSuccessResponse(res, 'Drive updated successfully', { drive: updatedDrive });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const closeDrive = async (req, res) => {
  try {
    const { id } = req.params;

    const drive = await Drive.findById(id);

    if (!drive) {
      return sendErrorResponse(res, 'Drive not found', 404);
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (drive.recruiterId.toString() !== recruiter._id.toString()) {
      return sendErrorResponse(res, 'Unauthorized access', 403);
    }

    drive.status = 'closed';
    await drive.save();

    sendSuccessResponse(res, 'Drive closed successfully', { drive });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const getApplicants = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const drive = await Drive.findById(id);

    if (!drive) {
      return sendErrorResponse(res, 'Drive not found', 404);
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (drive.recruiterId.toString() !== recruiter._id.toString()) {
      return sendErrorResponse(res, 'Unauthorized access', 403);
    }

    const query = { driveId: id };
    if (status) query.status = status;

    const applications = await Application.find(query)
      .populate({
        path: 'studentId',
        select: 'firstName lastName studentId email phone branch batch cgpa skills linkedIn github portfolio resumes',
        populate: {
          path: 'userId',
          select: 'email',
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Application.countDocuments(query);

    sendSuccessResponse(res, 'Applicants fetched successfully', {
      applications,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalApplicants: count,
    });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const shortlistApplicants = async (req, res) => {
  try {
    const { applicationIds } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return sendErrorResponse(res, 'Please provide application IDs', 400);
    }

    const applications = await Application.find({ _id: { $in: applicationIds } })
      .populate('studentId driveId');

    for (const application of applications) {
      application.status = 'shortlisted';
      application.timeline.push({
        status: 'shortlisted',
        updatedBy: req.user._id,
        remarks: 'Shortlisted by recruiter',
      });

      await application.save();

      await createNotification({
        recipientId: application.studentId.userId,
        type: 'application_update',
        title: 'Application Shortlisted',
        message: `Congratulations! You have been shortlisted for ${application.driveId.jobTitle} at ${application.driveId.companyName}`,
        relatedEntity: {
          entityType: 'application',
          entityId: application._id,
        },
      });
    }

    sendSuccessResponse(res, `${applications.length} applicants shortlisted successfully`);
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const rejectApplicants = async (req, res) => {
  try {
    const { applicationIds, reason } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return sendErrorResponse(res, 'Please provide application IDs', 400);
    }

    const applications = await Application.find({ _id: { $in: applicationIds } })
      .populate('studentId driveId');

    for (const application of applications) {
      // Store the current stage where rejection occurred
      const currentStage = application.status || 'applied';
      application.rejectedAtStage = currentStage;
      application.status = 'rejected';
      application.timeline.push({
        status: 'rejected',
        updatedBy: req.user._id,
        remarks: reason || `Rejected at ${currentStage} stage`,
      });

      await application.save();

      await createNotification({
        recipientId: application.studentId.userId,
        type: 'application_update',
        title: 'Application Update',
        message: `Your application for ${application.driveId.jobTitle} was not successful at the ${currentStage} stage.`,
        relatedEntity: {
          entityType: 'application',
          entityId: application._id,
        },
      });
    }

    sendSuccessResponse(res, `${applications.length} applicants rejected successfully`);
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const application = await Application.findById(id)
      .populate('studentId driveId');

    if (!application) {
      return sendErrorResponse(res, 'Application not found', 404);
    }

    application.status = status;
    application.timeline.push({
      status,
      updatedBy: req.user._id,
      remarks: remarks || `Status updated to ${status}`,
    });

    await application.save();

    await createNotification({
      recipientId: application.studentId.userId,
      type: 'application_update',
      title: 'Application Status Updated',
      message: `Your application for ${application.driveId.jobTitle} status has been updated to ${status}`,
      relatedEntity: {
        entityType: 'application',
        entityId: application._id,
      },
    });

    sendSuccessResponse(res, 'Application status updated successfully', { application });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const addInterviewFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { round, scheduledDate, interviewerName, feedback, result } = req.body;

    const application = await Application.findById(id);

    if (!application) {
      return sendErrorResponse(res, 'Application not found', 404);
    }

    application.interviewDetails.push({
      round,
      scheduledDate,
      interviewerName,
      feedback,
      result,
    });

    await application.save();

    sendSuccessResponse(res, 'Interview feedback added successfully', { application });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const createOffer = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate('studentId driveId');

    if (!application) {
      return sendErrorResponse(res, 'Application not found', 404);
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (application.driveId.recruiterId.toString() !== recruiter._id.toString()) {
      return sendErrorResponse(res, 'Unauthorized access', 403);
    }

    const existingOffer = await Offer.findOne({ applicationId });
    if (existingOffer) {
      return sendErrorResponse(res, 'Offer already exists for this application', 400);
    }

    if (!req.file) {
      return sendErrorResponse(res, 'Please upload offer letter', 400);
    }

    // Upload offer letter to Firebase Storage
    const uploadResult = await uploadToFirebase(req.file.path, 'offer-letters');

    const { designation, ctc, joiningDate, location, bondDuration, benefits, validUntil } = req.body;

    const offer = await Offer.create({
      applicationId: application._id,
      studentId: application.studentId._id,
      driveId: application.driveId._id,
      recruiterId: recruiter._id,
      offerDetails: {
        designation,
        ctc,
        joiningDate,
        location,
        bondDuration,
        benefits: benefits ? JSON.parse(benefits) : [],
      },
      offerLetter: {
        url: uploadResult.url, // Public Firebase Storage URL
        fileName: uploadResult.fileName, // Firebase Storage path for deletion
      },
      validUntil,
    });

    application.status = 'offered';
    application.timeline.push({
      status: 'offered',
      updatedBy: req.user._id,
      remarks: 'Offer letter issued',
    });
    await application.save();

    await createNotification({
      recipientId: application.studentId.userId,
      type: 'offer_received',
      title: 'Offer Received!',
      message: `Congratulations! You have received an offer for ${designation} at ${application.driveId.companyName}`,
      relatedEntity: {
        entityType: 'offer',
        entityId: offer._id,
      },
      priority: 'high',
    });

    sendSuccessResponse(res, 'Offer created successfully', { offer }, 201);
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

export const getDashboard = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (!recruiter) {
      return sendSuccessResponse(res, 'Dashboard data fetched successfully', {
        stats: {
          totalDrives: 0,
          activeDrives: 0,
          totalApplications: 0,
          offersIssued: 0,
        },
        recentDrives: [],
        isApproved: false,
        isNewUser: true
      });
    }

    const totalDrives = await Drive.countDocuments({ recruiterId: recruiter._id });
    const activeDrives = await Drive.countDocuments({ recruiterId: recruiter._id, status: 'published' });
    const totalApplications = await Application.countDocuments({
      driveId: { $in: await Drive.find({ recruiterId: recruiter._id }).distinct('_id') },
    });
    const offersIssued = await Offer.countDocuments({ recruiterId: recruiter._id });

    const recentDrives = await Drive.find({ recruiterId: recruiter._id })
      .sort({ createdAt: -1 })
      .limit(5);

    sendSuccessResponse(res, 'Dashboard data fetched successfully', {
      stats: {
        totalDrives,
        activeDrives,
        totalApplications,
        offersIssued,
      },
      recentDrives,
      isApproved: recruiter.isApproved,
    });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

// Helper: extract text from a PDF URL (used for candidate resumes stored remotely)
const fetchPdfFromUrl = async (pdfUrl) => {
  const fetchBuffer = (url, redirectCount = 0) => new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });

  try {
    const buffer = await fetchBuffer(pdfUrl);
    const uint8Array = new Uint8Array(buffer);
    const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    let text = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text.trim();
  } catch {
    return '';
  }
};

/**
 * POST /recruiter/drives/:id/ai-shortlist
 * Body: { jobDescription: string }
 *
 * Runs the 5-dimension rubric AI scorer on ALL applicants for a drive
 * and returns a ranked shortlist report.
 */
export const aiShortlistCandidates = async (req, res) => {
  try {
    const { id } = req.params;
    const { jobDescription } = req.body;

    if (!jobDescription || jobDescription.trim().length < 50) {
      return sendErrorResponse(res, 'Please provide a job description (at least 50 characters)', 400);
    }

    const drive = await Drive.findById(id);
    if (!drive) return sendErrorResponse(res, 'Drive not found', 404);

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (drive.recruiterId.toString() !== recruiter._id.toString()) {
      return sendErrorResponse(res, 'Unauthorized access', 403);
    }

    // Fetch all applicants (no status filter — score everyone)
    const applications = await Application.find({ driveId: id })
      .populate({
        path: 'studentId',
        select: 'firstName lastName studentId branch cgpa skills linkedIn github portfolio resumes activeBacklogs tenthMarks twelfthMarks',
      });

    if (applications.length === 0) {
      return sendErrorResponse(res, 'No applicants found for this drive', 404);
    }

    // Build candidate objects with resume text
    const candidates = await Promise.all(
      applications.map(async (app) => {
        const student = app.studentId;
        const resume = student?.resumes?.find(r => r.isDefault) || student?.resumes?.[0];
        const resumeText = resume?.url ? await fetchPdfFromUrl(resume.url) : '';
        return {
          applicationId: app._id,
          applicationStatus: app.status,
          hrOverride: app.hrOverride || null,
          firstName: student?.firstName || '',
          lastName: student?.lastName || '',
          studentId: student?.studentId || '',
          branch: student?.branch || '',
          cgpa: student?.cgpa || 0,
          activeBacklogs: student?.activeBacklogs || 0,
          tenthMarks: student?.tenthMarks,
          twelfthMarks: student?.twelfthMarks,
          skills: student?.skills || [],
          linkedIn: student?.linkedIn || '',
          github: student?.github || '',
          portfolio: student?.portfolio || '',
          resumeText,
          resumeTitle: resume?.title || '',
        };
      })
    );

    // Run AI ranking
    const ranked = await rankCandidatesForDrive(candidates, jobDescription.trim());

    sendSuccessResponse(res, 'AI shortlist generated successfully', {
      ranked,
      totalScored: ranked.length,
      totalApplicants: applications.length,
      driveTitle: drive.jobTitle,
      companyName: drive.companyName,
    });
  } catch (error) {
    console.error('aiShortlistCandidates error:', error);
    sendErrorResponse(res, error.message || 'Failed to generate AI shortlist', 500);
  }
};

/**
 * PATCH /recruiter/applications/:id/hr-override
 * Body: { overrideType: 'flag'|'approve'|'reject', reason: string, adjustedScore?: number }
 *
 * Human-in-the-loop hook: HR can flag, approve or reject a candidate with a reason.
 */
export const hrOverrideScore = async (req, res) => {
  try {
    const { id } = req.params;
    const { overrideType, reason, adjustedScore } = req.body;

    if (!overrideType || !reason?.trim()) {
      return sendErrorResponse(res, 'overrideType and reason are required', 400);
    }

    const application = await Application.findById(id);
    if (!application) return sendErrorResponse(res, 'Application not found', 404);

    application.hrOverride = {
      overrideType,
      reason: reason.trim(),
      adjustedScore: adjustedScore ?? null,
      overriddenBy: req.user._id,
      overriddenAt: new Date(),
    };

    await application.save();

    sendSuccessResponse(res, 'HR override saved successfully', { application });
  } catch (error) {
    sendErrorResponse(res, error.message, 500);
  }
};

/**
 * POST /recruiter/parse-jd
 * Body: { jdText: string }
 * Step 2 — Explicitly parse JD text into structured requirements using Gemini.
 */
export const parseJD = async (req, res) => {
  try {
    const { jdText } = req.body;
    if (!jdText || jdText.trim().length < 30) {
      return sendErrorResponse(res, 'Please provide job description text (min 30 chars)', 400);
    }
    const parsed = await parseJobDescription(jdText.trim());
    sendSuccessResponse(res, 'JD parsed successfully', { parsed });
  } catch (error) {
    sendErrorResponse(res, error.message || 'Failed to parse JD', 500);
  }
};

/**
 * POST /recruiter/extract-jd-file
 * multipart/form-data: file (PDF)
 * Extracts text from an uploaded PDF JD file.
 */
export const extractJDFile = async (req, res) => {
  try {
    if (!req.file) return sendErrorResponse(res, 'Please upload a PDF file', 400);
    // Use the aiService buffer-based extractor (not the URL-fetching helper)
    const fileBuffer = fs.readFileSync(req.file.path);
    const text = await extractPdfFromBuffer(fileBuffer);
    try { fs.unlinkSync(req.file.path); } catch {}
    if (!text || text.trim().length < 20) {
      return sendErrorResponse(res, 'Could not extract text from PDF. Please paste JD manually.', 422);
    }
    sendSuccessResponse(res, 'JD text extracted successfully', { jdText: text });
  } catch (error) {
    sendErrorResponse(res, error.message || 'Failed to extract JD from file', 500);
  }
};
