import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { EmailDetail as EmailDetailType } from '../types';
import { getAttachmentDownloadUrl } from '../api/client';

interface Props {
  email: EmailDetailType;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmailDetail({ email }: Props) {
  const [viewHtml, setViewHtml] = useState(!!email.body_html);
  const hasHtml = !!email.body_html;
  const hasText = !!email.body_text;

  const sanitizedHtml = email.body_html
    ? DOMPurify.sanitize(email.body_html, {
        ALLOWED_TAGS: [
          'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table',
          'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul', 'blockquote', 'hr',
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'target', 'width', 'height'],
      })
    : '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2 pb-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-white">
          {email.subject || '(no subject)'}
        </h1>
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm">
            <div className="text-gray-300">
              <span className="text-gray-500">From:</span> {email.sender}
            </div>
            {email.recipient && (
              <div className="text-gray-300">
                <span className="text-gray-500">To:</span> {email.recipient}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500 flex-shrink-0">
            {formatDate(email.date)}
          </div>
        </div>
        {email.labels && (
          <div className="flex flex-wrap gap-1">
            {email.labels.split(',').map((label) => (
              <span key={label} className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Attachments */}
      {email.attachments && email.attachments.length > 0 && (
        <div className="pb-4 border-b border-gray-800">
          <div className="text-xs text-gray-500 mb-2">
            Attachments ({email.attachments.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((att) => (
              <a
                key={att.id}
                href={getAttachmentDownloadUrl(att.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-sm text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="truncate max-w-[200px]">{att.filename}</span>
                {att.size != null && att.size > 0 && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    ({formatFileSize(att.size)})
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* View toggle */}
      {hasHtml && hasText && (
        <div className="flex gap-1 bg-gray-900 rounded-md p-0.5 w-fit">
          <button
            onClick={() => setViewHtml(true)}
            className={`px-3 py-1 text-xs rounded ${
              viewHtml ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            HTML
          </button>
          <button
            onClick={() => setViewHtml(false)}
            className={`px-3 py-1 text-xs rounded ${
              !viewHtml ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Plain Text
          </button>
        </div>
      )}

      {/* Body */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-auto max-h-[70vh]">
        {viewHtml && hasHtml ? (
          <div
            className="email-html-content"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        ) : hasText ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans">
            {email.body_text}
          </pre>
        ) : (
          <p className="text-gray-500 text-sm">No email body available.</p>
        )}
      </div>
    </div>
  );
}
