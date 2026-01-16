export type Platform = 'instagram' | 'facebook' | 'tiktok';
export type InteractionType = 'comment' | 'dm' | 'mention' | 'like';
export type InteractionStatus = 'unread' | 'read' | 'replied';
export type AIProvider = 'claude' | 'openai';
export type Tone = 'professional' | 'friendly' | 'casual';

// Label/Category Types for filtering
export type Urgency = 'high' | 'medium' | 'low';
export type Language = 'de' | 'en' | 'other';
export type Topic =
  | 'participation_request'
  | 'praise'
  | 'criticism'
  | 'question'
  | 'sponsor_inquiry'
  | 'media_request'
  | 'general'
  | 'spam';

export interface InteractionLabels {
  urgency: Urgency;
  language: Language;
  channel: Platform;
  topic: Topic;
  confidence: number;
}

export interface Interaction {
  id: string;
  platform: Platform;
  type: InteractionType;
  status: InteractionStatus;
  timestamp: string;
  from: {
    id: string;
    username: string;
    name?: string;
    profilePicture?: string;
  };
  content: string;
  context?: {
    mediaId?: string;
    mediaUrl?: string;
    mediaCaption?: string;
    mediaPermalink?: string;
    conversationId?: string;
    commentId?: string;
  };
  replies?: Array<{
    id: string;
    content: string;
    timestamp: string;
    isOwn: boolean;
  }>;
  labels?: InteractionLabels;
}

export interface SuggestionRequest {
  context: {
    platform: Platform;
    interactionType: InteractionType;
    originalMessage: string;
    conversationHistory?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    postContext?: string;
  };
  provider: AIProvider;
  tone?: Tone;
}

export interface SuggestionResponse {
  suggestions: string[];
  provider: AIProvider;
  generatedAt: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Interaction metadata for read/archive/assignment status
export interface InteractionMetadata {
  id: number;
  interaction_id: string;
  is_read: number;
  is_archived: number;
  assigned_to: number | null;
  read_at: string | null;
  archived_at: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
}

// Assignment info with user details
export interface AssignmentInfo {
  interaction_id: string;
  assigned_to: number;
  assigned_at: string;
  user_name: string;
  user_email: string;
}

// User for assignment dropdown
export interface AssignableUser {
  id: number;
  email: string;
  name: string;
  role: string;
}
