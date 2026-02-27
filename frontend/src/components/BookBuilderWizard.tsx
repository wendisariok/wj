import { useState, useEffect } from 'react';
import { suggestBookTitle, suggestChapters, applyAIStructure } from '../api/client';
import type { ChapterAssignment } from '../types';

interface BookBuilderWizardProps {
  collectionId: number;
  collectionName: string;
  emailCount: number;
  emails: { subject?: string; sender?: string }[];
  onClose: () => void;
  onComplete: () => void;
}

export default function BookBuilderWizard({
  collectionId,
  collectionName,
  emailCount,
  emails,
  onClose,
  onComplete,
}: BookBuilderWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [editedTitle, setEditedTitle] = useState('');

  // Step 2 state
  const [chapterPreset, setChapterPreset] = useState<'small' | 'medium' | 'custom'>('small');
  const [customCount, setCustomCount] = useState('');

  // Step 3 state
  const [chapters, setChapters] = useState<ChapterAssignment[]>([]);

  // Step 4 state
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  const getChapterCount = (): number => {
    if (chapterPreset === 'small') return Math.min(3, emailCount);
    if (chapterPreset === 'medium') return Math.min(8, emailCount);
    return Math.min(parseInt(customCount) || 3, emailCount);
  };

  // Auto-fetch title on mount
  useEffect(() => {
    const fetchTitle = async () => {
      setLoading(true);
      setError(null);
      try {
        const title = await suggestBookTitle(collectionId);
        setSuggestedTitle(title);
        setEditedTitle(title);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to suggest title';
        setError(msg);
        setEditedTitle(collectionName);
      } finally {
        setLoading(false);
      }
    };
    fetchTitle();
  }, [collectionId, collectionName]);

  const handleNextToChapters = async () => {
    setStep(3);
    setLoading(true);
    setError(null);
    try {
      const result = await suggestChapters(collectionId, editedTitle, getChapterCount());
      setChapters(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to suggest chapters';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      await applyAIStructure(collectionId, editedTitle, chapters);
      setDone(true);
      setTimeout(() => onComplete(), 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to apply structure';
      setError(msg);
      setApplying(false);
    }
  };

  const updateChapterTitle = (idx: number, title: string) => {
    setChapters(prev => prev.map((ch, i) => i === idx ? { ...ch, chapter_title: title } : ch));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">AI Book Builder</h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step} of 4</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">&times;</button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Step 1: Title */}
          {step === 1 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Book Title
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing {emailCount} emails...
                </div>
              ) : (
                <>
                  {suggestedTitle && (
                    <p className="text-xs text-gray-500 mb-2">AI suggested:</p>
                  )}
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    className="w-full px-4 py-3 text-lg bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-purple-500"
                    placeholder="Enter book title..."
                  />
                </>
              )}
            </div>
          )}

          {/* Step 2: Chapter Count */}
          {step === 2 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                How Many Chapters?
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Your collection has {emailCount} emails. How would you like them organized?
              </p>
              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${chapterPreset === 'small' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                  <input
                    type="radio"
                    name="chapterCount"
                    checked={chapterPreset === 'small'}
                    onChange={() => setChapterPreset('small')}
                    className="accent-purple-500"
                  />
                  <div>
                    <div className="text-sm text-gray-200">1-5 chapters</div>
                    <div className="text-xs text-gray-500">Broad themes, fewer divisions</div>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${chapterPreset === 'medium' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                  <input
                    type="radio"
                    name="chapterCount"
                    checked={chapterPreset === 'medium'}
                    onChange={() => setChapterPreset('medium')}
                    className="accent-purple-500"
                  />
                  <div>
                    <div className="text-sm text-gray-200">6-10 chapters</div>
                    <div className="text-xs text-gray-500">More detailed organization</div>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${chapterPreset === 'custom' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 hover:border-gray-600'}`}>
                  <input
                    type="radio"
                    name="chapterCount"
                    checked={chapterPreset === 'custom'}
                    onChange={() => setChapterPreset('custom')}
                    className="accent-purple-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-200">Custom:</span>
                    <input
                      type="number"
                      min="1"
                      max={emailCount}
                      value={customCount}
                      onChange={e => { setCustomCount(e.target.value); setChapterPreset('custom'); }}
                      className="w-16 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200"
                      placeholder="#"
                    />
                    <span className="text-xs text-gray-500">chapters</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Chapter Structure */}
          {step === 3 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Review Chapter Structure
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Organizing emails into chapters...
                </div>
              ) : (
                <div className="space-y-4">
                  {chapters.map((ch, idx) => (
                    <div key={idx} className="border border-gray-700 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500 font-mono">Ch. {idx + 1}</span>
                        <input
                          type="text"
                          value={ch.chapter_title}
                          onChange={e => updateChapterTitle(idx, e.target.value)}
                          className="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="pl-6 space-y-1">
                        {ch.email_indices.map(emailIdx => {
                          const email = emails[emailIdx];
                          return (
                            <div key={emailIdx} className="text-xs text-gray-500 truncate">
                              {email?.subject || '(no subject)'} — {email?.sender || 'Unknown'}
                            </div>
                          );
                        })}
                      </div>
                      <div className="pl-6 mt-1">
                        <span className="text-xs text-gray-600">{ch.email_indices.length} email{ch.email_indices.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Build */}
          {step === 4 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Build Your Book
              </h3>
              {done ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-3">&#10003;</div>
                  <p className="text-gray-200 text-lg">Book structure applied!</p>
                  <p className="text-gray-500 text-sm mt-1">Your collection has been organized.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Title</div>
                    <div className="text-gray-200 font-medium">{editedTitle}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Chapters</div>
                      <div className="text-gray-200">{chapters.length}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Emails</div>
                      <div className="text-gray-200">{emailCount}</div>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">Chapters</div>
                    <ol className="list-decimal list-inside space-y-1">
                      {chapters.map((ch, idx) => (
                        <li key={idx} className="text-sm text-gray-300">
                          {ch.chapter_title} <span className="text-gray-600">({ch.email_indices.length})</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {!done && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
            <button
              onClick={step === 1 ? onClose : () => setStep(step - 1)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              disabled={loading || applying}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={loading || !editedTitle.trim()}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Next
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleNextToChapters}
                disabled={chapterPreset === 'custom' && (!customCount || parseInt(customCount) < 1)}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Generate Chapters
              </button>
            )}

            {step === 3 && (
              <button
                onClick={() => setStep(4)}
                disabled={loading || chapters.length === 0}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Next
              </button>
            )}

            {step === 4 && (
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {applying ? 'Applying...' : 'Build Book'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
