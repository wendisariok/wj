import type { EmailSummary } from '../types';

interface Props {
  emails: EmailSummary[];
  loading: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function EmailList({ emails, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading emails...
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-12 text-center">
        Select a search from the history to view its emails.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {emails.map((email) => (
        <a
          key={email.id}
          href={`/email/${email.id}`}
          className="block px-4 py-3 hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {email.is_new && (
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
                <span className="text-sm font-medium text-gray-200 truncate">
                  {email.subject || '(no subject)'}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5 truncate">
                {email.sender}
              </div>
              {email.snippet && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {email.snippet}
                </div>
              )}
            </div>
            <span className="flex-shrink-0 text-xs text-gray-500">
              {formatDate(email.date)}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
