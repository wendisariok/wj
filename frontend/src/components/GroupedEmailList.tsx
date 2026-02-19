import { useState, useMemo } from 'react';
import type { EmailSummary } from '../types';
import type { GroupByMode } from './GroupByToolbar';

interface Props {
  emails: EmailSummary[];
  groupBy: GroupByMode;
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

function getMonthKey(dateStr?: string): string {
  if (!dateStr) return 'Unknown Date';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return 'Unknown Date';
  }
}

function normalizeSubject(subject?: string): string {
  if (!subject) return '(no subject)';
  return subject.replace(/^(Re:|Fwd?:|Fw:)\s*/gi, '').trim() || '(no subject)';
}

function groupEmails(emails: EmailSummary[], mode: GroupByMode): [string, EmailSummary[]][] {
  if (mode === 'none') return [['', emails]];

  const groups = new Map<string, EmailSummary[]>();

  for (const email of emails) {
    let key: string;
    switch (mode) {
      case 'sender':
        key = email.sender || 'Unknown Sender';
        break;
      case 'date':
        key = getMonthKey(email.date);
        break;
      case 'subject':
        key = normalizeSubject(email.subject);
        break;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(email);
  }

  const entries = Array.from(groups.entries());

  if (mode === 'sender' || mode === 'subject') {
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  } else if (mode === 'date') {
    // Reverse chronological — parse the month keys back to dates for sorting
    entries.sort((a, b) => {
      const da = new Date(a[0]);
      const db = new Date(b[0]);
      return db.getTime() - da.getTime();
    });
  }

  return entries;
}

function EmailRow({ email }: { email: EmailSummary }) {
  return (
    <a
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
  );
}

function GroupSection({ name, emails, defaultOpen }: { name: string; emails: EmailSummary[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-800/60 hover:bg-gray-800 transition-colors border-b border-gray-800"
      >
        <span className="text-sm font-medium text-gray-300">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{emails.length}</span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-gray-800">
          {emails.map((email) => (
            <EmailRow key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GroupedEmailList({ emails, groupBy }: Props) {
  const groups = useMemo(() => groupEmails(emails, groupBy), [emails, groupBy]);

  if (emails.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-12 text-center">
        Select a search from the history to view its emails.
      </div>
    );
  }

  if (groupBy === 'none') {
    return (
      <div className="divide-y divide-gray-800">
        {emails.map((email) => (
          <EmailRow key={email.id} email={email} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {groups.map(([name, groupEmails]) => (
        <GroupSection key={name} name={name} emails={groupEmails} defaultOpen={true} />
      ))}
    </div>
  );
}
