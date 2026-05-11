import api from './api';

export const applicationService = {
  createApplication: async (applicationData) => {
    return await api.post('/applications', applicationData);
  },

  getApplicationById: async (id) => {
    return await api.get(`/applications/${id}`);
  },

  getMyApplications: async (params) => {
    return await api.get('/student/applications', { params });
  },

  withdrawApplication: async (id) => {
    return await api.patch(`/applications/${id}/withdraw`);
  },

  getApplicants: async (driveId, params) => {
    return await api.get(`/recruiter/drives/${driveId}/applicants`, { params });
  },

  shortlistApplicants: async (applicationIds) => {
    return await api.post('/recruiter/applicants/shortlist', { applicationIds });
  },

  rejectApplicants: async (applicationIds, reason) => {
    return await api.post('/recruiter/applicants/reject', {
      applicationIds,
      reason,
    });
  },

  updateApplicationStatus: async (id, status, remarks) => {
    return await api.patch(`/recruiter/applications/${id}/status`, {
      status,
      remarks,
    });
  },

  addInterviewFeedback: async (id, feedbackData) => {
    return await api.post(`/recruiter/applications/${id}/interview-feedback`, feedbackData);
  },

  // Get AI-powered resume score
  getAIResumeScore: async (applicationId) => {
    return await api.get(`/applications/${applicationId}/ai-score`);
  },

  // AI Shortlist: run 5-dimension rubric on all applicants for a drive
  aiShortlistCandidates: async (driveId, jobDescription) => {
    return await api.post(`/recruiter/drives/${driveId}/ai-shortlist`, { jobDescription });
  },

  // HR Override: flag / approve / reject a candidate score with a reason
  hrOverrideScore: async (applicationId, overrideType, reason, adjustedScore) => {
    return await api.patch(`/recruiter/applications/${applicationId}/hr-override`, {
      overrideType, reason, adjustedScore,
    });
  },

  // Step 2: Parse JD text into structured requirements
  parseJD: async (jdText) => {
    return await api.post('/recruiter/parse-jd', { jdText });
  },

  // Step 1: Upload a PDF JD file and extract text
  extractJDFile: async (file) => {
    const formData = new FormData();
    formData.append('jdFile', file);
    return await api.post('/recruiter/extract-jd-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

