import { useState, useRef, useEffect } from 'react';
import { getAttribution } from '../../lib/attribution';
import { pushLeadSubmitted } from '../../lib/analytics';

const ROLES = [
  'Qualified Plumber — All Rounder',
  'Apprentice Plumber',
  'Civil Labourer',
  'Other',
];

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const inputBase =
  'w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-[#1a1a1a] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0172ae] focus:border-transparent ' +
  'transition bg-white placeholder:text-slate-400';

export default function JobApplicationForm() {
  const [fields, setFields] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: '',
    cover_note: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [serverError, setServerError] = useState('');
  const [leadRef, setLeadRef] = useState('');
  const [attribution, setAttribution] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setAttribution(getAttribution());
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleFile(e) {
    const file = e.target.files?.[0] ?? null;
    setResumeError('');
    if (!file) { setResumeFile(null); return; }

    if (file.type !== 'application/pdf') {
      setResumeError('Please upload a PDF file.');
      setResumeFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setResumeError('File must be 5 MB or smaller.');
      setResumeFile(null);
      e.target.value = '';
      return;
    }
    setResumeFile(file);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate() {
    const e = {};
    if (!fields.full_name.trim())  e.full_name = 'Full name is required.';
    if (!fields.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      e.email = 'A valid email address is required.';
    if (!fields.phone.trim())      e.phone = 'Phone number is required.';
    if (!fields.role)              e.role  = 'Please select a role.';
    return e;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setStatus('submitting');
    setServerError('');

    const body = new FormData();
    body.append('full_name',  fields.full_name.trim());
    body.append('email',      fields.email.trim().toLowerCase());
    body.append('phone',      fields.phone.trim());
    body.append('role',       fields.role);
    body.append('cover_note', fields.cover_note.trim());
    body.append('attribution', JSON.stringify(attribution ?? {}));
    if (resumeFile) body.append('resume', resumeFile);

    try {
      const res  = await fetch('/api/job-application', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setLeadRef(data.ref ?? '');
        setStatus('success');
        pushLeadSubmitted({
          form_name: 'careers',
          lead_ref:  data.ref,
        });
      } else {
        throw new Error(
          data.error ?? "We couldn't submit your application. Please call 0452 188 420.",
        );
      }
    } catch (err) {
      setServerError(err.message ?? "Submission failed. Please call 0452 188 420.");
      setStatus('error');
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <div className="bg-[#F0F5FA] border border-[#0172ae]/30 rounded-2xl p-10 text-center">
        <div className="w-14 h-14 bg-[#0172ae]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-[#0172ae]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#000000] mb-2">Application received!</h3>
        <p className="text-[#1a1a1a]/70 mb-3">
          Thanks! We'll be in touch within 2 business days.
        </p>
        {leadRef && (
          <p className="text-xs text-slate-400">
            Your reference: <strong className="font-mono text-slate-500">{leadRef}</strong>
          </p>
        )}
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">

      {/* Full Name */}
      <div>
        <label htmlFor="ja-full-name" className="block text-sm font-semibold text-[#000000] mb-1.5">
          Full Name <span className="text-[#f19329]">*</span>
        </label>
        <input
          id="ja-full-name"
          name="full_name"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          value={fields.full_name}
          onChange={handleChange}
          className={`${inputBase} ${errors.full_name ? 'border-red-400 ring-1 ring-red-400' : ''}`}
        />
        {errors.full_name && <p className="mt-1.5 text-xs text-red-600">{errors.full_name}</p>}
      </div>

      {/* Email + Phone */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="ja-email" className="block text-sm font-semibold text-[#000000] mb-1.5">
            Email <span className="text-[#f19329]">*</span>
          </label>
          <input
            id="ja-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={fields.email}
            onChange={handleChange}
            className={`${inputBase} ${errors.email ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          />
          {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="ja-phone" className="block text-sm font-semibold text-[#000000] mb-1.5">
            Phone <span className="text-[#f19329]">*</span>
          </label>
          <input
            id="ja-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="04XX XXX XXX"
            value={fields.phone}
            onChange={handleChange}
            className={`${inputBase} ${errors.phone ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          />
          {errors.phone && <p className="mt-1.5 text-xs text-red-600">{errors.phone}</p>}
        </div>
      </div>

      {/* Role */}
      <div>
        <label htmlFor="ja-role" className="block text-sm font-semibold text-[#000000] mb-1.5">
          Role You're Applying For <span className="text-[#f19329]">*</span>
        </label>
        <select
          id="ja-role"
          name="role"
          value={fields.role}
          onChange={handleChange}
          className={`${inputBase} ${errors.role ? 'border-red-400 ring-1 ring-red-400' : ''}`}
        >
          <option value="">Select a role…</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {errors.role && <p className="mt-1.5 text-xs text-red-600">{errors.role}</p>}
      </div>

      {/* Cover Note */}
      <div>
        <label htmlFor="ja-cover" className="block text-sm font-semibold text-[#000000] mb-1.5">
          Cover Note <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="ja-cover"
          name="cover_note"
          rows={4}
          placeholder="Tell us a bit about your experience and why you'd like to join the Pulse team…"
          value={fields.cover_note}
          onChange={handleChange}
          className={`${inputBase} resize-none`}
        />
      </div>

      {/* Resume Upload */}
      <div>
        <label className="block text-sm font-semibold text-[#000000] mb-1.5">
          Resume / CV <span className="text-slate-400 font-normal">(PDF, max 5 MB)</span>
        </label>

        <div
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex items-center gap-4 border-2 border-dashed rounded-xl px-5 py-4 cursor-pointer
            transition-colors
            ${resumeFile
              ? 'border-[#0172ae]/50 bg-[#0172ae]/5'
              : 'border-slate-200 hover:border-[#0172ae]/40 hover:bg-[#F0F5FA]'}
            ${resumeError ? 'border-red-400 bg-red-50' : ''}
          `}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${resumeFile ? 'bg-[#0172ae]/10' : 'bg-slate-100'}`}>
            <svg className={`w-5 h-5 ${resumeFile ? 'text-[#0172ae]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div className="min-w-0">
            {resumeFile ? (
              <>
                <p className="text-sm font-semibold text-[#0172ae] truncate">{resumeFile.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{(resumeFile.size / 1024 / 1024).toFixed(1)} MB — click to change</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">Click to upload your resume</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF only · max 5 MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="sr-only"
            aria-label="Upload resume PDF"
          />
        </div>
        {resumeError && <p className="mt-1.5 text-xs text-red-600">{resumeError}</p>}
      </div>

      {/* Server error */}
      {status === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700"
        >
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>
            {serverError || "We couldn't submit your application."}{' '}
            <a href="tel:0452188420" data-track="call" data-call-number="0452188420" data-call-location="sticky" className="font-bold underline">Call 0452 188 420</a>.
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="
          w-full flex items-center justify-center gap-2
          bg-[#0172ae] hover:bg-[#015d8e] disabled:bg-[#0172ae]/60
          text-white font-semibold text-sm
          px-6 py-3.5 rounded-full
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0172ae]
        "
      >
        {status === 'submitting' ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            Submit Application
          </>
        )}
      </button>

      <p className="text-xs text-slate-400 text-center">
        By submitting you consent to Pulse Plumbing, Gas &amp; Civil storing your details for recruitment purposes.
      </p>
    </form>
  );
}
