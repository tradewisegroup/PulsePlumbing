import { useState, useEffect } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_OPTIONS = [
  { value: '',              label: 'Select a service…' },
  { value: 'maintenance',   label: 'Maintenance Plumbing' },
  { value: 'commercial',    label: 'Commercial Plumbing' },
  { value: 'emergency',     label: 'Emergency / Burst Pipe' },
  { value: 'gas',           label: 'Gas Fitting' },
  { value: 'blocked-drain', label: 'Blocked Drain' },
  { value: 'hot-water',     label: 'Hot Water System' },
  { value: 'cctv',          label: 'CCTV Drain Camera' },
  { value: 'backflow',      label: 'Backflow Prevention' },
  { value: 'other',         label: 'Other' },
];

const INDUSTRY_OPTIONS = [
  { value: '',                      label: 'Select an industry… (optional)' },
  { value: 'retail',                label: 'Retail' },
  { value: 'childcare',             label: 'Childcare' },
  { value: 'education',             label: 'Education' },
  { value: 'aged-care',             label: 'Aged Care' },
  { value: 'student-accommodation', label: 'Student Accommodation' },
  { value: 'commercial-property',   label: 'Commercial Property' },
  { value: 'property-management',   label: 'Property Management' },
  { value: 'new-build',             label: 'New Build' },
  { value: 'civil',                 label: 'Civil' },
  { value: 'residential',           label: 'Residential' },
  { value: 'other',                 label: 'Other' },
];

const CONTACT_TIME_OPTIONS = [
  { value: 'anytime',   label: 'Anytime' },
  { value: 'morning',   label: 'Morning (7 am – 12 pm)' },
  { value: 'afternoon', label: 'Afternoon (12 pm – 5 pm)' },
];

/**
 * Service types that indicate a commercial / B2B context — Company Name shown.
 * Residential, emergency and one-off consumer jobs hide it to reduce friction.
 */
const COMMERCIAL_SERVICE_TYPES = new Set([
  'maintenance',
  'commercial',
  'gas',
  'cctv',
  'backflow',
]);

// ─── Validation ───────────────────────────────────────────────────────────────

