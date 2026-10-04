const paths = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  events: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8m-8 4h8m-8 4h5" /></>,
  chart: <><path d="M4 3v17h17M8 16v-5m5 5V7m5 9V4" /></>,
  logout: <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m6-4 4-4-4-4m-6 4h10" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  location: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
  edit: <><path d="m14 5 5 5M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
  alert: <><path d="m10.3 4.4-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.6l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  inbox: <><path d="m4 5-2 9v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5l-2-9H4Z" /><path d="M2 14h6l2 3h4l2-3h6" /></>,
  loader: <><path d="M20 12a8 8 0 1 1-8-8" /><path d="M16 4h4v4" /></>,
  brand: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><path d="m14 17 3 3 5-6" /></>,
}

export default function Icon({ name, className = '' }) {
  return (
    <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
