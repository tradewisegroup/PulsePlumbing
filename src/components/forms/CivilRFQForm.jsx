import { useState, useEffect } from 'react';
import { getAttribution } from '../../lib/attribution';
import { pushLeadSubmitted } from '../../lib/analytics';

// ─── Field options ────────────────────────────────────────────────────────────

const PROJECT_TYPE_OPTIONS = [
  { value: '',                           label: 'Select project type…' },
  { value: 'water-mains',               label: 'Water Main Installation / Renewal' },
  { value: 'stormwater',                label: 'Stormwater Infrastructure' },
  { value: 'sewer-construction',         label: 'Sewer Construction & Connections' },
  { value: 'infrastructure-maintenance', label: 'Infrastructure Maintenance Contract' },
  { value: 'other',                      label: 'Other / Multiple Disciplines' },
];

const PROJECT_VALUE_OPTIONS = [
  { value: '',           label: 'Estimated project value…' },
  { value: 'under-50k', label: 'Under $50,000' },
  { value: '50k-200k',  label: '$50,000 – $200,000' },
  { value: '200k-500k', label: '$200,000 – $500,000' },
  { value: '500k-plus', label: '$500,000+' },
  { value: 'tbd',       label: 'To be determined' },
];

const TIMELINE_OPTIONS = [
  { value: '',            label: 'Anticipated start date…' },
  { value: 'immediate',  label: 'Immediate / Urgent' },
  { value: '0-3-months', label: 'Within 3 months' },
  { value: '3-6-months', label: '3 – 6 months' },
  { value: '6-12-months', label: '6 – 12 months' },
  { value: 'planning',   label: 'Planning stage — no fixed date yet' },
];

const HOW_FOUND_OPTIONS = [
  { value: '',         label: 'How did you hear about us? (optional)' },
  { value: 'website',  label: 'Website' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google',   label: 'Google search' },
  { value: 'referral', label: 'Referral / word of mouth' },
  { value: 'council',  label: 'Council / government referral' },
  { value: 'other',    label: 'Other' },
];

const DESCRIPTION_MIN_CHARS = 50;

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAuPhone(raw) {
  const digits = raw.replace(/[\s\-().+]/g, '');
  return /^0[2-9]\d{8}$/.test(digits) || /^61[2-9]\d{8}$/.test(digits);
}

function validateEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validate(f) {
  const e = {};
  if (!f.companyName.trim())
    e.companyName = 'Company name is required.';
  if (!f.contactName.trim())
    e.contactName = 'Contact name is required.';
  if (!f.phone.trim())
    e.phone = 'Phone number is required.';
  else if (!validateAuPhone(f.phone))
    e.phone = 'Enter a valid Australian phone number.';
  if (!f.email.trim())
    e.email = 'Email address is required.';
  else if (!validateEmail(f.email))
    e.email = 'Enter a valid email address.';
  if (!f.projectType)
    e.projectType = 'Please select a project type.';
  if (!f.description.trim())
    e.description = 'Project description is required.';
  else if (f.description.trim().length < DESCRIPTION_MIN_CHARS)
    e.description = `Please provide at least ${DESCRIPTION_MIN_CHARS} characters so we can assess your requirements.`;
  return e;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
      {msg}
    </p>
  );
}

