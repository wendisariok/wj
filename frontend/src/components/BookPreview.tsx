import { useState, useEffect } from 'react';
import { getCollectionPreviewHtml } from '../api/client';
import type { BookStyle } from '../types';

const STYLES: { value: BookStyle; label: string }[] = [
  { value: 'memoir', label: 'Memoir' },
  { value: 'reference', label: 'Reference' },
  { value: 'correspondence', label: 'Correspondence' },
];

interface BookPreviewProps {
  collectionId: number;
  bookStyle: BookStyle;
  onStyleChange: (style: BookStyle) => void;
}

export default function BookPreview({ collectionId, bookStyle, onStyleChange }: BookPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCollectionPreviewHtml(collectionId, bookStyle)
      .then((data) => {
        if (!cancelled) setHtml(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || 'Failed to load preview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [collectionId, bookStyle]);

  return (
    <div className="flex flex-col h-full">
      {/* Style selector pills */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-800 bg-gray-900/30">
        <span className="text-xs text-gray-500 mr-2 self-center">Style:</span>
        {STYLES.map((s) => (
          <button
            key={s.value}
            onClick={() => onStyleChange(s.value)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              bookStyle === s.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Preview area */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading preview...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400 text-sm">
            {error}
          </div>
        ) : html ? (
          <iframe
            srcDoc={html}
            sandbox="allow-same-origin"
            className="w-full h-full border-0 bg-white rounded-b-lg"
            title="Book Preview"
          />
        ) : null}
      </div>
    </div>
  );
}
