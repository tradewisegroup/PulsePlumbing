import { useState, useEffect } from 'react';

// ─── Field options ────────────────────────────────────────────────────────────

const PROJECT_TYPE_OPTIONS = [
  { value: '',                        label: 'Select project type…' },
  { value: 'water-mains',             label: 'Water Main Installation / Extension' },
  { value: 'stormwater',              label: 'Stormwater Infrastructure' },
  { value: 'sewer-construction',      label: 'Sewer Construction' },
  { value: 'infrastructure-maintenance', label: 'Infrastructure Maintenance Contract' },
  { value: 'pump-station',            label: 'Pump Station' },
  { value: 'subdivision-reticulation', label: 'Subdivision Reticulation' },
  { value: 'trenchless',              label: 'Trenchless Rehabilitation' },
  { value: 'other',                   label: 'Other / Multiple Disciplines' },
];

const PROJECT_VALUE_OPTIONS = [
  { value: '',          label: 'Estimated project value…' },
  { value: 'under-50k', label: 'Under $50,000' },
  { value: '50k-250k',  label: '$50,000 – $250,000' },
  { value: '250k-1m',   label: '$250,000 – $1 million' },
  { value: '1m-5m',     label: '$1 million – $5 million' },
  { value: '5m-plus',   label: '$5 million+' },
  { value: 'tbd',       label: 'To be determined' },
];

const TIMELINE_OPTIONS = [
  { value: '',              label: 'Estimated start date…' },
  { value: 'immediate',     label: 'Immediate / Urgent' },
  { value: '0-3-months',    label: 'Within 3 months' },
  { value: '3-6-months',    label: '3 – 6 months' },
  { value: '6-12-months',   label: '6 – 12 months' },
  { value: 'planning',      label: 'Planning stage — no fixed date yet' },
];

const HOW_FOUND_OPTIONS = [
  { value: '',            label: 'How did you hear about us? (optional)' },
  { value: 'google',      label: 'Google search' },
  { value: 'referral',    label: 'Referral / word of mouth' },
  { value: 'tender',      label: 'Tender portal / procurement system' },
  { value: 'linkedin',    label: 'LinkedIn' },
  { value: 'repeat',      label: 'Previous client' },
  { value: 'other',       label: 'Other' },
];

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateAuPhone(raw) {
  const digits = raw.replace(/[\s\-().+]/g, '');
  return /^0[2-9]\d{8}$/.test(digits) || /^61[2-9]\d{8}$/.test(digits);
}

function validateEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validate(f) {
  const e = {};
  if (!f.companyName.trim())    e.companyName   = 'Company name is required.';
  if (!f.contactName.trim())    e.contactName   = 'Contact name is required.';
  if (!f.phone.trim())          e.phone         = 'Phone number is required.';
  else if (!validateAuPhone(f.phone)) e.phone   = 'Enter a valid Australian phone number.';
  if (!f.email.trim())          e.email         = 'Email address is required.';
  else if (!validateEmail(f.email))   e.email   = 'Enter a valid email address.';
  if (!f.projectType)           e.projectType   = 'Please select a project type.';
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

/** Base input class — dark card context */
const inputCls = (hasErr) =>
  `w-full bg-slate-800 border ${hasErr ? 'border-red-500/60' : 'border-slate-700'} ` +
  `rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 ` +
  `focus:outline-none focus:ring-2 focus:ring-[#046bd2] focus:border-transparent transition`;

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
 * CivilEnquiryForm — React island for B2B civil project enquiries.
 *
 * Usage in Astro:
 *   import CivilEnquiryForm from '../../components/forms/CivilEnquiryForm.jsx';
 *   <CivilEnquiryForm
 *     formId={import.meta.env.PUBLIC_HUBSPOT_CIVIL_FORM_ID ?? ''}
 *     initialProjectType="water-mains"
 *     client:load
 *   />
 */
export default function CivilEnquiryForm({ formId = '', initialProjectType = '' }) {
  const [fields, setFields] = useState({
    companyName:   '',
    contactName:   '',
    phone:         '',
    email:         '',
    projectType:   initialProjectType,
    projectValue:  '',
    timeline:      '',
    projectLocation: '',
    message:       '',
    howFound:      '',
  });

  const [tracking, setTracking] = useState({
    page_source:  '',
    utm_source:   '',
    utm_medium:   '',
    utm_campaign: '',
  });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setTracking({
      page_source:  window.location.pathname,
      utm_source:   p.get('utm_source')   ?? '',
      utm_medium:   p.get('utm_medium')   ?? '',
      utm_campaign: p.get('utm_campaign') ?? '',
    });
  }, []);

  const [errors, setErrors]         = useState({});
  const [touched, setTouched]       = useState({});
  const [status, setStatus]         = useState('idle'); // idle | loading | success | error
  const [serverError, setServerError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  }

  function handleBlur(e) {
    setTouched(prev => ({ ...prev, [e.target.name]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ companyName: true, contactName: true, phone: true, email: true, projectType: true });
    const errs = validate(fields);
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(`cef-${Object.keys(errs)[0]}`)?.focus();
      return;
    }

    setStatus('loading');
    setServerError('');

    try {
      const body = new URLSearchParams({
        // Core fields
        companyName:      fields.companyName,
        contactName:      fields.contactName,
        phone:            fields.phone,
        email:            fields.email,
        // Civil-specific fields
        projectType:      fields.projectType,
        projectValue:     fields.projectValue,
        timeline:         fields.timeline,
        projectLocation:  fields.projectLocation,
        description:      fields.message,
        howFound:         fields.howFound,
        // Routing
        form_id:          formId,
        source:           `Civil — ${fields.projectType || 'general enquiry'}`,
        // Tracking
        utm_source:       tracking.utm_source,
        utm_medium:       tracking.utm_medium,
        utm_campaign:     tracking.utm_campaign,
      });

      const res = await fetch('/api/civil-contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        setStatus('success');
      } else {
        throw new Error(json.error ?? 'Submission failed. Please email us directly.');
      }
    } catch (err) {
      setStatus('error');
      setServerError(err.message ?? 'Submission failed. Please call or email us directly.');
    }
  }

  // ── Success ─────────────────────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-900/40 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Enquiry received</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Thanks for your enquiry. A member of our civil team will review your project details and respond
          within one business day. For urgent matters, call us on{' '}
          <a href="tel:0452188420" className="font-semibold text-[#046bd2] hover:underline">0452 188 420</a>.
        </p>
        <a
          href="/civil"
          className="inline-flex items-center justify-center bg-[#046bd2] hover:bg-[#045cb4] text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
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
      <div className="bg-slate-700/50 border-b border-slate-700 px-6 py-4">
        <h3 className="text-base font-bold text-white">Project Enquiry Form</h3>
        <p className="text-xs text-slate-400 mt-0.5">We respond to civil enquiries within one business day.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate aria-label="Civil project enquiry form" className="px-6 py-6 space-y-5">

        {/* Hidden tracking */}
        <input type="hidden" name="page_source"  value={tracking.page_source}  />
        <input type="hidden" name="utm_source"   value={tracking.utm_source}   />
        <input type="hidden" name="utm_medium"   value={tracking.utm_medium}   />
        <input type="hidden" name="utm_campaign" value={tracking.utm_campaign} />
        <input type="hidden" name="form_id"      value={formId}                />

        {/* ── Row: Company + Contact ────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label id="cef-companyName" required>Company name</Label>
            <input
              id="cef-companyName" type="text" name="companyName"
              value={fields.companyName} onChange={handleChange} onBlur={handleBlur}
              autoComplete="organization" placeholder="ABC Civil Pty Ltd"
              aria-required="true" aria-invalid={!!errors.companyName}
              className={inputCls(touched.companyName && errors.companyName)}
            />
            {touched.companyName && <FieldError msg={errors.companyName}/>}
          </div>
          <div>
            <Label id="cef-contactName" required>Contact name</Label>
            <input
              id="cef-contactName" type="text" name="contactName"
              value={fields.contactName} onChange={handleChange} onBlur={handleBlur}
              autoComplete="name" placeholder="Tom O'Brien"
              aria-required="true" aria-invalid={!!errors.contactName}
              className={inputCls(touched.contactName && errors.contactName)}
            />
            {touched.contactName && <FieldError msg={errors.contactName}/>}
          </div>
        </div>

        {/* ── Row: Phone + Email ────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label id="cef-phone" required>Phone</Label>
            <input
              id="cef-phone" type="tel" name="phone"
              value={fields.phone} onChange={handleChange} onBlur={handleBlur}
              autoComplete="tel" placeholder="0412 345 678"
              aria-required="true" aria-invalid={!!errors.phone}
              className={inputCls(touched.phone && errors.phone)}
            />
            {touched.phone && <FieldError msg={errors.phone}/>}
          </div>
          <div>
            <Label id="cef-email" required>Email</Label>
            <input
              id="cef-email" type="email" name="email"
              value={fields.email} onChange={handleChange} onBlur={handleBlur}
              autoComplete="email" placeholder="tom@example.com.au"
              aria-required="true" aria-invalid={!!errors.email}
              className={inputCls(touched.email && errors.email)}
            />
            {touched.email && <FieldError msg={errors.email}/>}
          </div>
        </div>

        {/* ── Row: Project Type + Location ──────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label id="cef-projectType" required>Project type</Label>
            <div className="relative">
              <select
                id="cef-projectType" name="projectType"
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
            <Label id="cef-projectLocation">Project location / suburb</Label>
            <input
              id="cef-projectLocation" type="text" name="projectLocation"
              value={fields.projectLocation} onChange={handleChange}
              placeholder="e.g. Beenleigh, Logan City"
              className={inputCls(false)}
            />
          </div>
        </div>

        {/* ── Row: Value + Timeline ─────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label id="cef-projectValue">Estimated project value</Label>
            <div className="relative">
              <select
                id="cef-projectValue" name="projectValue"
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
            <Label id="cef-timeline">Estimated start</Label>
            <div className="relative">
              <select
                id="cef-timeline" name="timeline"
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

        {/* ── Project brief ─────────────────────────────────────────────── */}
        <div>
          <Label id="cef-message">Project brief</Label>
          <textarea
            id="cef-message" name="message"
            value={fields.message} onChange={handleChange}
            rows={4}
            placeholder="Describe the project scope, location, key requirements and any documents you can share. The more detail you provide, the more specific our response can be."
            className={`${inputCls(false)} resize-none`}
          />
        </div>

        {/* ── How found ─────────────────────────────────────────────────── */}
        <div>
          <Label id="cef-howFound">How did you hear about us?</Label>
          <div className="relative">
            <select
              id="cef-howFound" name="howFound"
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
            {serverError}
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full flex items-center justify-center gap-2 bg-[#046bd2] hover:bg-[#045cb4] disabled:bg-[#046bd2]/60 text-white font-semibold text-sm px-6 py-3.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-[#046bd2]"
          aria-busy={status === 'loading'}
        >
          {status === 'loading' ? (<><Spinner/>Submitting…</>) : 'Submit Enquiry'}
        </button>

        <p className="text-center text-xs text-slate-500">
          Your details are used solely to respond to your enquiry. We do not share them with third parties.
        </p>
      </form>
    </div>
  );
}
