import { useState } from 'react';
import CapabilityForm from './CapabilityForm.jsx';

export default function CapabilityModal({ buttonText = 'Request Capability Statement', buttonClass = '' }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass}
      >
        {buttonText}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cap-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#0172ae] mb-1">Civil Capability</p>
                <h2 id="cap-modal-title" className="text-xl font-bold text-[#000000]">
                  Download Capability Statement
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors rounded-lg"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <CapabilityForm
              formName="capability-modal"
              onSuccess={() => setDone(true)}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
