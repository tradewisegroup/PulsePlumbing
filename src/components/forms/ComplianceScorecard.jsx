import { useState } from 'react';
import { pushLeadSubmitted } from '../../lib/analytics';

// ── Questions ─────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: 'backflow',
    question: 'When was your last backflow prevention device test?',
    helpText: 'Backflow devices must be tested annually under Queensland regulations.',
    options: [
      { label: 'Within 12 months', pts: 2 },
      { label: '1–2 years ago',    pts: 1 },
      { label: 'Over 2 years ago', pts: 0 },
      { label: "Never / Don't know", pts: 0 },
    ],
  },
  {
    id: 'form9',
    question: 'Do you have current Form 9 compliance certificates for all plumbing work completed in the last 2 years?',
    helpText: 'Form 9 certificates are required for all notifiable plumbing and drainage work under the Plumbing and Drainage Act 2018.',
    options: [
      { label: 'Yes',    pts: 2 },
      { label: 'Unsure', pts: 1 },
      { label: 'No',     pts: 0 },
    ],
  },
  {
    id: 'cctv',
    question: 'When was your last CCTV drain inspection?',
    helpText: 'CCTV inspections identify root intrusion, blockages, and pipe deterioration before they become costly emergencies.',
    options: [
      { label: 'Within 12 months',   pts: 2 },
      { label: '1–3 years ago',      pts: 1 },
      { label: "Never / Don't know", pts: 0 },
    ],
  },
  {
    id: 'maintenance',
    question: 'Do you have a scheduled preventative maintenance plan with a licensed plumber?',
    helpText: 'A scheduled maintenance plan helps avoid compliance failures and reduces emergency call-out costs.',
    options: [
      { label: 'Yes', pts: 2 },
      { label: 'No',  pts: 0 },
    ],
  },
  {
    id: 'emergency',
    question: 'How many emergency plumbing callouts have you had in the last 12 months?',
    helpText: 'Recurring emergencies often indicate underlying issues that proactive maintenance can prevent.',
    options: [
      { label: '0',          pts: 2 },
      { label: '1–2',        pts: 1 },
      { label: '3–5',        pts: 0 },
      { label: '5 or more',  pts: 0 },
    ],
  },
];

// ── Recommendations per failed question ───────────────────────────────────────

const RECOMMENDATIONS = {
  backflow:    'Schedule a backflow prevention device test — required annually under Queensland Plumbing and Drainage regulations.',
  form9:       'Obtain Form 9 compliance certificates for all notifiable plumbing and drainage work completed in the last 2 years.',
  cctv:        'Book a CCTV drain inspection to identify hidden blockages, root intrusion, and pipe deterioration before they escalate.',
  maintenance: 'Establish a scheduled preventative maintenance plan with a QBCC-licensed plumber to stay ahead of compliance requirements.',
  emergency:   'Multiple emergency callouts signal underlying issues. A proactive maintenance plan can dramatically reduce these costs and risks.',
};

// ── Risk levels ───────────────────────────────────────────────────────────────

function getRisk(score) {
  if (score >= 8) return {
    level: 'Low Risk',
    colour: 'green',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    bar: 'bg-green-500',
    message: 'Your property is well maintained. We recommend a routine annual inspection to stay ahead.',
  };
  if (score >= 5) return {
    level: 'Medium Risk',
    colour: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
    message: 'There are some compliance gaps that should be addressed. We recommend booking a plumbing audit.',
  };
  return {
    level: 'High Risk',
    colour: 'red',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    bar: 'bg-red-500',
    message: 'Your property has significant compliance risks. Contact Pulse today to avoid penalties and emergency costs.',
  };
}

// ── Total steps: 5 questions + email + results = 7 ────────────────────────────

const TOTAL_STEPS = 7;

