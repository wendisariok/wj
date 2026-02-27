import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCollections,
  createCollection,
  getCollection,
  deleteCollection,
  removeEmailFromCollection,
  updateCollectionEmail,
  reorderCollectionEmails,
  exportCollectionDocx,
  exportCollectionPdf,
} from '../api/client';
import type { CollectionSummary, CollectionDetail, BookStyle } from '../types';
import BookPreview from '../components/BookPreview';
import BookBuilderWizard from '../components/BookBuilderWizard';

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

export default function Collections() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [bookStyle, setBookStyle] = useState<BookStyle>('memoir');
  const [showPreview, setShowPreview] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showWizard, setShowWizard] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const c = await getCollections();
      setCollections(c);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadDetail = async (id: number) => {
    setActiveId(id);
    setLoading(true);
    try {
      const d = await getCollection(id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const c = await createCollection(newName.trim());
      setNewName('');
      await refresh();
      loadDetail(c.id);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCollection(id);
      if (activeId === id) {
        setActiveId(null);
        setDetail(null);
        setShowPreview(false);
      }
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleRemoveEmail = async (entryId: number) => {
    if (!activeId) return;
    try {
      await removeEmailFromCollection(activeId, entryId);
      loadDetail(activeId);
      refresh();
    } catch {
      // ignore
    }
  };

  const handleSaveTitle = async (entryId: number) => {
    if (!activeId) return;
    try {
      await updateCollectionEmail(activeId, entryId, editTitle);
      setEditingEntry(null);
      loadDetail(activeId);
    } catch {
      // ignore
    }
  };

  const handleExportDocx = async () => {
    if (!activeId) return;
    setShowExportMenu(false);
    try {
      await exportCollectionDocx(activeId);
    } catch {
      // ignore
    }
  };

  const handleExportPdf = async () => {
    if (!activeId) return;
    setShowExportMenu(false);
    try {
      await exportCollectionPdf(activeId, bookStyle);
    } catch {
      // ignore
    }
  };

  // Drag-and-drop reorder
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || !detail || !activeId) return;

    const items = [...detail.emails];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(dropIdx, 0, moved);

    // Optimistic update
    setDetail({ ...detail, emails: items });
    setDragIdx(null);

    try {
      await reorderCollectionEmails(activeId, items.map((e) => e.id));
    } catch {
      loadDetail(activeId);
    }
  };

  const hasEmails = detail && detail.emails.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left panel — Collection list */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Collections
          </h2>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New collection name..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-md transition-colors"
            >
              Create
            </button>
          </div>

          {collections.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">
              No collections yet. Create one above.
            </div>
          ) : (
            <div className="space-y-1">
              {collections.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    activeId === c.id
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'hover:bg-gray-800 border border-transparent'
                  }`}
                  onClick={() => loadDetail(c.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-200 truncate">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.email_count} email(s)</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                    className="ml-2 text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete collection"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — Collection detail */}
      <div className="lg:col-span-2">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              {detail ? detail.name : 'Select a Collection'}
            </h2>
            {hasEmails && (
              <div className="flex items-center gap-2">
                {/* AI Book Builder */}
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                >
                  AI Book Builder
                </button>

                {/* Preview toggle */}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    showPreview
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {showPreview ? 'Hide Preview' : 'Preview'}
                </button>

                {/* Export dropdown */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors flex items-center gap-1"
                  >
                    Export
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                      <button
                        onClick={handleExportPdf}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-t-md"
                      >
                        Export PDF
                      </button>
                      <button
                        onClick={handleExportDocx}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors rounded-b-md"
                      >
                        Export Word (.docx)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : !detail ? (
            <div className="text-sm text-gray-500 py-12 text-center">
              Select a collection from the list to view its emails.
            </div>
          ) : detail.emails.length === 0 ? (
            <div className="text-sm text-gray-500 py-12 text-center">
              This collection is empty. Add emails from the email detail view.
            </div>
          ) : showPreview ? (
            /* Split view: chapter list (narrow) + preview (wide) */
            <div className="flex flex-1 min-h-0" style={{ height: '600px' }}>
              {/* Narrow chapter list */}
              <div className="w-64 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
                <div className="divide-y divide-gray-800">
                  {detail.emails.map((entry, idx) => (
                    <div
                      key={entry.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      className="px-3 py-2 hover:bg-gray-800/50 transition-colors cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-600 mt-0.5 select-none">{idx + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-300 truncate">
                            {entry.chapter_title || entry.subject || '(no subject)'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{entry.sender}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Preview iframe */}
              <div className="flex-1 min-w-0">
                <BookPreview
                  collectionId={activeId!}
                  bookStyle={bookStyle}
                  onStyleChange={setBookStyle}
                />
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {detail.emails.map((entry, idx) => (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className="px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-600 mt-1 select-none">{idx + 1}.</span>
                    <div className="min-w-0 flex-1">
                      {editingEntry === entry.id ? (
                        <div className="flex gap-2 mb-1">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(entry.id)}
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTitle(entry.id)}
                            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingEntry(null)}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 mb-0.5"
                          onClick={() => { setEditingEntry(entry.id); setEditTitle(entry.chapter_title); }}
                        >
                          {entry.chapter_title || '(click to set chapter title)'}
                        </div>
                      )}
                      <a
                        href={`/email/${entry.email_id}`}
                        className="text-sm font-medium text-gray-200 hover:text-white truncate block"
                      >
                        {entry.subject || '(no subject)'}
                      </a>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{entry.sender}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">{formatDate(entry.date)}</span>
                      <button
                        onClick={() => handleRemoveEmail(entry.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                        title="Remove from collection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showWizard && detail && activeId && (
        <BookBuilderWizard
          collectionId={activeId}
          collectionName={detail.name}
          emailCount={detail.emails.length}
          emails={detail.emails.map(e => ({ subject: e.subject, sender: e.sender }))}
          onClose={() => setShowWizard(false)}
          onComplete={() => {
            setShowWizard(false);
            loadDetail(activeId);
            refresh();
          }}
        />
      )}
    </div>
  );
}
