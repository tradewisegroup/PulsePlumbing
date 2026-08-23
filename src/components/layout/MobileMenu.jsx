import { useState } from 'react';
import { createPortal } from 'react-dom';

const NAV = [
  { label: 'Home',     href: '/' },
  { label: 'Services', href: '/services' },
  {
    label: 'Industries',
    href: '/industries',
    children: [
      { label: 'All Industries',         href: '/industries'                        },
      { label: 'Retail',                 href: '/industries/retail'                 },
      { label: 'Hospitality',            href: '/industries/hospitality'            },
      { label: 'Childcare',              href: '/industries/childcare'              },
      { label: 'Education',              href: '/industries/education'              },
      { label: 'Aged Care',              href: '/industries/aged-care'              },
      { label: 'Accommodation',          href: '/industries/student-accommodation'  },
      { label: 'Commercial Real Estate', href: '/industries/commercial-real-estate' },
      { label: 'Property Management',    href: '/industries/property-management'    },
      { label: 'New Builds',             href: '/industries/new-builds'             },
    ],
  },
  { label: 'Civil', href: '/civil' },
  {
    label: 'Resources',
    href: '/knowledge-base',
    children: [
      { label: 'Testimonials',         href: '/testimonials'     },
      { label: 'Knowledge Base',       href: '/knowledge-base'   },
      { label: 'Compliance Scorecard', href: '/strata-scorecard' },
      { label: 'Blog',                 href: '/blog'             },
    ],
  },
  { label: 'About',   href: '/about'   },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

export default function MobileMenu() {
  const [isOpen,     setIsOpen]     = useState(false);
  const [openGroup,  setOpenGroup]  = useState(null);

  function close()              { setIsOpen(false); setOpenGroup(null); }
  function toggleGroup(label)   { setOpenGroup((p) => (p === label ? null : label)); }

  return (
    <>
      {/* Hamburger button — always visible on small/medium screens */}
      <button
        type="button"
        onClick={() => { setIsOpen((v) => !v); setOpenGroup(null); }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        aria-controls="mobile-nav"
        className="lg:hidden relative z-[60] p-3 -mr-1 text-slate-600 hover:text-[#0172ae] active:text-[#0172ae] transition-colors rounded-lg touch-manipulation"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Portal to document.body — a backdrop-filter parent would
              otherwise clip this fixed panel to the 64px header. */}
          <div
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={close}
            aria-hidden="true"
          />

          <nav
            id="mobile-nav"
            role="navigation"
            aria-label="Main navigation"
            className="fixed top-0 right-0 bottom-0 z-[90] w-[min(320px,calc(100vw-48px))] bg-white shadow-2xl flex flex-col lg:hidden overflow-y-auto overscroll-contain"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <a href="/" onClick={close}>
                <img src="/images/logo-light.jpeg" alt="Pulse Plumbing, Gas & Civil" width={180} height={70} className="h-11 w-auto" />
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="p-2.5 text-slate-400 hover:text-slate-900 active:text-slate-900 transition-colors rounded-lg touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Emergency call banner */}
            <a
              href="tel:0452188420"
              onClick={close}
              data-track="emergency-cta"
              data-call-number="emergency"
              data-call-location="header"
              className="flex items-center justify-between gap-3 bg-[#f19329] hover:bg-[#d97d1a] active:bg-[#d97d1a] px-5 py-3.5 transition-colors shrink-0 touch-manipulation"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                </span>
                <span className="text-white text-sm font-bold">Emergency Plumber</span>
              </div>
              <span className="text-white text-sm font-bold tracking-wide">0452 188 420</span>
            </a>

            {/* Nav links */}
            <ul className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {NAV.map((item) => {
                if (!item.children) {
                  return (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        onClick={close}
                        className="flex items-center w-full px-4 py-3.5 text-sm font-semibold text-slate-700 hover:text-[#0172ae] hover:bg-[#F0F5FA] active:bg-[#F0F5FA] rounded-xl transition-colors touch-manipulation"
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                }

                const expanded = openGroup === item.label;
                return (
                  <li key={item.label}>
                    {/* Split row: label navigates, chevron toggles */}
                    <div className={`flex items-center rounded-xl transition-colors ${expanded ? 'bg-[#F0F5FA]' : 'hover:bg-[#F0F5FA]'}`}>
                      <a
                        href={item.href}
                        onClick={close}
                        className="flex-1 px-4 py-3.5 text-sm font-semibold text-slate-700 hover:text-[#0172ae] active:text-[#0172ae] transition-colors touch-manipulation"
                      >
                        {item.label}
                      </a>
                      <button
                        onClick={() => toggleGroup(item.label)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
                        className="px-3 py-3.5 text-slate-400 hover:text-[#0172ae] active:text-[#0172ae] transition-colors touch-manipulation"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180 text-[#0172ae]' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Children */}
                    {expanded && (
                      <ul className="mt-1 ml-4 pl-3 border-l-2 border-[#0172ae]/25 space-y-0.5 pb-1">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <a
                              href={child.href}
                              onClick={close}
                              className="flex items-center w-full px-3 py-3 text-sm text-slate-600 hover:text-[#0172ae] hover:bg-[#F0F5FA] active:bg-[#F0F5FA] rounded-lg transition-colors touch-manipulation"
                            >
                              {child.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Footer CTAs */}
            <div className="p-4 border-t border-slate-100 space-y-2 shrink-0">
              <a
                href="/contact"
                onClick={close}
                className="flex items-center justify-center w-full bg-[#0172ae] hover:bg-[#015d8e] active:bg-[#015d8e] text-white text-sm font-bold px-6 py-3.5 rounded-full transition-colors touch-manipulation"
              >
                Get a Free Quote
              </a>
              <a
                href="tel:0721504175"
                onClick={close}
                data-track="call"
                data-call-number="office"
                data-call-location="header"
                className="flex items-center justify-center w-full border border-slate-200 hover:border-[#0172ae] active:border-[#0172ae] text-slate-600 hover:text-[#0172ae] text-sm font-semibold px-6 py-3.5 rounded-full transition-colors touch-manipulation"
              >
                Office: 07 2150 4175
              </a>
            </div>
          </nav>
        </>,
        document.body,
      )}
    </>
  );
}
