import { useState, useEffect, useCallback } from 'react';
import AuthStatus from '../components/AuthStatus';
import SearchForm from '../components/SearchForm';
import SearchHistory from '../components/SearchHistory';
import GroupByToolbar from '../components/GroupByToolbar';
import type { GroupByMode } from '../components/GroupByToolbar';
import GroupedEmailList from '../components/GroupedEmailList';
import { getSearchHistory, getSearchEmails, exportSearchDocx, backfillAttachments, getSearchAttachmentCount } from '../api/client';
import type { SearchHistoryItem, EmailSummary, SearchResponse } from '../types';

export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [showAttachmentPrompt, setShowAttachmentPrompt] = useState(false);
  const [pendingSearchId, setPendingSearchId] = useState<number | null>(null);
  const [attachmentCount, setAttachmentCount] = useState<number | null>(null);

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
    // Prompt user to download attachments
    setPendingSearchId(result.search_id);
    setShowAttachmentPrompt(true);
  };

  const handleAttachmentPromptYes = async () => {
    setShowAttachmentPrompt(false);
    if (pendingSearchId) {
      runBackfill(pendingSearchId);
    }
    setPendingSearchId(null);
  };

  const handleAttachmentPromptNo = () => {
    setShowAttachmentPrompt(false);
    setPendingSearchId(null);
  };

  const refreshAttachmentCount = async (searchId: number) => {
    try {
      const count = await getSearchAttachmentCount(searchId);
      setAttachmentCount(count);
    } catch {
      setAttachmentCount(null);
    }
  };

  const loadSearchEmails = async (searchId: number) => {
    setActiveSearchId(searchId);
    setEmailsLoading(true);
    setAttachmentCount(null);
    try {
      const e = await getSearchEmails(searchId);
      setEmails(e);
      refreshAttachmentCount(searchId);
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

  const runBackfill = async (searchId: number) => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const result = await backfillAttachments(searchId);
      if (result.attachments_downloaded > 0) {
        setBackfillResult(`Done — ${result.attachments_downloaded} attachments downloaded from ${result.processed} emails`);
      } else {
        setBackfillResult('No attachments found');
      }
    } catch {
      setBackfillResult('Backfill failed');
    } finally {
      setBackfilling(false);
      refreshAttachmentCount(searchId);
      setTimeout(() => setBackfillResult(null), 5000);
    }
  };

  const handleBackfill = async () => {
    if (activeSearchId) {
      runBackfill(activeSearchId);
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
            <div className="flex items-center gap-3">
              {activeSearchId && (
                <span className="text-xs text-gray-500">
                  {emails.length} emails{attachmentCount != null && attachmentCount > 0 ? ` · ${attachmentCount} attachments` : ''}
                </span>
              )}
              {activeSearchId && (
                <button
                  onClick={handleBackfill}
                  disabled={backfilling}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded transition-colors"
                >
                  {backfilling ? 'Downloading Attachments...' : 'Download Attachments'}
                </button>
              )}
              {backfillResult && (
                <span className="text-xs text-gray-400">{backfillResult}</span>
              )}
              {activeSearchId && emails.length > 0 && (
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded transition-colors"
                >
                  {exporting ? 'Exporting...' : 'Export .docx'}
                </button>
              )}
            </div>
          </div>

          {/* Attachment download prompt after search */}
          {showAttachmentPrompt && (
            <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/50 flex items-center justify-between">
              <span className="text-sm text-gray-300">Download attachments for this search?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAttachmentPromptYes}
                  className="px-3 py-1 text-xs bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
                >
                  Yes, download
                </button>
                <button
                  onClick={handleAttachmentPromptNo}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

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
