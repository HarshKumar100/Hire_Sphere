import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const extractPdfTextFromUrl = async (pdfUrl) => {
  const response = await fetch(pdfUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdfDoc = await loadingTask.promise;

  let textContent = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    textContent += content.items.map((item) => item.str).join(' ') + '\n';
  }

  return textContent.trim();
};

/**
 * Extract LinkedIn profile data using Gemini with Google Search grounding.
 * This searches Google's index of the LinkedIn profile (bypassing LinkedIn auth wall)
 * and returns structured profile information.
 */
const extractLinkedInProfile = async (linkedInUrl) => {
  if (!linkedInUrl) return null;

  try {
    // Use Gemini 2.0 Flash with Google Search grounding
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    });

    const prompt = `Search Google for this exact LinkedIn profile URL and extract ALL available information about the person: ${linkedInUrl}

Please search for the profile and retrieve:
1. Full name of the person
2. Current job title / headline
3. Current company and location
4. About / bio / summary section
5. Work experience: each role with company, title, and duration
6. Education: institutions, degrees, years
7. Skills listed on the profile
8. Certifications or achievements
9. Number of connections or followers if visible

Return ONLY a valid JSON object with this structure (fill in what you find, use null for unavailable fields):
{
  "name": "Full Name",
  "headline": "Current Role at Company",
  "location": "City, Country",
  "about": "About section text",
  "currentCompany": "Company Name",
  "experience": [{"role": "Title", "company": "Company", "duration": "2022 - Present"}],
  "education": [{"degree": "B.Tech CS", "institution": "College Name", "year": "2021-2025"}],
  "skills": ["Skill1", "Skill2"],
  "certifications": ["Cert1"],
  "connections": "500+"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Strip markdown code fences
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Extract first JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return { rawText: text.slice(0, 800) };
      }
    }
    return { rawText: text.slice(0, 800) };
  } catch (error) {
    console.error('LinkedIn extraction via Google Search error:', error.message);
    return null;
  }
};

/**
 * Simple web snapshot for non-LinkedIn URLs (portfolio, GitHub web page etc.)
 */
const extractWebSnapshot = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) return { url, title: null, description: null, snippet: null };
    const html = await response.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ||
      null;
    const snippet = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);
    return { url, title, description, snippet };
  } catch {
    return { url, title: null, description: null, snippet: null };
  }
};

/**
 * Generate test questions using AI based on job description and difficulty
 * @param {string} jobDescription - The job description to base questions on
 * @param {string} difficultyLevel - 'easy', 'medium', or 'hard'
 * @param {number} questionCount - Number of questions to generate
 * @param {string} questionType - 'mcq' or 'coding'
 * @returns {Promise<Array>} Array of generated questions
 */
export const generateQuestions = async (jobDescription, difficultyLevel, questionCount, questionType) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  let prompt;

  if (questionType === 'mcq') {
    prompt = `You are an expert technical interviewer. Generate ${questionCount} multiple choice questions for a technical assessment.

Job Description:
${jobDescription}

Difficulty Level: ${difficultyLevel}

Requirements:
- Questions should be relevant to the skills mentioned in the job description
- Each question should have exactly 4 options
- Only one option should be correct
- For ${difficultyLevel} difficulty:
  ${difficultyLevel === 'easy' ? '- Focus on basic concepts and fundamentals' : ''}
  ${difficultyLevel === 'medium' ? '- Include practical application scenarios and moderate complexity' : ''}
  ${difficultyLevel === 'hard' ? '- Include advanced concepts, edge cases, and complex problem-solving' : ''}

IMPORTANT: Respond ONLY with a valid JSON array, no additional text. The format must be exactly:
[
  {
    "type": "mcq",
    "title": "Brief title of the question",
    "question": "The full question text",
    "options": [
      { "text": "Option A text", "isCorrect": true },
      { "text": "Option B text", "isCorrect": false },
      { "text": "Option C text", "isCorrect": false },
      { "text": "Option D text", "isCorrect": false }
    ],
    "points": ${difficultyLevel === 'easy' ? 1 : difficultyLevel === 'medium' ? 2 : 3}
  }
]`;
  } else {
    prompt = `You are an expert technical interviewer. Generate ${questionCount} coding challenge questions for a technical assessment.

Job Description:
${jobDescription}

Difficulty Level: ${difficultyLevel}

