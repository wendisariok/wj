import { useState, useEffect, useCallback } from 'react';
import AuthStatus from '../components/AuthStatus';
import SearchForm from '../components/SearchForm';
import SearchHistory from '../components/SearchHistory';
import GroupByToolbar from '../components/GroupByToolbar';
import type { GroupByMode } from '../components/GroupByToolbar';
import GroupedEmailList from '../components/GroupedEmailList';
import { getSearchHistory, getSearchEmails, exportSearchDocx, backfillAttachments, getSearchAttachmentCount, getCollections, createCollection, bulkAddEmailsToCollection } from '../api/client';
import type { SearchHistoryItem, EmailSummary, SearchResponse, CollectionSummary } from '../types';

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
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [collectionResult, setCollectionResult] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');

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

  const handleAddToCollectionClick = async () => {
    try {
      const cols = await getCollections();
      setCollections(cols);
    } catch {
      setCollections([]);
    }
    setNewCollectionName('');
    setShowCollectionPicker(true);
  };

  const handleSelectCollection = async (collectionId: number) => {
    setAddingToCollection(true);
    try {
      const emailIds = emails.map(e => e.id);
      const result = await bulkAddEmailsToCollection(collectionId, emailIds);
      setCollectionResult(`Added ${result.added} email${result.added !== 1 ? 's' : ''}${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`);
    } catch {
      setCollectionResult('Failed to add emails');
    } finally {
      setAddingToCollection(false);
      setShowCollectionPicker(false);
      setTimeout(() => setCollectionResult(null), 5000);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newCollectionName.trim()) return;
    setAddingToCollection(true);
    try {
      const col = await createCollection(newCollectionName.trim());
      const emailIds = emails.map(e => e.id);
      const result = await bulkAddEmailsToCollection(col.id, emailIds);
      setCollectionResult(`Created "${col.name}" — added ${result.added} email${result.added !== 1 ? 's' : ''}`);
    } catch {
      setCollectionResult('Failed to create collection');
    } finally {
      setAddingToCollection(false);
      setShowCollectionPicker(false);
      setNewCollectionName('');
      setTimeout(() => setCollectionResult(null), 5000);
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
                <div className="relative">
                  <button
                    onClick={handleAddToCollectionClick}
                    disabled={addingToCollection}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded transition-colors"
                  >
                    {addingToCollection ? 'Adding...' : 'Add to Collection'}
                  </button>
                  {showCollectionPicker && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                      <div className="p-2 border-b border-gray-700">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newCollectionName}
                            onChange={e => setNewCollectionName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
                            placeholder="New collection name..."
                            className="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500"
                          />
                          <button
                            onClick={handleCreateAndAdd}
                            disabled={!newCollectionName.trim()}
                            className="px-2 py-1 text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded transition-colors"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {collections.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500">No existing collections</div>
                        ) : (
                          collections.map(col => (
                            <button
                              key={col.id}
                              onClick={() => handleSelectCollection(col.id)}
                              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                            >
                              <div className="font-medium">{col.name}</div>
                              <div className="text-gray-500">{col.email_count} emails</div>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="p-1 border-t border-gray-700">
                        <button
                          onClick={() => setShowCollectionPicker(false)}
                          className="w-full px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {collectionResult && (
                <span className="text-xs text-gray-400">{collectionResult}</span>
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
