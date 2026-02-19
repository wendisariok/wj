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
} from '../api/client';
import type { CollectionSummary, CollectionDetail, CollectionEmailItem } from '../types';

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

  const handleExport = async () => {
    if (!activeId) return;
    try {
      await exportCollectionDocx(activeId);
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
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              {detail ? detail.name : 'Select a Collection'}
            </h2>
            {detail && detail.emails.length > 0 && (
              <button
                onClick={handleExport}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
              >
                Export as Book (.docx)
              </button>
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
    </div>
  );
}