export default function ComplianceScorecard() {
  const [step, setStep]         = useState(0); // 0–4 = questions, 5 = email, 6 = results
  const [answers, setAnswers]   = useState(Array(QUESTIONS.length).fill(null)); // pts per Q
  const [email, setEmail]       = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle|submitting|done|error

  // ── Derived ────────────────────────────────────────────────────────────────

  const score = answers.reduce((sum, pts) => sum + (pts ?? 0), 0);
  const risk  = getRisk(score);

  // Questions that scored 0 (only those the user has answered)
  const failedIds = QUESTIONS
    .filter((q, i) => answers[i] !== null && answers[i] === 0)
    .map((q) => q.id);

  // Show up to 3 specific recommendations
  const recommendations = failedIds.slice(0, 3).map((id) => RECOMMENDATIONS[id]);

  const displayStep = step + 1; // 1-indexed for UI

  // ── Handlers ──────────────────────────────────────────────────────────────

  function selectAnswer(pts) {
    const updated = [...answers];
    updated[step] = pts;
    setAnswers(updated);
    // Auto-advance after brief visual feedback
    setTimeout(() => setStep((s) => s + 1), 300);
  }

  function handleEmailChange(e) {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setSubmitStatus('submitting');

    try {
      const res = await fetch('/api/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:   email.trim().toLowerCase(),
          score,
          risk:    risk.level,
          answers: QUESTIONS.reduce((acc, q, i) => {
            acc[q.id] = answers[i] ?? 0;
            return acc;
          }, {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Submission failed');
      setSubmitStatus('done');
      pushLeadSubmitted({
        form_name:    'scorecard',
        lead_ref:     data.ref,
        service_type: 'compliance-scorecard',
        industry:     'property-management',
      });
    } catch (err) {
      console.error('[Scorecard]', err);
      setSubmitStatus('error');
    }

    setStep(6); // advance to results regardless of CRM outcome
  }

  // ── Progress bar ──────────────────────────────────────────────────────────

  const progressPct = Math.round((displayStep / TOTAL_STEPS) * 100);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Progress header */}
      {step < 6 && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Step {displayStep} of {TOTAL_STEPS}</span>
            <span>{progressPct}% complete</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0172ae] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Steps 0–4: Questions ───────────────────────────────────────── */}
      {step >= 0 && step <= 4 && (() => {
        const q = QUESTIONS[step];
        return (
          <div className="bg-white rounded-2xl border border-[#D1D5DB] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#0172ae] mb-4">
              Question {step + 1} of {QUESTIONS.length}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-[#000000] mb-2 leading-snug">
              {q.question}
            </h2>
            {q.helpText && (
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">{q.helpText}</p>
            )}
            <div className="space-y-3 mt-6">
              {q.options.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => selectAnswer(opt.pts)}
                  className={`
                    w-full text-left flex items-center justify-between gap-4
                    px-5 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-sm
                    ${answers[step] !== null
                      ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-default'
                      : 'border-[#D1D5DB] text-[#1a1a1a] hover:border-[#0172ae] hover:bg-[#F0F5FA] hover:text-[#0172ae] cursor-pointer'
                    }
                  `}
                  disabled={answers[step] !== null}
                >
                  <span>{opt.label}</span>
                  {opt.pts === 2 && (
                    <span className="text-xs text-slate-400 flex-shrink-0">Best practice</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Step 5: Email capture ──────────────────────────────────────── */}
      {step === 5 && (
        <div className="bg-white rounded-2xl border border-[#D1D5DB] p-6 sm:p-8">
          <div className="w-12 h-12 rounded-xl bg-[#0172ae]/10 flex items-center justify-center mb-5">
            <svg className="w-6 h-6 text-[#0172ae]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#000000] mb-2">Almost there!</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Enter your email to receive your personalised compliance report.
          </p>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="sc-email" className="block text-sm font-semibold text-[#000000] mb-1.5">
                Email address
              </label>
              <input
                id="sc-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com.au"
                value={email}
                onChange={handleEmailChange}
                className={`
                  w-full border rounded-lg px-4 py-3 text-sm text-[#1a1a1a]
                  focus:outline-none focus:ring-2 focus:ring-[#0172ae] focus:border-transparent transition bg-white
                  ${emailError ? 'border-red-400 ring-1 ring-red-400' : 'border-slate-200'}
                `}
              />
              {emailError && <p className="mt-1.5 text-xs text-red-600">{emailError}</p>}
            </div>
            <button
              type="submit"
              disabled={submitStatus === 'submitting'}
              className="
                w-full flex items-center justify-center gap-2
                bg-[#0172ae] hover:bg-[#015d8e] disabled:bg-[#0172ae]/60
                text-white font-semibold text-sm
                px-6 py-3.5 rounded-full transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0172ae]
              "
            >
              {submitStatus === 'submitting' ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Processing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  Get My Report
                </>
              )}
            </button>
            <p className="text-xs text-slate-400 text-center">
              No spam. Your details are used only to send your compliance report.
            </p>
          </form>
        </div>
      )}

      {/* ── Step 6: Results ────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-5">

          {/* Score card */}
          <div className={`rounded-2xl border-2 p-6 sm:p-8 ${risk.bg} ${risk.border}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Your compliance score</p>
                <div className="flex items-baseline gap-3">
                  <span className={`text-5xl font-bold ${risk.text}`}>{score}</span>
                  <span className="text-2xl text-slate-400 font-light">/ 10</span>
                </div>
              </div>
              <span className={`self-start sm:self-auto inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full ${risk.badge}`}>
                {risk.level === 'Low Risk' && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                )}
                {risk.level === 'Medium Risk' && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                )}
                {risk.level === 'High Risk' && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                )}
                {risk.level}
              </span>
            </div>

            {/* Score bar */}
            <div className="w-full h-3 bg-white/60 rounded-full overflow-hidden mb-5">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${risk.bar}`}
                style={{ width: `${(score / 10) * 100}%` }}
              />
            </div>

            <p className={`text-sm leading-relaxed font-medium ${risk.text}`}>{risk.message}</p>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#D1D5DB] p-6">
              <h3 className="text-base font-bold text-[#000000] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#0172ae]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.13-.554-4.133-1.527-5.874"/>
                </svg>
                Recommended actions
              </h3>
              <ul className="space-y-3">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#1a1a1a] leading-relaxed">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-[#0172ae]/10 text-[#0172ae] text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="bg-[#000000] rounded-2xl p-6 sm:p-8 text-center">
            <p className="text-white font-semibold mb-2">Ready to address these issues?</p>
            <p className="text-white/60 text-sm mb-6">Our QBCC-licensed team can audit your property and provide a full compliance report.</p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 bg-[#0172ae] hover:bg-[#015d8e] text-white font-semibold px-8 py-3.5 rounded-full transition-colors shadow-lg shadow-[#0172ae]/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
              </svg>
              Book a Compliance Audit
            </a>
            {submitStatus === 'error' && (
              <p className="mt-4 text-xs text-white/50">
                Note: your score could not be saved automatically. Call us on{' '}
                <a href="tel:0452188420" data-track="call" data-call-number="0452188420" data-call-location="sticky" className="underline hover:text-white transition-colors">0452 188 420</a>
                {' '}to discuss your results.
              </p>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
