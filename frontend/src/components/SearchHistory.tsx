import type { SearchHistoryItem } from '../types';

interface Props {
  history: SearchHistoryItem[];
  activeSearchId: number | null;
  onSelect: (item: SearchHistoryItem) => void;
}

export default function SearchHistory({ history, activeSearchId, onSelect }: Props) {
  if (history.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        No searches yet. Run a search above to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {history.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
            activeSearchId === item.id
              ? 'bg-blue-600/20 border border-blue-500/30'
              : 'hover:bg-gray-800 border border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-200 truncate">
              {[
                item.senders && `from: ${item.senders}`,
                item.subject_keywords && `subj: ${item.subject_keywords}`,
                item.keywords && item.keywords,
              ].filter(Boolean).join(' | ') || '(no filters)'}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              item.status === 'completed'
                ? 'bg-green-900/40 text-green-400'
                : item.status === 'error'
                ? 'bg-red-900/40 text-red-400'
                : 'bg-yellow-900/40 text-yellow-400'
            }`}>
              {item.results_count} found
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {item.date_from && <span>from {item.date_from}</span>}
            {item.date_to && <span>to {item.date_to}</span>}
            {!item.date_from && !item.date_to && <span>all time</span>}
            {item.filter_logic === 'or' && (
              <span className="px-1 py-0.5 bg-purple-900/40 text-purple-400 rounded text-[10px]">OR</span>
            )}
            <span className="ml-auto">
              {item.new_emails_count} new, {item.duplicate_count} dupes
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
