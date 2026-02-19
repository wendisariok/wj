import { useState } from 'react';
import { searchGmail } from '../api/client';
import type { SearchResponse } from '../types';

interface Props {
  authenticated: boolean;
  onSearchComplete: (result: SearchResponse) => void;
}

export default function SearchForm({ authenticated, onSearchComplete }: Props) {
  const [senders, setSenders] = useState('');
  const [subjectKeywords, setSubjectKeywords] = useState('');
  const [keywords, setKeywords] = useState('');
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasFilter = senders.trim() || subjectKeywords.trim() || keywords.trim();
  const filledFilterCount = [senders.trim(), subjectKeywords.trim(), keywords.trim()].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasFilter) return;

    setLoading(true);
    setError('');
    try {
      const result = await searchGmail({
        keywords: keywords.trim(),
        senders: senders.trim() || undefined,
        subject_keywords: subjectKeywords.trim() || undefined,
        filter_logic: filterLogic,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      onSearchComplete(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Sender(s)</label>
        <input
          type="text"
          value={senders}
          onChange={(e) => setSenders(e.target.value)}
          placeholder="e.g. alice@example.com, bob@example.com"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={!authenticated || loading}
        />
        <p className="text-xs text-gray-500 mt-0.5">Comma-separated email addresses</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Subject Keywords</label>
        <input
          type="text"
          value={subjectKeywords}
          onChange={(e) => setSubjectKeywords(e.target.value)}
          placeholder="e.g. invoice report"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={!authenticated || loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Body / General Keywords</label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g. crypto defi newsletter"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={!authenticated || loading}
        />
      </div>

      {filledFilterCount >= 2 && (
        <div className="flex items-center gap-3 py-1">
          <span className="text-xs text-gray-400">Combine filters:</span>
          <button
            type="button"
            onClick={() => setFilterLogic('and')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              filterLogic === 'and'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Match ALL (AND)
          </button>
          <button
            type="button"
            onClick={() => setFilterLogic('or')}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              filterLogic === 'or'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Match ANY (OR)
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
            disabled={!authenticated || loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
            disabled={!authenticated || loading}
          />
        </div>
      </div>

      {error && (
        <div className="p-2 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!authenticated || loading || !hasFilter}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Searching Gmail...
          </>
        ) : (
          'Search Gmail'
        )}
      </button>
    </form>
  );
}