Requirements:
- Questions should be relevant to the skills mentioned in the job description
- Each question should have a clear problem statement
- Include sample input and output
- Include 3 test cases (1 visible, 2 hidden)
- For ${difficultyLevel} difficulty:
  ${difficultyLevel === 'easy' ? '- Focus on basic algorithms like loops, conditionals, and simple data structures' : ''}
  ${difficultyLevel === 'medium' ? '- Include moderate algorithms, recursion, and common data structures' : ''}
  ${difficultyLevel === 'hard' ? '- Include advanced algorithms, optimization, and complex data structures' : ''}

IMPORTANT: Respond ONLY with a valid JSON array, no additional text. The format must be exactly:
[
  {
    "type": "coding",
    "title": "Brief title of the problem",
    "problemStatement": "Detailed problem description explaining what needs to be solved",
    "sampleInput": "Example input",
    "sampleOutput": "Expected output for the example",
    "testCases": [
      { "input": "test input 1", "expectedOutput": "expected output 1", "isHidden": false, "points": ${difficultyLevel === 'easy' ? 5 : difficultyLevel === 'medium' ? 8 : 10} },
      { "input": "test input 2", "expectedOutput": "expected output 2", "isHidden": true, "points": ${difficultyLevel === 'easy' ? 5 : difficultyLevel === 'medium' ? 8 : 10} },
      { "input": "test input 3", "expectedOutput": "expected output 3", "isHidden": true, "points": ${difficultyLevel === 'easy' ? 5 : difficultyLevel === 'medium' ? 8 : 10} }
    ],
    "points": ${difficultyLevel === 'easy' ? 15 : difficultyLevel === 'medium' ? 24 : 30}
  }
]`;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up the response - remove markdown code blocks if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse the JSON response
    const questions = JSON.parse(text);

    // Add order to each question
    return questions.map((q, index) => ({
      ...q,
      order: index,
    }));
  } catch (error) {
    console.error('AI Question Generation Error:', error);
    throw new Error('Failed to generate questions. Please try again.');
  }
};

/**
 * Analyze student test performance and provide improvement recommendations
 * @param {Object} testData - The test details including questions
 * @param {Object} submissionData - The student's submission with answers
 * @returns {Promise<Object>} Analysis with weak areas, focus topics, and recommendations
 */
export const analyzeTestPerformance = async (testData, submissionData) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Build analysis context from incorrect answers
  const incorrectQuestions = [];
  const allQuestions = testData.inlineQuestions || [];

  allQuestions.forEach((question, index) => {
    if (question.type === 'mcq') {
      const answer = submissionData.mcqAnswers?.find(a => a.questionIndex === index);
      if (answer && !answer.isCorrect) {
        incorrectQuestions.push({
          type: 'mcq',
          title: question.title || `Question ${index + 1}`,
          question: question.question,
          correctAnswer: question.options?.find(o => o.isCorrect)?.text,
          studentAnswer: question.options?.[answer.selectedOption]?.text,
        });
      }
    } else if (question.type === 'coding') {
      const submission = submissionData.codeSubmissions?.find(c => c.questionIndex === index);
      if (submission && submission.totalPassed < submission.totalTestCases) {
        incorrectQuestions.push({
          type: 'coding',
          title: question.title || `Problem ${index + 1}`,
          problemStatement: question.problemStatement,
          passedTests: submission.totalPassed,
          totalTests: submission.totalTestCases,
        });
      }
    }
  });

  const prompt = `You are an expert technical mentor helping a student improve their skills. Analyze their test performance and provide actionable feedback.

Test Title: ${testData.title}
Test Type: ${testData.type}
Student Score: ${submissionData.scores?.percentage}%
Passed: ${submissionData.scores?.passed ? 'Yes' : 'No'}

Incorrect/Partially Correct Questions:
${JSON.stringify(incorrectQuestions, null, 2)}

Based on the questions the student got wrong or partially correct, provide a comprehensive analysis.

IMPORTANT: Respond ONLY with a valid JSON object, no additional text. The format must be exactly:
{
  "overallAssessment": "A 2-3 sentence encouraging summary of the student's performance",
  "weakAreas": [
    {
      "topic": "Topic name (e.g., Arrays, SQL Joins, Recursion)",
      "severity": "high" | "medium" | "low",
      "description": "Brief explanation of what concepts need improvement"
    }
  ],
  "focusTopics": [
    {
      "topic": "Specific topic to study",
      "reason": "Why this topic needs attention",
      "estimatedTime": "Estimated study time (e.g., 2-3 hours)"
    }
  ],
  "practiceRecommendations": [
    {
      "title": "Practice activity title",
      "description": "Detailed description of what to practice",
      "resources": ["Resource or platform suggestion"]
    }
  ],
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up the response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const analysis = JSON.parse(text);
    return analysis;
  } catch (error) {
    console.error('AI Test Analysis Error:', error);
    throw new Error('Failed to analyze test performance. Please try again.');
  }
};

