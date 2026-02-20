export interface AuthStatus {
  authenticated: boolean;
  email?: string;
}

export interface AuthLoginResponse {
  auth_url: string;
}

export interface SearchRequest {
  keywords: string;
  senders?: string;
  subject_keywords?: string;
  filter_logic?: string;
  date_from?: string;
  date_to?: string;
  has_attachment?: boolean;
}

export interface SearchResponse {
  search_id: number;
  keywords: string;
  senders?: string;
  subject_keywords?: string;
  filter_logic?: string;
  date_from?: string;
  date_to?: string;
  results_count: number;
  new_emails_count: number;
  duplicate_count: number;
  status: string;
}

export interface EmailSummary {
  id: number;
  message_id: string;
  subject?: string;
  sender?: string;
  date?: string;
  snippet?: string;
  is_new?: boolean;
}

export interface AttachmentInfo {
  id: number;
  email_id: number;
  filename: string;
  mime_type?: string;
  size?: number;
  created_at?: string;
}

export interface EmailDetail {
  id: number;
  message_id: string;
  thread_id?: string;
  subject?: string;
  sender?: string;
  recipient?: string;
  date?: string;
  body_text?: string;
  body_html?: string;
  snippet?: string;
  labels?: string;
  created_at?: string;
  attachments: AttachmentInfo[];
}

export interface SearchHistoryItem {
  id: number;
  keywords: string;
  senders?: string;
  subject_keywords?: string;
  filter_logic?: string;
  date_from?: string;
  date_to?: string;
  results_count: number;
  new_emails_count: number;
  duplicate_count: number;
  status: string;
  error_message?: string;
  created_at?: string;
}

export interface CollectionSummary {
  id: number;
  name: string;
  description: string;
  email_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionEmailItem {
  id: number;
  email_id: number;
  sort_order: number;
  chapter_title: string;
  subject?: string;
  sender?: string;
  date?: string;
  snippet?: string;
}

export interface CollectionDetail {
  id: number;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  emails: CollectionEmailItem[];
}
