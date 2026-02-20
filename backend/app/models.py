from pydantic import BaseModel
from typing import Optional


class SearchRequest(BaseModel):
    keywords: str = ""
    senders: Optional[str] = None
    subject_keywords: Optional[str] = None
    filter_logic: str = "and"  # "and" or "or"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    has_attachment: bool = False


class SearchResponse(BaseModel):
    search_id: int
    keywords: str
    senders: Optional[str] = None
    subject_keywords: Optional[str] = None
    filter_logic: str = "and"
    date_from: Optional[str]
    date_to: Optional[str]
    results_count: int
    new_emails_count: int
    duplicate_count: int
    status: str


class EmailSummary(BaseModel):
    id: int
    message_id: str
    subject: Optional[str]
    sender: Optional[str]
    date: Optional[str]
    snippet: Optional[str]
    is_new: Optional[bool] = None


class AttachmentInfo(BaseModel):
    id: int
    email_id: int
    filename: str
    mime_type: Optional[str]
    size: Optional[int]
    created_at: Optional[str]


class EmailDetail(BaseModel):
    id: int
    message_id: str
    thread_id: Optional[str]
    subject: Optional[str]
    sender: Optional[str]
    recipient: Optional[str]
    date: Optional[str]
    body_text: Optional[str]
    body_html: Optional[str]
    snippet: Optional[str]
    labels: Optional[str]
    created_at: Optional[str]
    attachments: list[AttachmentInfo] = []


class BackfillResponse(BaseModel):
    total_emails: int
    processed: int
    attachments_downloaded: int
    errors: int
    status: str


class SearchHistoryItem(BaseModel):
    id: int
    keywords: str
    senders: Optional[str] = None
    subject_keywords: Optional[str] = None
    filter_logic: Optional[str] = "and"
    date_from: Optional[str]
    date_to: Optional[str]
    results_count: int
    new_emails_count: int
    duplicate_count: int
    status: str
    error_message: Optional[str]
    created_at: Optional[str]


class AuthStatus(BaseModel):
    authenticated: bool
    email: Optional[str] = None


class AuthLoginResponse(BaseModel):
    auth_url: str


# Collection models

class CollectionCreate(BaseModel):
    name: str
    description: str = ""


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CollectionSummary(BaseModel):
    id: int
    name: str
    description: str
    email_count: int
    created_at: Optional[str]
    updated_at: Optional[str]


class CollectionEmailItem(BaseModel):
    id: int
    email_id: int
    sort_order: int
    chapter_title: str
    subject: Optional[str]
    sender: Optional[str]
    date: Optional[str]
    snippet: Optional[str]


class CollectionDetail(BaseModel):
    id: int
    name: str
    description: str
    created_at: Optional[str]
    updated_at: Optional[str]
    emails: list[CollectionEmailItem]


class AddEmailToCollection(BaseModel):
    email_id: int
    chapter_title: str = ""


class ReorderCollectionEmails(BaseModel):
    entry_ids: list[int]


class UpdateCollectionEmail(BaseModel):
    chapter_title: str