/**
 * Score a resume against job requirements
 * @param {Object} studentData - Student profile data including skills, education, resume
 * @param {Object} driveData - Drive/job data including description, required skills
 * @returns {Promise<Object>} Scoring results with match percentage and analysis
 */
export const scoreResume = async (studentData, driveData) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are an expert HR analyst and resume screener. Analyze how well this candidate matches the job requirements and provide a detailed scoring.

## Job Details
- **Title:** ${driveData.jobTitle}
- **Company:** ${driveData.companyName}
- **Description:** ${driveData.jobDescription}
- **Required Skills:** ${driveData.skillsRequired?.join(', ') || 'Not specified'}
- **Job Type:** ${driveData.jobType}
- **Location:** ${driveData.jobLocation}

## Eligibility Criteria
- Minimum CGPA: ${driveData.eligibilityCriteria?.minCGPA || 'Not specified'}
- Allowed Branches: ${driveData.eligibilityCriteria?.branches?.join(', ') || 'All'}
- Max Backlogs: ${driveData.eligibilityCriteria?.maxBacklogs || 0}

## Candidate Profile
- **Name:** ${studentData.firstName} ${studentData.lastName}
- **Branch:** ${studentData.branch}
- **CGPA:** ${studentData.cgpa}
- **Batch:** ${studentData.batch}
- **Skills:** ${studentData.skills?.join(', ') || 'Not listed'}
- **10th Marks:** ${studentData.tenthMarks}%
- **12th Marks:** ${studentData.twelfthMarks}%
- **Active Backlogs:** ${studentData.activeBacklogs || 0}
- **LinkedIn:** ${studentData.linkedIn || 'Not provided'}
- **GitHub:** ${studentData.github || 'Not provided'}
- **Portfolio:** ${studentData.portfolio || 'Not provided'}

Analyze the candidate's fit for this role and provide a comprehensive assessment.

IMPORTANT: Respond ONLY with a valid JSON object, no additional text. The format must be exactly:
{
  "overallScore": 75,
  "recommendation": "strong" | "moderate" | "weak",
  "summary": "2-3 sentence executive summary of the candidate's fit",
  "skillsMatch": {
    "score": 80,
    "matched": ["skill1", "skill2"],
    "missing": ["skill3"],
    "additional": ["skill4"]
  },
  "academicsMatch": {
    "score": 90,
    "meetsMinCGPA": true,
    "meetsBacklogCriteria": true,
    "notes": "Brief note about academic standing"
  },
  "strengths": [
    "Strength 1",
    "Strength 2"
  ],
  "gaps": [
    "Gap or area of concern 1"
  ],
  "interviewFocus": [
    "Topic to explore in interview 1",
    "Topic to explore in interview 2"
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up the response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const scoring = JSON.parse(text);
    return scoring;
  } catch (error) {
    console.error('AI Resume Scoring Error:', error);
    throw new Error('Failed to score resume. Please try again.');
  }
};

/**
 * Analyze a resume for ATS compatibility and provide suggestions
 * @param {string} resumeText - Extracted text from the resume PDF
 * @returns {Promise<Object>} ATS analysis with score and suggestions
 */
export const analyzeResumeForATS = async (resumeText) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are an expert resume coach and ATS (Applicant Tracking System) specialist. Analyze the following resume content and provide detailed feedback on how to improve it for better ATS compatibility and recruiter appeal.

## RESUME CONTENT
---
${resumeText}
---

Analyze ONLY the resume content above. Provide:
1. ATS compatibility score and specific issues
2. Section-by-section feedback for all sections found in the resume
3. Missing keywords commonly expected for similar roles
4. Format and structure issues that may affect ATS parsing
5. Actionable improvements

