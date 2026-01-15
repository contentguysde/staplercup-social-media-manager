// Platform Types
export type Platform = 'instagram' | 'facebook' | 'tiktok';
export type InteractionType = 'comment' | 'dm' | 'mention' | 'like';
export type InteractionStatus = 'unread' | 'read' | 'replied';
export type AIProvider = 'claude' | 'openai';
export type Tone = 'professional' | 'friendly' | 'casual';

// Label/Category Types for filtering
export type Urgency = 'high' | 'medium' | 'low';
export type Language = 'de' | 'en' | 'other';
export type Topic =
  | 'participation_request'  // Anfrage Teilnahme
  | 'praise'                 // Lob
  | 'criticism'              // Kritik
  | 'question'               // Frage
  | 'sponsor_inquiry'        // Sponsoring-Anfrage
  | 'media_request'          // Medien-Anfrage
  | 'general'                // Allgemein
  | 'spam';                  // Spam

export interface InteractionLabels {
  urgency: Urgency;
  language: Language;
  channel: Platform;
  topic: Topic;
  confidence: number; // 0-1 confidence score
}

// Instagram Types
export interface InstagramUser {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
}

export interface InstagramMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  timestamp: string;
  permalink: string;
}

export interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  from: InstagramUser;
  media?: InstagramMedia;
  replies?: InstagramComment[];
  like_count?: number;
}

export interface InstagramMessage {
  id: string;
  message: string;
  from: InstagramUser;
  to: InstagramUser;
  timestamp: string;
}

export interface InstagramConversation {
  id: string;
  participants: InstagramUser[];
  messages: InstagramMessage[];
  updated_time: string;
}

// Unified Interaction Type
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

// AI Types
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

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination?: {
    hasMore: boolean;
    nextCursor?: string;
    total?: number;
  };
}
