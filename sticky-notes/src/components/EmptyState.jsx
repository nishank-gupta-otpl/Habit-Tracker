import { ArchiveIcon, NoteIcon, SearchIcon, TrashIcon } from './icons.jsx';

const COPY = {
  board: {
    Icon: NoteIcon,
    title: 'Nothing on the board',
    body: 'Tap the button below to stick your first note up.',
  },
  archive: { Icon: ArchiveIcon, title: 'Archive is empty', body: 'Notes you archive are kept here.' },
  trash: {
    Icon: TrashIcon,
    title: 'Bin is empty',
    body: 'Deleted notes wait here for 30 days before they go for good.',
  },
  search: { Icon: SearchIcon, title: 'No matches', body: 'Try a shorter search, or clear the label filter.' },
};

export default function EmptyState({ kind }) {
  const { Icon, title, body } = COPY[kind] ?? COPY.board;
  return (
    <div className="mt-24 flex flex-col items-center px-8 text-center">
      <Icon width={44} height={44} className="opacity-25" />
      <h2 className="mt-4 text-base font-bold">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-[var(--text-soft)]">{body}</p>
    </div>
  );
}