IMPORTANT: Respond ONLY with a valid JSON object, no additional text. The format must be exactly:
{
  "atsScore": 75,
  "atsVerdict": "Good" | "Needs Improvement" | "Poor",
  "overallFeedback": "2-3 sentence summary of the resume's strengths and main areas to improve",
  "sectionAnalysis": [
    {
      "section": "Contact Information",
      "score": 80,
      "feedback": "Analysis of this section",
      "suggestions": ["Suggestion 1", "Suggestion 2"]
    },
    {
      "section": "Summary/Objective",
      "score": 70,
      "feedback": "Analysis of summary section",
      "suggestions": ["Add quantifiable achievements"]
    },
    {
      "section": "Skills",
      "score": 85,
      "feedback": "Analysis of skills",
      "suggestions": ["Add more relevant keywords"]
    },
    {
      "section": "Experience/Projects",
      "score": 60,
      "feedback": "Analysis of experience or projects",
      "suggestions": ["Use action verbs", "Add metrics"]
    },
    {
      "section": "Education",
      "score": 90,
      "feedback": "Analysis of education section",
      "suggestions": []
    },
    {
      "section": "Format & Structure",
      "score": 75,
      "feedback": "Analysis of overall format",
      "suggestions": ["Use consistent formatting"]
    }
  ],
  "missingKeywords": ["keyword1", "keyword2", "keyword3"],
  "suggestedSkillsToAdd": ["skill1", "skill2", "skill3"],
  "quickWins": [
    "Quick improvement 1",
    "Quick improvement 2",
    "Quick improvement 3"
  ],
  "advancedTips": [
    "Advanced tip 1",
    "Advanced tip 2"
  ],
  "formatIssues": [
    "Any ATS format issues found"
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up the response
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const analysis = JSON.parse(text);
    return analysis;
  } catch (error) {
    console.error('AI Resume Analysis Error:', error);
    throw new Error('Failed to analyze resume. Please try again.');
  }
};

