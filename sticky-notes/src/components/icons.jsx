// Inline icons. A dozen 24px glyphs is a few hundred bytes here versus a
// icon-font or package download on a phone that may be on 3G.
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const Icon = ({ children, ...props }) => (
  <svg {...base} {...props}>
    {children}
  </svg>
);

export const PlusIcon = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ListIcon = (p) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);

export const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const PinIcon = ({ filled = false, ...p }) => (
  <Icon {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M9 4h6l-1 6 3 3H7l3-3-1-6Z" />
    <path d="M12 13v7" fill="none" />
  </Icon>
);

export const ArchiveIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4" />
  </Icon>
);

export const TrashIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </Icon>
);

export const RestoreIcon = (p) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v4h4" />
  </Icon>
);

export const PaletteIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.6-1-2.6 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5Z" />
    <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);

export const TagIcon = (p) => (
  <Icon {...p}>
    <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
    <circle cx="7.5" cy="7.5" r="1.3" />
  </Icon>
);

export const CloseIcon = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const MoreIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const SunIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = (p) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Icon>
);

export const NoteIcon = (p) => (
  <Icon {...p}>
    <path d="M5 4h14v10l-5 6H7a2 2 0 0 1-2-2V4Z" />
    <path d="M19 14h-3a2 2 0 0 0-2 2v4" />
  </Icon>
);

export const GripIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const DownloadIcon = (p) => (
  <Icon {...p}>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />
  </Icon>
);

export const UploadIcon = (p) => (
  <Icon {...p}>
    <path d="M12 20V9m0 0 4 4M12 9l-4 4M4 5h16" />
  </Icon>
);
