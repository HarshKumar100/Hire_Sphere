import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoArrowBack, IoSparkles, IoCheckmarkCircle, IoCloseCircle,
  IoWarning, IoFlag, IoDownload, IoRefresh, IoClose,
  IoPerson, IoDocumentText, IoSchool, IoBriefcase, IoChatbubble,
  IoCode, IoChevronDown, IoChevronUp, IoShieldCheckmark,
  IoCloudUpload, IoCheckmark,
} from 'react-icons/io5';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';
import FadeIn from '../../components/animations/FadeIn';
import { applicationService } from '../../services/applicationService';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const DIMENSIONS = [
  { key: 'skillsMatch',         label: 'Skills Match',          weight: 30, icon: IoCode },
  { key: 'experienceRelevance', label: 'Experience Relevance',  weight: 25, icon: IoBriefcase },
  { key: 'educationCerts',      label: 'Education & Certs',     weight: 15, icon: IoSchool },
  { key: 'projectPortfolio',    label: 'Project / Portfolio',   weight: 20, icon: IoDocumentText },
  { key: 'communicationQuality',label: 'Communication Quality', weight: 10, icon: IoChatbubble },
];

const OVERRIDE_TYPES = [
  { value: 'flag',    label: '🚩 Flag for Review',   color: 'text-yellow-700 bg-yellow-100' },
  { value: 'approve', label: '✅ Approve (Override)', color: 'text-green-700 bg-green-100' },
  { value: 'reject',  label: '❌ Reject (Override)',  color: 'text-red-700 bg-red-100' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const scoreColor = (score) => {
  if (score >= 7) return 'text-green-600';
  if (score >= 4) return 'text-yellow-600';
  return 'text-red-500';
};

const totalColor = (total) => {
  if (total >= 70) return 'text-green-600 bg-green-50 border-green-200';
  if (total >= 45) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-500 bg-red-50 border-red-200';
};

const RecoBadge = ({ rec, override }) => {
  if (override) {
    const map = {
      flag:    { label: '🚩 Flagged',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      approve: { label: '✅ Approved', cls: 'bg-green-100 text-green-800 border-green-300' },
      reject:  { label: '❌ Rejected', cls: 'bg-red-100 text-red-800 border-red-300' },
    };
    const m = map[override.overrideType] || map.flag;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${m.cls}`}>
        {m.label} <span className="opacity-60 font-normal">(HR)</span>
      </span>
    );
  }
  const map = {
    hire:      { icon: <IoCheckmarkCircle className="inline mr-1" />, label: 'Hire',      cls: 'bg-green-100 text-green-800 border-green-300' },
    consider:  { icon: <IoWarning className="inline mr-1" />,         label: 'Consider',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    'no-hire': { icon: <IoCloseCircle className="inline mr-1" />,     label: 'No-Hire',   cls: 'bg-red-100 text-red-800 border-red-300' },
  };
  const m = map[rec] || map.consider;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-0.5 ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
};

const ScoreBar = ({ score }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${score >= 7 ? 'bg-green-500' : score >= 4 ? 'bg-yellow-400' : 'bg-red-400'}`}
        style={{ width: `${(score / 10) * 100}%` }}
      />
    </div>
    <span className={`text-xs font-bold w-6 text-right ${scoreColor(score)}`}>{score}</span>
  </div>
);

// ─── HR Override Modal ─────────────────────────────────────────────────────────
const HROverrideModal = ({ candidate, onClose, onSave }) => {
  const [overrideType, setOverrideType] = useState('flag');
  const [reason, setReason] = useState('');
  const [adjustedScore, setAdjustedScore] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    setSaving(true);
    try {
      await onSave(candidate.applicationId, overrideType, reason, adjustedScore ? Number(adjustedScore) : undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IoShieldCheckmark className="text-indigo-600" size={20} />
            <h3 className="font-bold text-primary-900">HR Override</h3>
          </div>
          <button onClick={onClose} className="text-primary-400 hover:text-primary-700">
            <IoClose size={20} />
          </button>
        </div>

        <p className="text-sm text-primary-600 mb-4">
          Override AI score for <strong>{candidate.firstName} {candidate.lastName}</strong>
        </p>

        {/* Override Type */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-primary-700 mb-2">Action</label>
          <div className="space-y-2">
            {OVERRIDE_TYPES.map(t => (
              <label key={t.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="overrideType"
                  value={t.value}
                  checked={overrideType === t.value}
                  onChange={() => setOverrideType(t.value)}
                  className="accent-indigo-600"
                />
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Adjusted Score (optional) */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-primary-700 mb-1">
            Adjusted Score (optional, 0–100)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={adjustedScore}
            onChange={e => setAdjustedScore(e.target.value)}
            placeholder="Leave blank to keep AI score"
            className="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* Reason */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-primary-700 mb-1">Reason *</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Explain your override decision..."
            className="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} fullWidth>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving} fullWidth
            icon={<IoShieldCheckmark />}>
            Save Override
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Candidate Row ─────────────────────────────────────────────────────────────
const CandidateRow = ({ candidate, rank, onOverride }) => {
  const [expanded, setExpanded] = useState(false);
  const { aiScore, hrOverride } = candidate;
  const displayScore = hrOverride?.adjustedScore ?? aiScore.weightedTotal;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-primary-200 rounded-xl overflow-hidden"
    >
      {/* Main Row */}
      <div
        className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-primary-50 transition-colors ${expanded ? 'bg-primary-50' : 'bg-white'}`}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Rank */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
          ${rank === 1 ? 'bg-yellow-400 text-white' : rank === 2 ? 'bg-gray-300 text-gray-800' : rank === 3 ? 'bg-amber-600 text-white' : 'bg-primary-100 text-primary-700'}`}>
          {rank}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-primary-900 truncate">{candidate.firstName} {candidate.lastName}</p>
          <p className="text-xs text-primary-500">{candidate.studentId} · {candidate.branch} · CGPA {candidate.cgpa}</p>
        </div>

        {/* Weighted Score */}
        <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold text-center min-w-[60px] ${totalColor(displayScore)}`}>
          {Math.round(displayScore)}/100
        </div>

        {/* Recommendation */}
        <div className="shrink-0">
          <RecoBadge rec={aiScore.recommendation} override={hrOverride} />
        </div>

        {/* HR Override btn */}
        <button
          onClick={e => { e.stopPropagation(); onOverride(candidate); }}
          className="shrink-0 p-1.5 text-primary-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="HR Override"
        >
          <IoFlag size={16} />
        </button>

        {/* Expand */}
        <div className="shrink-0 text-primary-400">
          {expanded ? <IoChevronUp size={16} /> : <IoChevronDown size={16} />}
        </div>
      </div>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-primary-100">
              {/* Summary Justification */}
              {aiScore.summaryJustification && (
                <div className="mb-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                  <p className="text-xs font-semibold text-indigo-600 mb-1">AI Assessment</p>
                  <p className="text-sm text-primary-800">{aiScore.summaryJustification}</p>
                </div>
              )}

              {/* HR Override Info */}
              {hrOverride && (
                <div className="mb-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">HR Override — {hrOverride.overrideType}</p>
                  <p className="text-sm text-primary-800">{hrOverride.reason}</p>
                  {hrOverride.adjustedScore != null && (
                    <p className="text-xs text-primary-500 mt-1">Adjusted Score: {hrOverride.adjustedScore}/100</p>
                  )}
                </div>
              )}

              {/* 5-Dimension Rubric */}
              <p className="text-xs font-semibold text-primary-600 mb-2 uppercase tracking-wide">Dimension Scores</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {DIMENSIONS.map(({ key, label, weight, icon: Icon }) => {
                  const dim = aiScore.dimensions?.[key];
                  if (!dim) return null;
                  return (
                    <div key={key} className="p-2 bg-white rounded-lg border border-primary-100">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="text-secondary-600 shrink-0" size={13} />
                          <span className="text-xs font-medium text-primary-700">{label}</span>
                          <span className="text-xs text-primary-400">({weight}%)</span>
                        </div>
                        <span className={`text-xs font-bold ${scoreColor(dim.score)}`}>{dim.score}/10</span>
                      </div>
                      <ScoreBar score={dim.score} />
                      {dim.justification && (
                        <p className="text-xs text-primary-500 mt-1 leading-relaxed">{dim.justification}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Skills */}
              {candidate.skills?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-primary-600 mb-1">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {candidate.skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-secondary-100 text-secondary-800 rounded-full text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const ShortlistCandidates = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [jdTab, setJdTab] = useState('paste'); // 'paste' | 'upload'
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  const handleRun = async () => {
    if (!jd.trim() || jd.trim().length < 50) {
      toast.error('Please paste a job description (at least 50 characters)');
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const response = await applicationService.aiShortlistCandidates(id, jd);
      if (response.success) {
        setReport(response.data);
        toast.success(`Ranked ${response.data.totalScored} candidates!`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to run AI shortlist');
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSave = async (applicationId, overrideType, reason, adjustedScore) => {
    try {
      await applicationService.hrOverrideScore(applicationId, overrideType, reason, adjustedScore);
      toast.success('HR override saved');
      // Update local state
      setReport(prev => ({
        ...prev,
        ranked: prev.ranked.map(c =>
          c.applicationId === applicationId
            ? { ...c, hrOverride: { overrideType, reason, adjustedScore } }
            : c
        ),
      }));
    } catch {
      toast.error('Failed to save override');
    }
  };

  const handleExportJSON = () => {
    if (!report) return;
    const data = JSON.stringify(report.ranked.map(c => ({
      rank: report.ranked.indexOf(c) + 1,
      name: `${c.firstName} ${c.lastName}`,
      studentId: c.studentId,
      branch: c.branch,
      cgpa: c.cgpa,
      weightedTotal: c.aiScore.weightedTotal,
      recommendation: c.aiScore.recommendation,
      hrOverride: c.hrOverride,
      dimensions: c.aiScore.dimensions,
      summaryJustification: c.aiScore.summaryJustification,
    })), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shortlist-report-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-primary-100 rounded-lg transition-colors">
              <IoArrowBack size={24} className="text-primary-700" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-primary-900">AI Shortlist Engine</h1>
              <p className="text-primary-600 mt-1">
                JD-aware semantic scoring · 5-dimension rubric · Human-in-the-loop
              </p>
            </div>
          </div>
          {report && (
            <div className="flex gap-2">
              <Button variant="secondary" icon={<IoRefresh />} onClick={handleRun} loading={loading}>
                Re-run
              </Button>
              <Button icon={<IoDownload />} onClick={handleExportJSON}>
                Export JSON
              </Button>
            </div>
          )}
        </div>
      </FadeIn>

      {/* JD Input */}
      <FadeIn delay={0.1}>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <IoSparkles className="text-white" size={14} />
            </div>
            <h2 className="font-semibold text-primary-900">Step 1 — Job Description Input</h2>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-primary-100 rounded-xl mb-4 w-fit">
            {[
              { key: 'paste', label: '📋 Paste Text' },
              { key: 'upload', label: '📁 Upload PDF' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setJdTab(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  jdTab === tab.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-primary-600 hover:text-primary-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {jdTab === 'paste' ? (
            <>
              <textarea
                value={jd}
                onChange={e => setJd(e.target.value)}
                rows={7}
                placeholder="Paste the full job description here. The AI will extract required skills, experience, education, and qualifications, then score every applicant against it using a weighted 5-dimension rubric..."
                className="w-full border border-primary-200 rounded-xl px-4 py-3 text-sm text-primary-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-primary-400"
              />
              {uploadedFileName && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <IoCheckmark size={13} /> Extracted from: {uploadedFileName}
                </p>
              )}
            </>
          ) : (
            <div className="relative">
              <label
                htmlFor="jd-pdf-upload"
                className={`flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed rounded-xl px-6 py-12 cursor-pointer transition-colors ${
                  uploading
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-primary-300 hover:border-indigo-400 hover:bg-indigo-50/40'
                }`}
              >
                {uploading ? (
                  <>
                    <IoSparkles className="text-indigo-500 animate-pulse" size={36} />
                    <p className="text-sm font-medium text-indigo-600">Extracting text from PDF…</p>
                  </>
                ) : (
                  <>
                    <IoCloudUpload className="text-primary-400" size={36} />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-primary-700">Drop your JD PDF here</p>
                      <p className="text-xs text-primary-400 mt-1">or click to browse — PDF only</p>
                    </div>
                  </>
                )}
              </label>
              <input
                id="jd-pdf-upload"
                type="file"
                accept=".pdf,application/pdf"
                disabled={uploading}
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const res = await applicationService.extractJDFile(file);
                    if (res.success && res.data?.jdText) {
                      setJd(res.data.jdText);
                      setUploadedFileName(file.name);
                      setJdTab('paste');
                      toast.success('PDF extracted — review the text below, then run AI Shortlist');
                    } else {
                      toast.error('Could not extract text. Please paste the JD manually.');
                    }
                  } catch {
                    toast.error('Failed to extract PDF. Please paste the JD manually.');
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-primary-400">{jd.length} characters</p>
            <Button
              icon={<IoSparkles />}
              onClick={handleRun}
              loading={loading}
              disabled={loading || uploading}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 hover:from-indigo-600 hover:to-purple-700"
            >
              {loading ? 'AI Scoring All Candidates…' : 'Run AI Shortlist'}
            </Button>
          </div>
        </Card>
      </FadeIn>

      {/* Scoring Rubric Reference */}
      <FadeIn delay={0.15}>
        <Card>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-primary-700 flex items-center gap-2">
              <IoDocumentText className="text-secondary-600" size={16} />
              Scoring Rubric Reference (click to expand)
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    {['Dimension', 'Weight', '0 – Poor', '5 – Average', '10 – Excellent'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Skills Match', '30%', '<30% skills match', '50–70% skills match', '>85% skills match'],
                    ['Experience Relevance', '25%', 'Unrelated domain', 'Adjacent domain', 'Exact domain & seniority'],
                    ['Education & Certs', '15%', 'Does not meet minimum', 'Meets minimum', 'Exceeds + extra certs'],
                    ['Project / Portfolio', '20%', 'No evidence', '1–2 generic projects', 'Strong relevant portfolio'],
                    ['Communication Quality', '10%', 'Poor structure/grammar', 'Adequate clarity', 'Crisp, structured, impactful'],
                  ].map(([dim, w, poor, avg, exc], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium text-primary-800">{dim}</td>
                      <td className="px-3 py-2 text-primary-600">{w}</td>
                      <td className="px-3 py-2 text-red-600">{poor}</td>
                      <td className="px-3 py-2 text-yellow-600">{avg}</td>
                      <td className="px-3 py-2 text-green-600">{exc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border-l-4 border-indigo-400">
                The agent prints dimension-level scores, the weighted total, and a one-line justification per dimension.
              </p>
            </div>
          </details>
        </Card>
      </FadeIn>

      {/* Loading State */}
      {loading && (
        <FadeIn>
          <Card>
            <div className="py-12 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <IoSparkles className="text-indigo-600 animate-pulse" size={32} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-primary-900">AI Agent Running…</p>
                <p className="text-sm text-primary-500 mt-1">
                  Parsing JD → Extracting resume text → Scoring all candidates on 5 dimensions
                </p>
              </div>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* Results */}
      {report && !loading && (
        <FadeIn delay={0.1}>
          <Card>
            {/* Report Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-primary-900 text-lg">
                  Ranked Shortlist — {report.driveTitle} @ {report.companyName}
                </h2>
                <p className="text-sm text-primary-500">
                  {report.totalScored} candidates scored · Click a row to expand · Use 🚩 to override
                </p>
              </div>
              {/* Legend */}
              <div className="hidden md:flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥70 Hire</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 45–70 Consider</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;45 No-Hire</span>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Hire', value: report.ranked.filter(c => c.aiScore.recommendation === 'hire').length, color: 'text-green-600 bg-green-50 border-green-200' },
                { label: 'Consider', value: report.ranked.filter(c => c.aiScore.recommendation === 'consider').length, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                { label: 'No-Hire', value: report.ranked.filter(c => c.aiScore.recommendation === 'no-hire').length, color: 'text-red-500 bg-red-50 border-red-200' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`text-center p-3 rounded-xl border ${color}`}>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Ranked List */}
            <div className="space-y-2">
              {report.ranked.map((candidate, i) => (
                <CandidateRow
                  key={candidate.applicationId}
                  candidate={candidate}
                  rank={i + 1}
                  onOverride={setOverrideTarget}
                />
              ))}
            </div>
          </Card>
        </FadeIn>
      )}

      {/* HR Override Modal */}
      <AnimatePresence>
        {overrideTarget && (
          <HROverrideModal
            candidate={overrideTarget}
            onClose={() => setOverrideTarget(null)}
            onSave={handleOverrideSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShortlistCandidates;