export const analyzeCandidatePresence = async (studentData, resumeUrl) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Run LinkedIn extraction (Google Search grounding), GitHub snapshot, and resume parsing in parallel
  const [linkedInProfile, githubSnapshot, resumeText] = await Promise.all([
    studentData.linkedIn ? extractLinkedInProfile(studentData.linkedIn) : Promise.resolve(null),
    extractWebSnapshot(studentData.github),
    resumeUrl ? extractPdfTextFromUrl(resumeUrl).catch(() => null) : Promise.resolve(null),
  ]);

  // Format LinkedIn data for the prompt
  let linkedInSection = 'Not provided';
  if (linkedInProfile) {
    if (linkedInProfile.rawText) {
      linkedInSection = linkedInProfile.rawText;
    } else {
      linkedInSection = [
        linkedInProfile.name ? `Name: ${linkedInProfile.name}` : null,
        linkedInProfile.headline ? `Headline: ${linkedInProfile.headline}` : null,
        linkedInProfile.location ? `Location: ${linkedInProfile.location}` : null,
        linkedInProfile.currentCompany ? `Current Company: ${linkedInProfile.currentCompany}` : null,
        linkedInProfile.connections ? `Connections: ${linkedInProfile.connections}` : null,
        linkedInProfile.about ? `About: ${linkedInProfile.about}` : null,
        linkedInProfile.experience?.length
          ? `Experience:\n${linkedInProfile.experience.map(e => `  - ${e.role} at ${e.company} (${e.duration || ''})`).join('\n')}`
          : null,
        linkedInProfile.education?.length
          ? `Education:\n${linkedInProfile.education.map(e => `  - ${e.degree} at ${e.institution} (${e.year || ''})`).join('\n')}`
          : null,
        linkedInProfile.skills?.length
          ? `LinkedIn Skills: ${linkedInProfile.skills.join(', ')}`
          : null,
        linkedInProfile.certifications?.length
          ? `Certifications: ${linkedInProfile.certifications.join(', ')}`
          : null,
      ].filter(Boolean).join('\n');
    }
  }

  const prompt = `You are a senior HR analyst reviewing a candidate for a placement drive. Use ALL the information below to write a detailed, accurate profile summary for recruiters.

## Candidate Basic Info
- Name: ${studentData.firstName} ${studentData.lastName}
- Branch: ${studentData.branch}
- CGPA: ${studentData.cgpa}
- Skills (self-reported): ${studentData.skills?.join(', ') || 'Not listed'}
- LinkedIn: ${studentData.linkedIn || 'Not provided'}
- GitHub: ${studentData.github || 'Not provided'}

## LinkedIn Profile Data (retrieved via AI search agent)
${linkedInSection}

## GitHub Snapshot
${JSON.stringify(githubSnapshot, null, 2)}

## Resume Text
${resumeText ? resumeText.slice(0, 3000) : 'Not available'}

Based on ALL the above, generate a comprehensive recruiter briefing.

Return ONLY valid JSON:
{
  "summary": "3-4 sentence detailed summary covering the candidate's background, key skills, experience, and standout qualities for recruiters",
  "linkedinInsight": "Specific insight from LinkedIn: mention their headline, current role, notable experiences, or education found. Be specific, not generic.",
  "githubInsight": "One sentence about GitHub presence based on the snapshot data",
  "recommendedUse": "Specific actionable recommendation for recruiters based on all profile data",
  "linkedinProfile": {
    "name": "name from LinkedIn or null",
    "headline": "headline/role from LinkedIn or null",
    "location": "location or null",
    "currentCompany": "current company or null",
    "about": "about text or null",
    "topExperience": ["role at company (duration)", "..."],
    "education": ["degree at institution", "..."],
    "skills": ["skill1", "skill2"],
    "certifications": ["cert1"],
    "connections": "500+ or null"
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Robust JSON extraction — handle any surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    // Merge in the raw linkedInProfile data as fallback if AI didn't populate linkedinProfile
    if (!parsed.linkedinProfile && linkedInProfile && !linkedInProfile.rawText) {
      parsed.linkedinProfile = {
        name: linkedInProfile.name || null,
        headline: linkedInProfile.headline || null,
        location: linkedInProfile.location || null,
        currentCompany: linkedInProfile.currentCompany || null,
        about: linkedInProfile.about || null,
        topExperience: linkedInProfile.experience?.map(e => `${e.role} at ${e.company}${e.duration ? ` (${e.duration})` : ''}`) || [],
        education: linkedInProfile.education?.map(e => `${e.degree} at ${e.institution}${e.year ? ` (${e.year})` : ''}`) || [],
        skills: linkedInProfile.skills || [],
        certifications: linkedInProfile.certifications || [],
        connections: linkedInProfile.connections || null,
      };
    }

    return parsed;
  } catch (error) {
    console.error('AI Candidate Presence Error:', error);
    // Even if final summary generation fails, return whatever LinkedIn data we got
    const fallbackLinkedIn = (linkedInProfile && !linkedInProfile.rawText) ? {
      name: linkedInProfile.name || null,
      headline: linkedInProfile.headline || null,
      location: linkedInProfile.location || null,
      currentCompany: linkedInProfile.currentCompany || null,
      about: linkedInProfile.about || null,
      topExperience: linkedInProfile.experience?.map(e => `${e.role} at ${e.company}`) || [],
      education: linkedInProfile.education?.map(e => `${e.degree} at ${e.institution}`) || [],
      skills: linkedInProfile.skills || [],
      certifications: linkedInProfile.certifications || [],
      connections: linkedInProfile.connections || null,
    } : null;

    return {
      summary: 'Profile summary could not be fully generated. See LinkedIn data below.',
      linkedinInsight: studentData.linkedIn ? 'LinkedIn profile was retrieved but the full summary could not be generated.' : 'LinkedIn not provided.',
      githubInsight: studentData.github ? 'GitHub URL provided.' : 'GitHub not provided.',
      recommendedUse: 'Review the LinkedIn profile data below and the candidate resume manually.',
      linkedinProfile: fallbackLinkedIn,
    };
  }
};

/**
 * Score a single candidate against a Job Description using the 5-dimension rubric.
 * Dimensions & weights:
 *   Skills Match           30%
 *   Experience Relevance   25%
 *   Education & Certs      15%
 *   Project / Portfolio    20%
 *   Communication Quality  10%
 *
 * @param {Object} candidateData  - student profile + resume text
 * @param {string} jobDescription - raw JD text
 * @returns {Promise<Object>} rubric scores + weighted total + hire recommendation
 */
export const scoreCandidate = async (candidateData, jobDescription) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const resumeSnippet = candidateData.resumeText
    ? candidateData.resumeText.slice(0, 3000)
    : 'No resume text available';

  const prompt = `You are a senior technical recruiter. Score the candidate below against the job description using the EXACT rubric provided.

## JOB DESCRIPTION
${jobDescription}

## CANDIDATE PROFILE
- Name: ${candidateData.firstName} ${candidateData.lastName}
- Branch: ${candidateData.branch}
- CGPA: ${candidateData.cgpa}
- Active Backlogs: ${candidateData.activeBacklogs ?? 0}
- 10th Marks: ${candidateData.tenthMarks ?? 'N/A'}%
- 12th Marks: ${candidateData.twelfthMarks ?? 'N/A'}%
- Self-reported Skills: ${candidateData.skills?.join(', ') || 'Not listed'}
- LinkedIn: ${candidateData.linkedIn || 'Not provided'}
- GitHub: ${candidateData.github || 'Not provided'}
- Portfolio: ${candidateData.portfolio || 'Not provided'}

