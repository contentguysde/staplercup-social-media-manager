import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env.js';
import type {
  InstagramComment,
  InstagramConversation,
  InstagramMedia,
  Interaction,
} from '../types/index.js';

// Mock data for development/demo
const MOCK_INTERACTIONS: Interaction[] = [
  {
    id: 'comment_1',
    platform: 'instagram',
    type: 'comment',
    status: 'unread',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    from: { id: 'user_1', username: 'gabelstapler_profi' },
    content: 'Mega Event! Wann ist der nächste StaplerCup? 🏆',
    context: {
      mediaId: 'media_1',
      mediaUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
      mediaCaption: 'StaplerCup 2024 - Was für ein Finale! 🔥\n\n#staplercup #forklift #championship',
      mediaPermalink: 'https://www.instagram.com/p/example1/',
      commentId: 'comment_1',
    },
  },
  {
    id: 'comment_2',
    platform: 'instagram',
    type: 'comment',
    status: 'unread',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    from: { id: 'user_2', username: 'logistik_queen' },
    content: 'Ich war dabei und es war unglaublich! Die Atmosphäre war der Wahnsinn 💪',
    context: {
      mediaId: 'media_1',
      mediaUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
      mediaCaption: 'StaplerCup 2024 - Was für ein Finale! 🔥\n\n#staplercup #forklift #championship',
      mediaPermalink: 'https://www.instagram.com/p/example1/',
      commentId: 'comment_2',
    },
    replies: [
      {
        id: 'reply_1',
        content: 'Danke für deinen Support! 🙌',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        isOwn: true,
      },
    ],
  },
  {
    id: 'comment_3',
    platform: 'instagram',
    type: 'comment',
    status: 'unread',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    from: { id: 'user_3', username: 'warehouse_worker_mike' },
    content: 'Kann man sich noch für 2025 anmelden?',
    context: {
      mediaId: 'media_2',
      mediaUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400',
      mediaCaption: 'Anmeldung für StaplerCup 2025 startet bald! 📅\n\nSeid ihr bereit? Markiert eure Kollegen, die dabei sein sollten!\n\n#staplercup2025 #anmeldung',
      mediaPermalink: 'https://www.instagram.com/p/example2/',
      commentId: 'comment_3',
    },
  },
  {
    id: 'dm_1',
    platform: 'instagram',
    type: 'dm',
    status: 'unread',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    from: { id: 'user_4', username: 'firma_schmidt_logistik' },
    content: 'Hallo! Wir würden gerne als Sponsor beim nächsten Event dabei sein. An wen können wir uns wenden?',
    context: { conversationId: 'conv_1' },
  },
  {
    id: 'dm_2',
    platform: 'instagram',
    type: 'dm',
    status: 'read',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    from: { id: 'user_5', username: 'stapler_fan_2000' },
    content: 'Gibt es Videos vom letzten Event?',
    context: { conversationId: 'conv_2' },
    replies: [
      {
        id: 'reply_2',
        content: 'Ja, auf unserem YouTube Kanal findest du alle Highlights!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
        isOwn: true,
      },
    ],
  },
  {
    id: 'mention_1',
    platform: 'instagram',
    type: 'mention',
    status: 'unread',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    from: { id: 'user_6', username: 'best_forklift_driver' },
    content: 'Training für den @staplercup läuft! Dieses Jahr hole ich den Pokal 🏆💪',
    context: {
      mediaId: 'media_ext_1',
      mediaUrl: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400',
      mediaPermalink: 'https://www.instagram.com/p/example3/',
    },
  },
];

export interface ConnectionStatus {
  connected: boolean;
  usingMockData: boolean;
  error?: string;
  errorType?: 'token_expired' | 'token_invalid' | 'network_error' | 'unknown';
  tokenExpiresAt?: string;
}

