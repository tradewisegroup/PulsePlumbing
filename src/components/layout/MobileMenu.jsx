import { useState } from 'react';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Services',    href: '/services' },
  { label: 'Industries',  href: '/industries' },
  { label: 'Civil', href: '/civil' },
  {
    label: 'Resources',
    children: [
      { label: 'Knowledge Base',       href: '/knowledge-base' },
      { label: 'Compliance Scorecard', href: '/strata-scorecard' },
      { label: 'Blog',                 href: '/blog' },
    ],
  },
  { label: 'About',   href: '/about' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(/** @type {string|null} */ (null));

  function toggleGroup(label) {
    setOpenGroup((prev) => (prev === label ? null : label));
  }

  return (
    <>
      {/* Hamburger / close button */}
      <button
        onClick={() => { setIsOpen((v) => !v); setOpenGroup(null); }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
        aria-controls="mobile-nav"
        className="lg:hidden p-2 -mr-1 text-slate-600 hover:text-[#0172ae] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#0172ae]"
      >
        {isOpen ? (
          /* X icon */
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          /* Hamburger icon */
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <nav
            id="mobile-nav"
            className="fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[calc(100vw-3rem)] bg-white shadow-2xl flex flex-col lg:hidden overflow-y-auto"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <a href="/" onClick={() => setIsOpen(false)}>
                <img
                  src="/images/logo.png"
                  alt="Pulse Plumbing & Gas"
                  width={140}
                  height={54}
                  className="h-9 w-auto"
                />
              </a>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="p-2 text-slate-400 hover:text-slate-900 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#0172ae]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Emergency banner — always visible */}
            <a
              href="tel:0452188420"
              className="flex items-center justify-between gap-3 bg-[#f19329] hover:bg-[#d97d1a] px-5 py-3 transition-colors"
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

            {/* Nav items */}
            <ul className="flex-1 px-3 py-4 space-y-0.5">
              {NAV.map((item) => {
                if (!item.children) {
                  return (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-[#0172ae] hover:bg-[#F0F5FA] rounded-lg transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                }

                const expanded = openGroup === item.label;
                return (
                  <li key={item.label}>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      aria-expanded={expanded}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-[#0172ae] hover:bg-[#F0F5FA] rounded-lg transition-colors"
                    >
                      {item.label}
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expanded && (
                      <ul className="mt-1 ml-3 pl-3 border-l-2 border-[#0172ae]/20 space-y-0.5">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <a
                              href={child.href}
                              onClick={() => setIsOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:text-[#0172ae] hover:bg-[#F0F5FA] rounded-lg transition-colors"
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

            {/* Panel footer CTA */}
            <div className="p-4 border-t border-slate-100 space-y-2">
              <a
                href="/contact"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-full bg-[#0172ae] hover:bg-[#015d8e] text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
              >
                Get a Free Quote
              </a>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