## RESUME TEXT (extracted)
${resumeSnippet}

## SCORING RUBRIC (score each dimension 0-10)
1. Skills Match (weight 30%):
   - 0-3: <30% skills match
   - 4-6: 50-70% skills match
   - 7-10: >85% skills match

2. Experience Relevance (weight 25%):
   - 0-3: Unrelated domain
   - 4-6: Adjacent domain
   - 7-10: Exact domain & seniority

3. Education & Certs (weight 15%):
   - 0-3: Does not meet minimum
   - 4-6: Meets minimum
   - 7-10: Exceeds + extra certs

4. Project / Portfolio (weight 20%):
   - 0-3: No evidence
   - 4-6: 1-2 generic projects
   - 7-10: Strong relevant portfolio

5. Communication Quality (weight 10%):
   - 0-3: Poor structure/grammar in resume
   - 4-6: Adequate clarity
   - 7-10: Crisp, structured, impactful

Calculate weighted total = (skillsMatch*0.30) + (experienceRelevance*0.25) + (educationCerts*0.15) + (projectPortfolio*0.20) + (communicationQuality*0.10). Scale to 0-100.

IMPORTANT: Respond ONLY with valid JSON:
{
  "dimensions": {
    "skillsMatch": { "score": 7, "justification": "one sentence why" },
    "experienceRelevance": { "score": 5, "justification": "one sentence why" },
    "educationCerts": { "score": 8, "justification": "one sentence why" },
    "projectPortfolio": { "score": 6, "justification": "one sentence why" },
    "communicationQuality": { "score": 7, "justification": "one sentence why" }
  },
  "weightedTotal": 65,
  "recommendation": "hire" | "consider" | "no-hire",
  "summaryJustification": "2-sentence overall assessment for the recruiter"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
  } catch (error) {
    console.error('scoreCandidate error:', error.message);
    throw new Error('Failed to score candidate');
  }
};

/**
 * Rank all candidates for a drive using the 5-dimension rubric.
 * Processes candidates in parallel batches for efficiency.
 */
export const rankCandidatesForDrive = async (candidates, jobDescription) => {
  // Score candidates in batches of 5 to avoid rate limits
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (candidate) => {
        try {
          const scoring = await scoreCandidate(candidate, jobDescription);
          return { ...candidate, aiScore: scoring, scoringError: null };
        } catch (err) {
          return { ...candidate, aiScore: null, scoringError: err.message };
        }
      })
    );
    results.push(...batchResults.map(r => r.value || r.reason));
  }

  // Sort by weightedTotal descending
  return results
    .filter(r => r.aiScore)
    .sort((a, b) => (b.aiScore.weightedTotal || 0) - (a.aiScore.weightedTotal || 0));
};

/**
 * Extract text from a PDF buffer (used for JD file uploads)
 */
export const extractPdfTextFromBuffer = async (buffer) => {
  const uint8Array = new Uint8Array(buffer);
  const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  let text = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text.trim();
};

/**
 * Step 2 — Parse a raw JD text into structured requirements.
 * Returns JSON with required skills, experience, education, responsibilities etc.
 */
export const parseJobDescription = async (jdText) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are an expert HR analyst. Parse the following job description into structured fields.

JOB DESCRIPTION:
${jdText.slice(0, 4000)}

Return ONLY valid JSON:
{
  "jobTitle": "extracted job title",
  "company": "company name if mentioned, else null",
  "department": "department/team if mentioned, else null",
  "location": "location/remote status",
  "employmentType": "full-time/part-time/internship/contract",
  "experienceRequired": "e.g. 2+ years, fresher, 0-2 years",
  "requiredSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill1", "skill2"],
  "educationRequired": "minimum degree/qualification",
  "certifications": ["cert1"],
  "keyResponsibilities": ["responsibility 1", "responsibility 2"],
  "salaryRange": "salary info if mentioned, else null",
  "domainKeywords": ["keyword1", "keyword2"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
  } catch (error) {
    console.error('parseJobDescription error:', error.message);
    throw new Error('Failed to parse job description');
  }
};

export default {
  generateQuestions,
  analyzeTestPerformance,
  scoreResume,
  analyzeResumeForATS,
  analyzeCandidatePresence,
  scoreCandidate,
  rankCandidatesForDrive,
  parseJobDescription,
  extractPdfTextFromBuffer,
};



