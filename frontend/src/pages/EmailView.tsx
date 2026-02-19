import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEmailDetail, exportSingleEmailDocx, getCollections, addEmailToCollection } from '../api/client';
import EmailDetail from '../components/EmailDetail';
import type { EmailDetail as EmailDetailType, CollectionSummary } from '../types';

export default function EmailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState<EmailDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [showCollections, setShowCollections] = useState(false);
  const [addedMsg, setAddedMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEmailDetail(parseInt(id))
      .then(setEmail)
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load email'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShowCollections = async () => {
    if (!showCollections) {
      try {
        const c = await getCollections();
        setCollections(c);
      } catch {
        // ignore
      }
    }
    setShowCollections(!showCollections);
  };

  const handleAddToCollection = async (collectionId: number) => {
    if (!email) return;
    try {
      await addEmailToCollection(collectionId, email.id);
      setAddedMsg('Added!');
      setShowCollections(false);
      setTimeout(() => setAddedMsg(''), 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail || '';
      if (detail.includes('already')) {
        setAddedMsg('Already in collection');
      } else {
        setAddedMsg('Failed to add');
      }
      setShowCollections(false);
      setTimeout(() => setAddedMsg(''), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error || 'Email not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleExport = async () => {
    if (!email) return;
    try {
      await exportSingleEmailDocx(email.id);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
        >
          Export .docx
        </button>
        <div className="relative">
          <button
            onClick={handleShowCollections}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Add to Collection
          </button>
          {showCollections && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-20">
              {collections.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">
                  No collections. Create one first.
                </div>
              ) : (
                collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleAddToCollection(c.id)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    {c.name} ({c.email_count})
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {addedMsg && (
          <span className="text-xs text-green-400">{addedMsg}</span>
        )}
      </div>
      <EmailDetail email={email} />
    </div>
  );
}
