import { useState, useEffect, useCallback } from 'react';
import AuthStatus from '../components/AuthStatus';
import SearchForm from '../components/SearchForm';
import SearchHistory from '../components/SearchHistory';
import GroupByToolbar from '../components/GroupByToolbar';
import type { GroupByMode } from '../components/GroupByToolbar';
import GroupedEmailList from '../components/GroupedEmailList';
import { getSearchHistory, getSearchEmails, exportSearchDocx } from '../api/client';
import type { SearchHistoryItem, EmailSummary, SearchResponse } from '../types';

export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');

  const refreshHistory = useCallback(async () => {
    try {
      const h = await getSearchHistory();
      setHistory(h);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      refreshHistory();
    }
  }, [authenticated, refreshHistory]);

  const handleSearchComplete = async (result: SearchResponse) => {
    await refreshHistory();
    loadSearchEmails(result.search_id);
  };

  const loadSearchEmails = async (searchId: number) => {
    setActiveSearchId(searchId);
    setEmailsLoading(true);
    try {
      const e = await getSearchEmails(searchId);
      setEmails(e);
    } catch {
      setEmails([]);
    } finally {
      setEmailsLoading(false);
    }
  };

  const handleHistorySelect = (item: SearchHistoryItem) => {
    loadSearchEmails(item.id);
  };

  const handleExport = async () => {
    if (!activeSearchId) return;
    setExporting(true);
    try {
      await exportSearchDocx(activeSearchId, groupBy);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left panel — Search + History */}
      <div className="lg:col-span-1 space-y-6">
        <AuthStatus onAuthChange={setAuthenticated} />

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Search Gmail
          </h2>
          <SearchForm
            authenticated={authenticated}
            onSearchComplete={handleSearchComplete}
          />
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Search History
          </h2>
          <SearchHistory
            history={history}
            activeSearchId={activeSearchId}
            onSelect={handleHistorySelect}
          />
        </div>
      </div>

      {/* Right panel — Email results */}
      <div className="lg:col-span-2">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Emails
            </h2>
            {activeSearchId && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {emails.length} emails
                </span>
                {emails.length > 0 && (
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded transition-colors"
                  >
                    {exporting ? 'Exporting...' : 'Export .docx'}
                  </button>
                )}
              </div>
            )}
          </div>
          {emails.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-800">
              <GroupByToolbar value={groupBy} onChange={setGroupBy} />
            </div>
          )}
          {emailsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading emails...
            </div>
          ) : (
            <GroupedEmailList emails={emails} groupBy={groupBy} />
          )}
        </div>
      </div>
    </div>
  );
}