function Label({ id, required, children }) {
  return (
    <label htmlFor={id} className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
      {children}{required && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}

const inputCls = (hasErr) =>
  `w-full bg-slate-800 border ${hasErr ? 'border-red-500/60' : 'border-slate-700'} ` +
  `rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 ` +
  `focus:outline-none focus:ring-2 focus:ring-[#0172ae] focus:border-transparent transition`;

const selectCls = (hasErr) =>
  `${inputCls(hasErr)} appearance-none pr-9 cursor-pointer`;

function ChevronIcon() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center" aria-hidden="true">
      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
      </svg>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-white flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * CivilRFQForm — dedicated RFQ form for /civil/contact.
 *
 * Submits to POST /api/civil-contact, which creates:
 *  Sends notification email to admin@pulseqld.com.au via Resend.
 *
 * Usage:
 *   import CivilRFQForm from '../../components/forms/CivilRFQForm.jsx';
 *   <CivilRFQForm formId={FORM_ID} client:load slot="enquiry-form" />
 */
export default function CivilRFQForm({ formId = '' }) {
  const [fields, setFields] = useState({
    companyName:     '',
    contactName:     '',
    role:            '',
    phone:           '',
    email:           '',
    projectType:     '',
    projectLocation: '',
    projectValue:    '',
    timeline:        '',
    description:     '',
    howFound:        '',
  });

  const [attribution, setAttribution] = useState(null);

  useEffect(() => {
    setAttribution(getAttribution());
  }, []);

  const [errors, setErrors]           = useState({});
  const [touched, setTouched]         = useState({});
  const [status, setStatus]           = useState('idle'); // idle | loading | success | error
  const [serverError, setServerError] = useState('');
  const [leadRef, setLeadRef]         = useState('');
  const [charCount, setCharCount]     = useState(0);

  function handleChange(e) {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    if (name === 'description') setCharCount(value.length);
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  }

  function handleBlur(e) {
    setTouched(prev => ({ ...prev, [e.target.name]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const requiredTouched = {
      companyName: true, contactName: true, phone: true,
      email: true, projectType: true, description: true,
    };
    setTouched(prev => ({ ...prev, ...requiredTouched }));
    const errs = validate(fields);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`rfq-${firstKey}`)?.focus();
      return;
    }

    setStatus('loading');
    setServerError('');

    try {
      const body = new URLSearchParams({
        companyName:     fields.companyName,
        contactName:     fields.contactName,
        role:            fields.role,
        phone:           fields.phone,
        email:           fields.email,
        projectType:     fields.projectType,
        projectLocation: fields.projectLocation,
        projectValue:    fields.projectValue,
        timeline:        fields.timeline,
        description:     fields.description,
        howFound:        fields.howFound,
        source:          `Civil RFQ — ${fields.projectType || 'general enquiry'}`,
        attribution:     JSON.stringify(attribution ?? {}),
      });

      const res  = await fetch('/api/civil-contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setLeadRef(data.ref ?? '');
        setStatus('success');
        pushLeadSubmitted({
          form_name:    'civil-rfq',
          lead_ref:     data.ref,
          service_type: fields.projectType,
          suburb:       fields.projectLocation,
          industry:     'civil',
        });
      } else {
        throw new Error(data.error ?? 'Submission failed. Please email us directly.');
      }
    } catch (err) {
      setStatus('error');
      setServerError(err.message ?? 'Submission failed. Please call or email us directly.');
    }
  }

  // ── Success state ────────────────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-900/40 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Enquiry received</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-1">
          Thank you. A member of our civil team will review your project details and respond within one business day.
        </p>
        <p className="text-slate-400 text-sm leading-relaxed mb-3">
          For urgent infrastructure matters, call us directly on{' '}
          <a href="tel:0452188420" data-track="call" data-call-number="0452188420" data-call-location="sticky" className="font-semibold text-[#0172ae] hover:underline">0452 188 420</a>.
        </p>
        {leadRef && (
          <p className="text-xs text-slate-500 mb-6">
            Your reference: <strong className="font-mono text-slate-400">{leadRef}</strong>
          </p>
        )}
        <a
          href="/civil"
          className="inline-flex items-center justify-center bg-[#0172ae] hover:bg-[#015d8e] text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
        >
          Back to Civil Services
        </a>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden">

      {/* Form header */}
      <div className="bg-slate-700/50 border-b border-slate-700 px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">RFQ Submission Form</h3>
          <p className="text-xs text-slate-400 mt-0.5">All enquiries receive a response within one business day.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 flex-shrink-0 text-[10px] font-bold text-[#0172ae] bg-[#0172ae]/10 border border-[#0172ae]/20 rounded-full px-2.5 py-1">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          Secure
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate aria-label="Civil RFQ submission form" className="px-6 py-6 space-y-5">

        {/* Attribution is sent as a JSON field in the POST body — no hidden inputs needed */}

        {/* ── Section: Organisation ────────────────────────────────────── */}
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-3 pb-2 border-b border-slate-700">
            Organisation
          </div>
          <div className="space-y-4">

            <div>
              <Label id="rfq-companyName" required>Company name</Label>
              <input
                id="rfq-companyName" type="text" name="companyName"
                value={fields.companyName} onChange={handleChange} onBlur={handleBlur}
                autoComplete="organization" placeholder="ABC Civil Contractors Pty Ltd"
                aria-required="true" aria-invalid={!!errors.companyName}
                className={inputCls(touched.companyName && errors.companyName)}
              />
              {touched.companyName && <FieldError msg={errors.companyName}/>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label id="rfq-contactName" required>Contact name</Label>
                <input
                  id="rfq-contactName" type="text" name="contactName"
                  value={fields.contactName} onChange={handleChange} onBlur={handleBlur}
                  autoComplete="name" placeholder="Tom O'Brien"
                  aria-required="true" aria-invalid={!!errors.contactName}
                  className={inputCls(touched.contactName && errors.contactName)}
                />
                {touched.contactName && <FieldError msg={errors.contactName}/>}
              </div>
              <div>
                <Label id="rfq-role">Role / Title</Label>
                <input
                  id="rfq-role" type="text" name="role"
                  value={fields.role} onChange={handleChange}
                  autoComplete="organization-title" placeholder="Project Manager"
                  className={inputCls(false)}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label id="rfq-phone" required>Phone</Label>
                <input
                  id="rfq-phone" type="tel" name="phone"
                  value={fields.phone} onChange={handleChange} onBlur={handleBlur}
                  autoComplete="tel" placeholder="0412 345 678"
                  aria-required="true" aria-invalid={!!errors.phone}
                  className={inputCls(touched.phone && errors.phone)}
                />
                {touched.phone && <FieldError msg={errors.phone}/>}
              </div>
              <div>
                <Label id="rfq-email" required>Email</Label>
                <input
                  id="rfq-email" type="email" name="email"
                  value={fields.email} onChange={handleChange} onBlur={handleBlur}
                  autoComplete="email" placeholder="tom@abccivil.com.au"
                  aria-required="true" aria-invalid={!!errors.email}
                  className={inputCls(touched.email && errors.email)}
                />
                {touched.email && <FieldError msg={errors.email}/>}
              </div>
            </div>

          </div>
        </div>

        {/* ── Section: Project details ──────────────────────────────────── */}
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-3 pb-2 border-b border-slate-700">
            Project Details
          </div>
          <div className="space-y-4">

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label id="rfq-projectType" required>Project type</Label>
                <div className="relative">
                  <select
                    id="rfq-projectType" name="projectType"
                    value={fields.projectType} onChange={handleChange} onBlur={handleBlur}
                    aria-required="true" aria-invalid={!!errors.projectType}
                    className={selectCls(touched.projectType && errors.projectType)}
                  >
                    {PROJECT_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value} disabled={!o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronIcon/>
                </div>
                {touched.projectType && <FieldError msg={errors.projectType}/>}
              </div>
              <div>
                <Label id="rfq-projectLocation">Project location / suburb</Label>
                <input
                  id="rfq-projectLocation" type="text" name="projectLocation"
                  value={fields.projectLocation} onChange={handleChange}
                  placeholder="e.g. Beenleigh, Logan City"
                  className={inputCls(false)}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label id="rfq-projectValue">Estimated project value</Label>
                <div className="relative">
                  <select
                    id="rfq-projectValue" name="projectValue"
                    value={fields.projectValue} onChange={handleChange}
                    className={selectCls(false)}
                  >
                    {PROJECT_VALUE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronIcon/>
                </div>
              </div>
              <div>
                <Label id="rfq-timeline">Anticipated start date</Label>
                <div className="relative">
                  <select
                    id="rfq-timeline" name="timeline"
                    value={fields.timeline} onChange={handleChange}
                    className={selectCls(false)}
                  >
                    {TIMELINE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronIcon/>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <Label id="rfq-description" required>Project description</Label>
                <span
                  className={`text-[10px] tabular-nums ${
                    charCount < DESCRIPTION_MIN_CHARS ? 'text-slate-500' : 'text-green-400'
                  }`}
                  aria-live="polite"
                  aria-label={`${charCount} characters entered, minimum ${DESCRIPTION_MIN_CHARS}`}
                >
                  {charCount} / {DESCRIPTION_MIN_CHARS} min
                </span>
              </div>
              <textarea
                id="rfq-description" name="description"
                value={fields.description} onChange={handleChange} onBlur={handleBlur}
                rows={5}
                placeholder="Describe the project scope, location and key requirements. Include any relevant specifications, council or client standards applicable, required start date and completion timeline. The more detail you provide, the more specific our response can be."
                aria-required="true" aria-invalid={!!errors.description}
                aria-describedby="rfq-description-hint"
                className={`${inputCls(touched.description && errors.description)} resize-none`}
              />
              {touched.description
                ? <FieldError msg={errors.description}/>
                : <p id="rfq-description-hint" className="mt-1.5 text-[11px] text-slate-500">Minimum {DESCRIPTION_MIN_CHARS} characters. Include scope, location, timeline and any applicable specifications.</p>
              }
            </div>

            {/* Upload note */}
            <div className="bg-slate-700/40 border border-slate-600/50 rounded-xl px-4 py-3 flex items-start gap-3">
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
              </svg>
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-0.5">Attaching DA documents or specifications?</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Email drawings, DA conditions or specification documents directly to{' '}
                  <a href="mailto:admin@pulseqld.com.au" className="text-[#0172ae] hover:underline font-medium">
                    admin@pulseqld.com.au
                  </a>
                  {' '}with your company name and project location in the subject line.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Section: Attribution ──────────────────────────────────────── */}
        <div>
          <Label id="rfq-howFound">How did you hear about us?</Label>
          <div className="relative">
            <select
              id="rfq-howFound" name="howFound"
              value={fields.howFound} onChange={handleChange}
              className={selectCls(false)}
            >
              {HOW_FOUND_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronIcon/>
          </div>
        </div>

        {/* ── Server error ──────────────────────────────────────────────── */}
        {status === 'error' && (
          <div role="alert" className="flex items-start gap-3 bg-red-900/30 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-300">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full flex items-center justify-center gap-2 bg-[#0172ae] hover:bg-[#015d8e] disabled:bg-[#0172ae]/60 text-white font-semibold text-sm px-6 py-3.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-[#0172ae]"
          aria-busy={status === 'loading'}
        >
          {status === 'loading'
            ? (<><Spinner/>Submitting enquiry…</>)
            : 'Submit Project Enquiry'
          }
        </button>

        <p className="text-center text-xs text-slate-500">
          Your details are used solely to respond to your enquiry and will not be shared with third parties.
        </p>

      </form>
    </div>
  );
}
