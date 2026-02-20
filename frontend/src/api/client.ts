import axios from 'axios';
import type {
  AuthStatus,
  AuthLoginResponse,
  SearchRequest,
  SearchResponse,
  SearchHistoryItem,
  EmailSummary,
  EmailDetail,
  CollectionSummary,
  CollectionDetail,
  CollectionEmailItem,
} from '../types';

const api = axios.create({
  baseURL: '/api',
});

export async function getAuthStatus(): Promise<AuthStatus> {
  const { data } = await api.get<AuthStatus>('/auth/status');
  return data;
}

export async function getAuthLoginUrl(): Promise<string> {
  const { data } = await api.get<AuthLoginResponse>('/auth/login');
  return data.auth_url;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function searchGmail(request: SearchRequest): Promise<SearchResponse> {
  const { data } = await api.post<SearchResponse>('/search/', request);
  return data;
}

export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
  const { data } = await api.get<SearchHistoryItem[]>('/search/history');
  return data;
}

export async function getSearchEmails(searchId: number): Promise<EmailSummary[]> {
  const { data } = await api.get<EmailSummary[]>(`/search/history/${searchId}/emails`);
  return data;
}

export async function getEmailDetail(emailId: number): Promise<EmailDetail> {
  const { data } = await api.get<EmailDetail>(`/emails/${emailId}`);
  return data;
}

export async function exportSearchDocx(searchId: number, groupBy: string = 'none'): Promise<void> {
  const { data } = await api.post('/export/docx', { search_id: searchId, group_by: groupBy }, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inboxforge-export.docx';
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportSingleEmailDocx(emailId: number): Promise<void> {
  const { data } = await api.post(`/export/docx/single/${emailId}`, {}, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'email-export.docx';
  a.click();
  window.URL.revokeObjectURL(url);
}

// Attachments API

export function getAttachmentDownloadUrl(attachmentId: number): string {
  return `/api/attachments/${attachmentId}/download`;
}

export async function getSearchAttachmentCount(searchId: number): Promise<number> {
  const { data } = await api.get<{ count: number }>(`/attachments/search/${searchId}/count`);
  return data.count;
}

export async function backfillAttachments(searchId?: number): Promise<{ total_emails: number; processed: number; attachments_downloaded: number; errors: number; status: string }> {
  const params = searchId ? { search_id: searchId, force: true } : {};
  const { data } = await api.post('/attachments/backfill', null, { params });
  return data;
}

// Collections API

export async function getCollections(): Promise<CollectionSummary[]> {
  const { data } = await api.get<CollectionSummary[]>('/collections/');
  return data;
}

export async function createCollection(name: string, description: string = ''): Promise<CollectionSummary> {
  const { data } = await api.post<CollectionSummary>('/collections/', { name, description });
  return data;
}

export async function getCollection(collectionId: number): Promise<CollectionDetail> {
  const { data } = await api.get<CollectionDetail>(`/collections/${collectionId}`);
  return data;
}

export async function updateCollection(collectionId: number, updates: { name?: string; description?: string }): Promise<CollectionSummary> {
  const { data } = await api.put<CollectionSummary>(`/collections/${collectionId}`, updates);
  return data;
}

export async function deleteCollection(collectionId: number): Promise<void> {
  await api.delete(`/collections/${collectionId}`);
}

export async function addEmailToCollection(collectionId: number, emailId: number, chapterTitle: string = ''): Promise<CollectionEmailItem> {
  const { data } = await api.post<CollectionEmailItem>(`/collections/${collectionId}/emails`, { email_id: emailId, chapter_title: chapterTitle });
  return data;
}

export async function removeEmailFromCollection(collectionId: number, entryId: number): Promise<void> {
  await api.delete(`/collections/${collectionId}/emails/${entryId}`);
}

export async function updateCollectionEmail(collectionId: number, entryId: number, chapterTitle: string): Promise<CollectionEmailItem> {
  const { data } = await api.put<CollectionEmailItem>(`/collections/${collectionId}/emails/${entryId}`, { chapter_title: chapterTitle });
  return data;
}

export async function reorderCollectionEmails(collectionId: number, entryIds: number[]): Promise<void> {
  await api.post(`/collections/${collectionId}/reorder`, { entry_ids: entryIds });
}

export async function exportCollectionDocx(collectionId: number): Promise<void> {
  const { data } = await api.post(`/collections/${collectionId}/export/docx`, {}, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'collection-export.docx';
  a.click();
  window.URL.revokeObjectURL(url);
}