/** Strip formatting characters then check for a valid Australian phone number. */
function validateAuPhone(raw) {
  const digits = raw.replace(/[\s\-().+]/g, '');
  // Accept: 10-digit numbers starting with 0 (mobile 04xx, landline 02/03/07/08)
  // Accept: +61 prefix — e.g. +61412345678 (11 digits after stripping +)
  if (/^0[2-9]\d{8}$/.test(digits)) return true;       // 0X XXXX XXXX
  if (/^61[2-9]\d{8}$/.test(digits)) return true;      // 61X XXXX XXXX (stripped +)
  return false;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validate(fields) {
  const errors = {};
  if (!fields.fullName.trim())         errors.fullName  = 'Full name is required.';
  if (!fields.phone.trim())            errors.phone     = 'Phone number is required.';
  else if (!validateAuPhone(fields.phone)) errors.phone = 'Enter a valid Australian phone number (e.g. 0412 345 678).';
  if (!fields.email.trim())            errors.email     = 'Email address is required.';
  else if (!validateEmail(fields.email))   errors.email = 'Enter a valid email address.';
  if (!fields.serviceType)             errors.serviceType = 'Please select a service.';
  return errors;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

function Label({ htmlFor, required, children }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-600 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}

const inputBase =
  'w-full border rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#046bd2] focus:border-transparent transition bg-white';

function inputClass(hasError) {
  return `${inputBase} ${hasError ? 'border-red-400 bg-red-50' : 'border-slate-200'}`;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4 text-white flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * QuoteForm — React island.
 * Usage in Astro: <QuoteForm client:load />
 * Optional prop: initialService — pre-selects the service dropdown.
 */
export default function QuoteForm({ initialService = '' }) {
  // ── Form field state ────────────────────────────────────────────────────────
  const [fields, setFields] = useState({
    fullName:           '',
    companyName:        '',
    phone:              '',
    email:              '',
    serviceType:        initialService,
    industry:           '',
    suburb:             '',
    message:            '',
    preferredTime:      'anytime',
  });

  // ── Hidden tracking fields — populated on mount ─────────────────────────────
  const [tracking, setTracking] = useState({
    page_source:    '',
    utm_source:     '',
    utm_medium:     '',
    utm_campaign:   '',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTracking({
      page_source:  window.location.pathname,
      utm_source:   params.get('utm_source')   ?? '',
      utm_medium:   params.get('utm_medium')   ?? '',
      utm_campaign: params.get('utm_campaign') ?? '',
    });
  }, []);

  // ── Validation / submission state ───────────────────────────────────────────
  const [errors, setErrors]           = useState({});
  const [touched, setTouched]         = useState({});
  const [status, setStatus]           = useState('idle'); // idle | loading | success | error
  const [serverError, setServerError] = useState('');

  // ── Derived ─────────────────────────────────────────────────────────────────
  const showCompany = COMMERCIAL_SERVICE_TYPES.has(fields.serviceType);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    // Clear the error for this field as the user types
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  function handleBlur(e) {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Mark all required fields as touched to surface errors
    setTouched({ fullName: true, phone: true, email: true, serviceType: true });

    const validationErrors = validate(fields);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Focus the first error field
      const first = Object.keys(validationErrors)[0];
      document.getElementById(`qf-${first}`)?.focus();
      return;
    }

    setStatus('loading');
    setServerError('');

    try {
      const body = new URLSearchParams({
        // User-entered fields
        full_name:        fields.fullName,
        company_name:     fields.companyName,
        phone:            fields.phone,
        email:            fields.email,
        service_type:     fields.serviceType,
        industry:         fields.industry,
        suburb:           fields.suburb,
        message:          fields.message,
        preferred_time:   fields.preferredTime,
        // Tracking
        ...tracking,
      });

      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success !== false) {
        setStatus('success');
      } else {
        throw new Error(json.error ?? 'Something went wrong. Please try again or call us directly.');
      }
    } catch (err) {
      setStatus('error');
      setServerError(err.message ?? 'Submission failed. Please call us on 0452 188 420.');
    }
  }

  // ── Success state ────────────────────────────────────────────────────────────

  if (status === 'success') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#1e293b] mb-2">
          Thanks! We'll call you within 2 hours.
        </h3>
        <p className="text-[#334155] text-sm leading-relaxed mb-6">
          Your quote request has been received. One of our licensed plumbers will be in touch shortly.
          For urgent jobs, call us directly on{' '}
          <a href="tel:0452188420" className="font-bold text-[#046bd2] hover:underline">
            0452 188 420
          </a>.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center bg-[#046bd2] hover:bg-[#045cb4] text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
        >
          Back to home
        </a>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

      {/* Form header */}
      <div className="bg-[#F0F5FA] border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-bold text-[#1e293b]">Get a free quote</h2>
        <p className="text-sm text-[#334155] mt-0.5">
          We respond within 2 hours during business hours.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Quote request form"
        className="px-6 py-6 space-y-5"
      >
        {/* Hidden tracking fields */}
        <input type="hidden" name="page_source"  value={tracking.page_source}  />
        <input type="hidden" name="utm_source"   value={tracking.utm_source}   />
        <input type="hidden" name="utm_medium"   value={tracking.utm_medium}   />
        <input type="hidden" name="utm_campaign" value={tracking.utm_campaign} />

        {/* ── Row 1: Full Name ─────────────────────────────────────────────── */}
        <div>
          <Label htmlFor="qf-fullName" required>Full name</Label>
          <input
            id="qf-fullName"
            type="text"
            name="fullName"
            value={fields.fullName}
            onChange={handleChange}
            onBlur={handleBlur}
            autoComplete="name"
            placeholder="Jane Smith"
            aria-required="true"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? 'qf-fullName-err' : undefined}
            className={inputClass(touched.fullName && errors.fullName)}
          />
          {touched.fullName && <FieldError message={errors.fullName} />}
        </div>

        {/* ── Company Name (conditional) ───────────────────────────────────── */}
        {showCompany && (
          <div>
            <Label htmlFor="qf-companyName">Company name</Label>
            <input
              id="qf-companyName"
              type="text"
              name="companyName"
              value={fields.companyName}
              onChange={handleChange}
              autoComplete="organization"
              placeholder="Acme Facilities Pty Ltd"
              className={inputClass(false)}
            />
          </div>
        )}

        {/* ── Row 2: Phone + Email ─────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="qf-phone" required>Phone</Label>
            <input
              id="qf-phone"
              type="tel"
              name="phone"
              value={fields.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="tel"
              placeholder="0412 345 678"
              aria-required="true"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'qf-phone-err' : undefined}
              className={inputClass(touched.phone && errors.phone)}
            />
            {touched.phone && <FieldError message={errors.phone} />}
          </div>

          <div>
            <Label htmlFor="qf-email" required>Email</Label>
            <input
              id="qf-email"
              type="email"
              name="email"
              value={fields.email}
              onChange={handleChange}
              onBlur={handleBlur}
              autoComplete="email"
              placeholder="jane@example.com.au"
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'qf-email-err' : undefined}
              className={inputClass(touched.email && errors.email)}
            />
            {touched.email && <FieldError message={errors.email} />}
          </div>
        </div>

        {/* ── Row 3: Service Type + Industry ──────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="qf-serviceType" required>Service type</Label>
            <div className="relative">
              <select
                id="qf-serviceType"
                name="serviceType"
                value={fields.serviceType}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-required="true"
                aria-invalid={!!errors.serviceType}
                className={`${inputClass(touched.serviceType && errors.serviceType)} appearance-none pr-9 cursor-pointer`}
              >
                {SERVICE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* Chevron */}
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center" aria-hidden="true">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {touched.serviceType && <FieldError message={errors.serviceType} />}
          </div>

          <div>
            <Label htmlFor="qf-industry">Industry</Label>
            <div className="relative">
              <select
                id="qf-industry"
                name="industry"
                value={fields.industry}
                onChange={handleChange}
                className={`${inputClass(false)} appearance-none pr-9 cursor-pointer`}
              >
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center" aria-hidden="true">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 4: Suburb ────────────────────────────────────────────────── */}
        <div>
          <Label htmlFor="qf-suburb">Suburb</Label>
          <input
            id="qf-suburb"
            type="text"
            name="suburb"
            value={fields.suburb}
            onChange={handleChange}
            autoComplete="address-level2"
            placeholder="e.g. Beenleigh, Loganholme, Capalaba…"
            className={inputClass(false)}
          />
        </div>

        {/* ── Row 5: Message ───────────────────────────────────────────────── */}
        <div>
          <Label htmlFor="qf-message">Tell us about the job</Label>
          <textarea
            id="qf-message"
            name="message"
            value={fields.message}
            onChange={handleChange}
            rows={4}
            placeholder="Describe the issue or what you need — the more detail, the more accurate your quote."
            className={`${inputClass(false)} resize-none`}
          />
        </div>

        {/* ── Row 6: Preferred contact time ────────────────────────────────── */}
        <fieldset>
          <legend className="block text-xs font-semibold text-slate-600 mb-2.5">
            Preferred contact time
          </legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Preferred contact time">
            {CONTACT_TIME_OPTIONS.map((opt) => {
              const checked = fields.preferredTime === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium cursor-pointer
                    transition-all select-none
                    ${checked
                      ? 'bg-[#046bd2] border-[#046bd2] text-white shadow-sm shadow-[#046bd2]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-[#046bd2] hover:text-[#046bd2]'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="preferredTime"
                    value={opt.value}
                    checked={checked}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* ── Server error ─────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div
            role="alert"
            className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700"
          >
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        {/* ── Submit button ────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="
            w-full flex items-center justify-center gap-2
            bg-[#046bd2] hover:bg-[#045cb4] disabled:bg-[#046bd2]/70
            text-white font-semibold text-sm
            px-6 py-3.5 rounded-full
            transition-colors shadow-sm shadow-[#046bd2]/30
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#046bd2]
          "
          aria-busy={status === 'loading'}
        >
          {status === 'loading' ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : (
            'Send Quote Request'
          )}
        </button>

        <p className="text-center text-xs text-slate-400">
          By submitting you agree to be contacted by Pulse Plumbing &amp; Gas regarding your enquiry.
        </p>
      </form>
    </div>
  );
}