export interface TokenInfo {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

class InstagramService {
  private client: AxiosInstance;
  private instagramClient: AxiosInstance;
  private accountId: string;
  private useMockData: boolean;
  private lastError: ConnectionStatus | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor() {
    this.accountId = config.meta.instagramAccountId;
    this.useMockData = !config.meta.accessToken || config.meta.accessToken === 'your_long_lived_access_token';

    // Facebook Graph API client (for Business API features like comments)
    this.client = axios.create({
      baseURL: `${config.meta.graphApiBaseUrl}/${config.meta.graphApiVersion}`,
      params: {
        access_token: config.meta.accessToken,
      },
    });

    // Instagram Basic Display API client (for reading own media)
    this.instagramClient = axios.create({
      baseURL: config.meta.instagramApiBaseUrl,
      params: {
        access_token: config.meta.accessToken,
      },
    });

    if (this.useMockData) {
      console.log('📋 Using mock data (no Meta API credentials configured)');
    } else {
      console.log('📸 Instagram API connected');
    }
  }

  // Parse Facebook API error to determine error type
  private parseApiError(error: any): ConnectionStatus {
    const errorResponse = error?.response;
    const wwwAuth = errorResponse?.headers?.['www-authenticate'] || '';
    const errorData = errorResponse?.data?.error;

    let errorType: ConnectionStatus['errorType'] = 'unknown';
    let errorMessage = 'Unbekannter Fehler';

    if (wwwAuth.includes('Session has expired') || wwwAuth.includes('invalid_token')) {
      errorType = 'token_expired';
      // Extract expiration time from the error message
      const match = wwwAuth.match(/expired on ([^.]+)/);
      errorMessage = match
        ? `Access Token ist abgelaufen (${match[1]}). Bitte in den Einstellungen einen neuen Token eingeben.`
        : 'Access Token ist abgelaufen. Bitte in den Einstellungen einen neuen Token eingeben.';
    } else if (errorData?.code === 190 || errorData?.type === 'OAuthException') {
      errorType = 'token_invalid';
      errorMessage = errorData?.message || 'Access Token ist ungültig. Bitte prüfe die Einstellungen.';
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT') {
      errorType = 'network_error';
      errorMessage = 'Netzwerkfehler. Bitte prüfe deine Internetverbindung.';
    } else if (errorData?.message) {
      errorMessage = errorData.message;
    }

    return {
      connected: false,
      usingMockData: true,
      error: errorMessage,
      errorType,
    };
  }

  // Get current connection status
  getConnectionStatus(): ConnectionStatus {
    if (this.useMockData && !this.lastError) {
      return {
        connected: false,
        usingMockData: true,
        error: 'Keine API-Zugangsdaten konfiguriert. Verwende Demo-Daten.',
        errorType: 'token_invalid',
      };
    }
    const status = this.lastError || { connected: true, usingMockData: false };
    if (this.tokenExpiresAt) {
      status.tokenExpiresAt = this.tokenExpiresAt.toISOString();
    }
    return status;
  }

  // Exchange short-lived token for long-lived token (60 days)
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<TokenInfo> {
    const response = await axios.get(
      `${config.meta.graphApiBaseUrl}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      }
    );

    const { access_token, expires_in, token_type } = response.data;

    // Calculate expiration date
    this.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    return {
      accessToken: access_token,
      expiresIn: expires_in,
      tokenType: token_type || 'bearer',
    };
  }

  // Refresh an existing long-lived token
  async refreshLongLivedToken(currentToken: string): Promise<TokenInfo> {
    const response = await axios.get(
      `${config.meta.graphApiBaseUrl}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          fb_exchange_token: currentToken,
        },
      }
    );

    const { access_token, expires_in, token_type } = response.data;

