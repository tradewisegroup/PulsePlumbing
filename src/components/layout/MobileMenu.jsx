import { useState } from 'react';

const NAV = [
  { label: 'Home', href: '/' },
  {
    label: 'Services',
    children: [
      { label: 'Maintenance Plumbing', href: '/services/maintenance-plumbing', icon: '🔧' },
      { label: 'Commercial',           href: '/services/commercial',           icon: '🏢' },
      { label: 'Residential',          href: '/services/residential',          icon: '🏠' },
      { label: 'Gas Fitting',          href: '/services/gas-fitting',          icon: '⛽' },
      { label: 'Blocked Drains',       href: '/services/blocked-drains',       icon: '🚿' },
      { label: 'Hot Water',            href: '/services/hot-water-systems',    icon: '🔥' },
      { label: 'CCTV Drain Camera',    href: '/services/drain-camera',         icon: '📹' },
      { label: 'Backflow Prevention',  href: '/services/backflow-prevention',  icon: '🔄' },
    ],
  },
  {
    label: 'Industries',
    children: [
      { label: 'Retail',                href: '/industries/retail',                icon: '🛒' },
      { label: 'Childcare',             href: '/industries/childcare',             icon: '👶' },
      { label: 'Education',             href: '/industries/education',             icon: '🎓' },
      { label: 'Aged Care',             href: '/industries/aged-care',             icon: '❤️' },
      { label: 'Student Accommodation', href: '/industries/student-accommodation', icon: '🏘️' },
      { label: 'Commercial Real Estate',href: '/industries/commercial-real-estate',icon: '🏗️' },
      { label: 'Property Management',   href: '/industries/property-management',   icon: '🔑' },
      { label: 'New Builds',            href: '/industries/new-builds',            icon: '🏗️' },
    ],
  },
  { label: 'Civil',    href: '/civil' },
  { label: 'About',   href: '/about' },
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
        className="lg:hidden p-2 -mr-1 text-slate-600 hover:text-[#046bd2] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#046bd2]"
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
                className="p-2 text-slate-400 hover:text-slate-900 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#046bd2]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Emergency banner — always visible */}
            <a
              href="tel:0452188420"
              className="flex items-center justify-between gap-3 bg-red-600 hover:bg-red-700 px-5 py-3 transition-colors"
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
                        className="flex items-center px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-[#046bd2] hover:bg-[#F0F5FA] rounded-lg transition-colors"
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
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-[#046bd2] hover:bg-[#F0F5FA] rounded-lg transition-colors"
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
                      <ul className="mt-1 ml-3 pl-3 border-l-2 border-[#046bd2]/20 space-y-0.5">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <a
                              href={child.href}
                              onClick={() => setIsOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:text-[#046bd2] hover:bg-[#F0F5FA] rounded-lg transition-colors"
                            >
                              <span className="text-base leading-none">{child.icon}</span>
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
                className="flex items-center justify-center w-full bg-[#046bd2] hover:bg-[#045cb4] text-white text-sm font-semibold px-6 py-3 rounded-full transition-colors"
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
