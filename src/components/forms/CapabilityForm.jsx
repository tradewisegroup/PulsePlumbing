import { useState } from 'react';
import { pushLeadSubmitted } from '../../lib/analytics';

const inputBase =
  'w-full border border-slate-200 rounded-lg px-4 py-3 text-sm text-[#1a1a1a] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0172ae] focus:border-transparent ' +
  'transition bg-white placeholder:text-slate-400';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  // Must have at least 10 digits
  return phone.replace(/\D/g, '').length >= 10;
}

export default function CapabilityForm({ onSuccess, onClose }) {
  const [fields, setFields] = useState({
    name: '', company: '', position: '', mobile: '', email: '',
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [serverError, setServerError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setFields(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  }

  function validate() {
    const e = {};
    if (!fields.name.trim())                      e.name     = 'Full name is required.';
    if (!fields.company.trim())                   e.company  = 'Company name is required.';
    if (!fields.position.trim())                  e.position = 'Your position is required.';
    if (!validatePhone(fields.mobile))            e.mobile   = 'Enter a valid 10-digit mobile number.';
    if (!validateEmail(fields.email))             e.email    = 'Enter a valid email address.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) { setErrors(validationErrors); return; }

    setStatus('submitting');
    setServerError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:   fields.name.trim(),
          email:       fields.email.trim().toLowerCase(),
          phone:       fields.mobile.trim(),
          company_name: fields.company.trim(),
          message:     `Position: ${fields.position.trim()}\n\nRequested: Civil Capability Statement`,
          source:      'Capability Statement Request',
          page_source: 'Civil Page',
          tag:         'capability-statement',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setStatus('done');
        pushLeadSubmitted({
          form_name:    'capability-statement',
          lead_ref:     data.ref,
          service_type: 'civil',
          industry:     'civil',
        });
        onSuccess?.();
      } else {
        throw new Error(data.error ?? 'Submission failed');
      }
    } catch (err) {
      setServerError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 bg-[#0172ae]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[#0172ae]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[#000000] mb-2">Request received</h3>
        <p className="text-sm text-slate-500">We'll send the capability statement to {fields.email} within 1 business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="text-sm text-slate-500 mb-2">
        Complete your details and we'll send the capability statement directly to your inbox.
      </p>

      {/* Name + Position */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cs-name" className="block text-sm font-semibold text-[#000000] mb-1.5">
            Full Name <span className="text-[#f19329]">*</span>
          </label>
          <input id="cs-name" name="name" type="text" autoComplete="name"
            placeholder="Jane Smith" value={fields.name} onChange={handleChange}
            className={`${inputBase} ${errors.name ? 'border-red-400' : ''}`} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="cs-position" className="block text-sm font-semibold text-[#000000] mb-1.5">
            Position / Title <span className="text-[#f19329]">*</span>
          </label>
          <input id="cs-position" name="position" type="text"
            placeholder="Project Manager" value={fields.position} onChange={handleChange}
            className={`${inputBase} ${errors.position ? 'border-red-400' : ''}`} />
          {errors.position && <p className="mt-1 text-xs text-red-600">{errors.position}</p>}
        </div>
      </div>

      {/* Company */}
      <div>
        <label htmlFor="cs-company" className="block text-sm font-semibold text-[#000000] mb-1.5">
          Company <span className="text-[#f19329]">*</span>
        </label>
        <input id="cs-company" name="company" type="text" autoComplete="organization"
          placeholder="Acme Civil Pty Ltd" value={fields.company} onChange={handleChange}
          className={`${inputBase} ${errors.company ? 'border-red-400' : ''}`} />
        {errors.company && <p className="mt-1 text-xs text-red-600">{errors.company}</p>}
      </div>

      {/* Mobile + Email */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cs-mobile" className="block text-sm font-semibold text-[#000000] mb-1.5">
            Mobile <span className="text-[#f19329]">*</span>
          </label>
          <input id="cs-mobile" name="mobile" type="tel" autoComplete="tel"
            placeholder="04XX XXX XXX" value={fields.mobile} onChange={handleChange}
            className={`${inputBase} ${errors.mobile ? 'border-red-400' : ''}`} />
          {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>}
        </div>
        <div>
          <label htmlFor="cs-email" className="block text-sm font-semibold text-[#000000] mb-1.5">
            Email <span className="text-[#f19329]">*</span>
          </label>
          <input id="cs-email" name="email" type="email" autoComplete="email"
            placeholder="jane@company.com.au" value={fields.email} onChange={handleChange}
            className={`${inputBase} ${errors.email ? 'border-red-400' : ''}`} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>
      </div>

      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{serverError}</div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={status === 'submitting'}
          className="flex-1 flex items-center justify-center gap-2 bg-[#0172ae] hover:bg-[#015d8e] disabled:bg-[#0172ae]/60 text-white font-semibold text-sm px-6 py-3 rounded-full transition-colors">
          {status === 'submitting' ? (
            <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>Send Me the Capability Statement</>
          )}
        </button>
        {onClose && (
          <button type="button" onClick={onClose}
            className="px-4 py-3 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            Cancel
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Your details are used only to send the capability statement and follow up on your enquiry.
      </p>
    </form>
  );
}