    // Calculate expiration date
    this.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    return {
      accessToken: access_token,
      expiresIn: expires_in,
      tokenType: token_type || 'bearer',
    };
  }

  // Debug token to get expiration info
  async getTokenInfo(token: string): Promise<{ expiresAt: Date | null; isValid: boolean; scopes: string[] }> {
    try {
      const response = await axios.get(
        `${config.meta.graphApiBaseUrl}/debug_token`,
        {
          params: {
            input_token: token,
            access_token: `${config.meta.appId}|${config.meta.appSecret}`,
          },
        }
      );

      const data = response.data.data;
      const expiresAt = data.expires_at ? new Date(data.expires_at * 1000) : null;

      if (expiresAt) {
        this.tokenExpiresAt = expiresAt;
      }

      return {
        expiresAt,
        isValid: data.is_valid,
        scopes: data.scopes || [],
      };
    } catch {
      return { expiresAt: null, isValid: false, scopes: [] };
    }
  }

  // Update the access token (used after refreshing)
  updateAccessToken(newToken: string): void {
    this.client.defaults.params.access_token = newToken;
    this.instagramClient.defaults.params.access_token = newToken;
    this.useMockData = false;
    this.lastError = null;
    console.log('🔄 Access token updated');
  }

  // Get all media posts from the Instagram account using Facebook Graph API (Business)
  async getMedia(limit = 25): Promise<InstagramMedia[]> {
    const response = await this.client.get(`/${this.accountId}/media`, {
      params: {
        fields: 'id,media_type,media_url,thumbnail_url,caption,timestamp,permalink,comments_count',
        limit,
      },
    });
    return response.data.data || [];
  }

  // Get comments for a specific media post
  async getMediaComments(mediaId: string): Promise<InstagramComment[]> {
    const response = await this.client.get(`/${mediaId}/comments`, {
      params: {
        fields: 'id,text,timestamp,from,like_count',
      },
    });
    return response.data.data || [];
  }

  // Get all comments across all recent media
  async getAllComments(mediaLimit = 10): Promise<Interaction[]> {
    const mediaList = await this.getMedia(mediaLimit);
    const interactions: Interaction[] = [];

    for (const media of mediaList) {
      try {
        const comments = await this.getMediaComments(media.id);

        for (const comment of comments) {
          // Handle different API response formats
          const fromData = comment.from || {};
          interactions.push({
            id: comment.id,
            platform: 'instagram',
            type: 'comment',
            status: 'unread',
            timestamp: comment.timestamp,
            from: {
              id: fromData.id || 'unknown',
              username: fromData.username || 'Instagram User',
            },
            content: comment.text,
            context: {
              mediaId: media.id,
              mediaUrl: media.media_url || media.thumbnail_url,
              mediaCaption: media.caption,
              mediaPermalink: media.permalink,
              commentId: comment.id,
            },
          });
        }
      } catch (e) {
        // Skip media that fails to fetch comments
        console.log(`Could not fetch comments for media ${media.id}`);
      }
    }

    return interactions.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Reply to a comment
  async replyToComment(commentId: string, message: string): Promise<{ id: string }> {
    const response = await this.client.post(`/${commentId}/replies`, {
      message,
    });
    return response.data;
  }

  // Like a comment
  async likeComment(commentId: string): Promise<{ success: boolean }> {
    if (this.useMockData) {
      console.log(`Mock: Liked comment ${commentId}`);
      return { success: true };
    }

    try {
      // Instagram Graph API: POST /{comment-id}/likes to like a comment
      await this.client.post(`/${commentId}/likes`);
      console.log(`✅ Liked comment ${commentId}`);
      return { success: true };
    } catch (error: any) {
      console.error('Error liking comment:', error?.response?.data || error?.message);
      throw new Error(error?.response?.data?.error?.message || 'Fehler beim Liken des Kommentars');
    }
  }

  // Unlike a comment
  async unlikeComment(commentId: string): Promise<{ success: boolean }> {
    if (this.useMockData) {
      console.log(`Mock: Unliked comment ${commentId}`);
      return { success: true };
    }

    try {
      // Instagram Graph API: DELETE /{comment-id}/likes to unlike a comment
      await this.client.delete(`/${commentId}/likes`);
      console.log(`✅ Unliked comment ${commentId}`);
      return { success: true };
    } catch (error: any) {
      console.error('Error unliking comment:', error?.response?.data || error?.message);
      throw new Error(error?.response?.data?.error?.message || 'Fehler beim Entfernen des Likes');
    }
  }

  // Get conversations (DMs) - requires instagram_manage_messages permission
  async getConversations(): Promise<InstagramConversation[]> {
    const response = await this.client.get(`/${this.accountId}/conversations`, {
      params: {
        platform: 'instagram',
        fields: 'id,participants,messages{id,message,from,to,created_time}',
      },
    });
    return response.data.data || [];
  }

  // Get messages from a conversation
  async getConversationMessages(conversationId: string): Promise<Interaction[]> {
    const response = await this.client.get(`/${conversationId}`, {
      params: {
        fields: 'messages{id,message,from,to,created_time}',
      },
    });

    const messages = response.data.messages?.data || [];
    return messages.map((msg: any) => ({
      id: msg.id,
      platform: 'instagram' as const,
      type: 'dm' as const,
      status: 'unread' as const,
      timestamp: msg.created_time,
      from: {
        id: msg.from.id,
        username: msg.from.username || msg.from.name,
      },
      content: msg.message,
      context: {
        conversationId,
      },
    }));
  }

  // Send a DM reply
  async sendMessage(recipientId: string, message: string): Promise<{ id: string }> {
    const response = await this.client.post(`/${this.accountId}/messages`, {
      recipient: { id: recipientId },
      message: { text: message },
    });
    return response.data;
  }

  // Get mentions
  async getMentions(): Promise<Interaction[]> {
    const response = await this.client.get(`/${this.accountId}/tags`, {
      params: {
        fields: 'id,caption,timestamp,permalink,media_type,media_url,owner{id,username}',
      },
    });

    const mentions = response.data.data || [];
    return mentions.map((mention: any) => ({
      id: mention.id,
      platform: 'instagram' as const,
      type: 'mention' as const,
      status: 'unread' as const,
      timestamp: mention.timestamp,
      from: {
        id: mention.owner.id,
        username: mention.owner.username,
      },
      content: mention.caption || '[Erwähnung in Bild/Video]',
      context: {
        mediaId: mention.id,
        mediaUrl: mention.media_url,
      },
    }));
  }

  // Get all interactions (comments, DMs, mentions)
  async getAllInteractions(): Promise<Interaction[]> {
    // Return mock data if no API credentials configured
    if (this.useMockData) {
      return MOCK_INTERACTIONS;
    }

    try {
      // Fetch real comments from Instagram Business API
      const comments = await this.getAllComments(15);

      // Try to fetch mentions (may fail if not available)
      let mentions: Interaction[] = [];
      try {
        mentions = await this.getMentions();
      } catch (e) {
        console.log('Mentions not available');
      }

      // Clear any previous error on success
      this.lastError = { connected: true, usingMockData: false };

      const all = [...comments, ...mentions];
      return all.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      // Parse and store the error
      this.lastError = this.parseApiError(error);
      console.log('Error fetching interactions, falling back to mock data:', this.lastError.error);
      return MOCK_INTERACTIONS;
    }
  }

  // Get all comments (with mock support)
  async getAllCommentsMock(): Promise<Interaction[]> {
    if (this.useMockData) {
      return MOCK_INTERACTIONS.filter((i) => i.type === 'comment');
    }
    return this.getAllComments();
  }

  // Get mentions (with mock support)
  async getMentionsMock(): Promise<Interaction[]> {
    if (this.useMockData) {
      return MOCK_INTERACTIONS.filter((i) => i.type === 'mention');
    }
    return this.getMentions();
  }
}

export const instagramService = new InstagramService();
