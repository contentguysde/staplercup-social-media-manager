import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from './_lib/auth';
import { getInstagramCredentials } from './_lib/instagram-credentials';
import axios from 'axios';

// Mock data for development/demo
const mockInteractions = [
  {
    id: 'mock_1',
    type: 'comment',
    platform: 'instagram',
    content: 'Super Veranstaltung! Wann findet der nächste StaplerCup statt?',
    from: { id: 'user_1', username: 'logistik_fan_2024', name: 'Max Mustermann' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
    replied: false,
    context: {
      mediaId: 'post_1',
      mediaUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400',
      mediaCaption: 'StaplerCup 2024 - Die besten Momente!',
      mediaPermalink: 'https://www.instagram.com/p/example1/',
    },
  },
  {
    id: 'mock_2',
    type: 'dm',
    platform: 'instagram',
    content: 'Hallo, ich würde gerne als Sponsor beim nächsten Event dabei sein. An wen kann ich mich wenden?',
    from: { id: 'user_2', username: 'firma_logistics', name: 'Logistics GmbH' },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: false,
    replied: false,
  },
  {
    id: 'mock_3',
    type: 'mention',
    platform: 'instagram',
    content: '@staplercup war gestern der absolute Wahnsinn! Danke für die tolle Organisation!',
    from: { id: 'user_3', username: 'gabelstapler_profi', name: 'Stapler Pro' },
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    replied: true,
    context: {
      mediaId: 'post_3',
      mediaUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400',
      mediaCaption: 'StaplerCup Highlights',
      mediaPermalink: 'https://www.instagram.com/p/example3/',
    },
  },
  {
    id: 'mock_4',
    type: 'comment',
    platform: 'instagram',
    content: 'Gibt es Videos vom Finale?',
    from: { id: 'user_4', username: 'lager_held', name: 'Lager Held' },
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    replied: false,
    context: {
      mediaId: 'post_2',
      mediaUrl: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400',
      mediaCaption: 'Finale StaplerCup 2024',
      mediaPermalink: 'https://www.instagram.com/p/example2/',
    },
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify authentication
    const token = getTokenFromHeader(req.headers.authorization as string);
    if (!token) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    try {
      verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    // Extract the action from query parameter (set by Vercel rewrite)
    const action = (req.query.action as string) || '';

    // Handle different HTTP methods and actions
    if (req.method === 'GET') {
      switch (action) {
        case 'status':
          return handleStatus(req, res);
        case 'interactions':
          return handleInteractions(req, res);
        case 'conversations':
          return handleGetConversations(req, res);
        case 'messages':
          return handleGetMessages(req, res);
        default:
          return res.status(404).json({ error: 'Endpoint nicht gefunden' });
      }
    } else if (req.method === 'POST') {
      switch (action) {
        case 'send-message':
          return handleSendMessage(req, res);
        default:
          return res.status(404).json({ error: 'Endpoint nicht gefunden' });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Instagram error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// GET /api/instagram/status
async function handleStatus(_req: VercelRequest, res: VercelResponse) {
  // Get credentials from OAuth (database) first, then fall back to env vars
  const credentials = await getInstagramCredentials();

  if (!credentials) {
    return res.status(200).json({
      success: true,
      data: {
        connected: false,
        usingMockData: true,
        error: 'Instagram nicht konfiguriert',
        errorType: 'token_invalid',
      },
    });
  }

  try {
    // Use Facebook Graph API for Instagram Business accounts
    // (Instagram Graph API is only for Basic Display API / personal accounts)
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${credentials.accountId}`,
      {
        params: {
          fields: 'id,username,name,profile_picture_url',
          access_token: credentials.accessToken,
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        usingMockData: false,
        username: response.data.username,
        source: credentials.source,
      },
    });
  } catch (error: any) {
    console.error('Instagram status check error:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.error?.message || 'Verbindung fehlgeschlagen';
    const isExpired = errorMessage.includes('expired') || errorMessage.includes('Session');

    return res.status(200).json({
      success: true,
      data: {
        connected: false,
        usingMockData: true,
        error: errorMessage,
        errorType: isExpired ? 'token_expired' : 'token_invalid',
      },
    });
  }
}

// GET /api/instagram/interactions
async function handleInteractions(_req: VercelRequest, res: VercelResponse) {
  const credentials = await getInstagramCredentials();

  if (!credentials) {
    // Return mock data if not connected
    return res.status(200).json({
      success: true,
      data: mockInteractions,
      usingMockData: true,
    });
  }

  try {
    const interactions: any[] = [];

    // Step 1: Get recent media posts from Instagram Business Account
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${credentials.accountId}/media`,
      {
        params: {
          fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
          limit: 25,
          access_token: credentials.accessToken,
        },
      }
    );

    const posts = mediaResponse.data.data || [];

    // Step 2: For each post, get comments
    for (const post of posts) {
      try {
        const commentsResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${post.id}/comments`,
          {
            params: {
              fields: 'id,text,timestamp,from{id,username},like_count',
              limit: 50,
              access_token: credentials.accessToken,
            },
          }
        );

        const comments = commentsResponse.data.data || [];

        for (const comment of comments) {
          interactions.push({
            id: comment.id,
            type: 'comment',
            platform: 'instagram',
            content: comment.text,
            from: {
              id: comment.from?.id || 'unknown',
              username: comment.from?.username || 'Unbekannter Nutzer',
              name: comment.from?.username || 'Unbekannter Nutzer',
            },
            timestamp: comment.timestamp,
            read: false,
            replied: false,
            context: {
              mediaId: post.id,
              mediaUrl: post.media_url || post.thumbnail_url,
              mediaCaption: post.caption || '',
              mediaPermalink: post.permalink,
            },
          });
        }
      } catch (commentError: any) {
        // Skip posts where we can't fetch comments (might not have permission)
        console.log(`Could not fetch comments for post ${post.id}:`, commentError.response?.data?.error?.message);
      }
    }

    // Step 3: Try to get mentions (tagged media)
    try {
      const tagsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${credentials.accountId}/tags`,
        {
          params: {
            fields: 'id,caption,media_type,media_url,permalink,timestamp,username',
            limit: 25,
            access_token: credentials.accessToken,
          },
        }
      );

      const tags = tagsResponse.data.data || [];

      for (const tag of tags) {
        interactions.push({
          id: `mention_${tag.id}`,
          type: 'mention',
          platform: 'instagram',
          content: tag.caption || `Du wurdest von @${tag.username} markiert`,
          from: {
            id: tag.id,
            username: tag.username || 'Unbekannter Nutzer',
            name: tag.username || 'Unbekannter Nutzer',
          },
          timestamp: tag.timestamp,
          read: false,
          replied: false,
          context: {
            mediaId: tag.id,
            mediaUrl: tag.media_url,
            mediaCaption: tag.caption || '',
            mediaPermalink: tag.permalink,
          },
        });
      }
    } catch (tagsError: any) {
      // Tags endpoint might not be available
      console.log('Could not fetch mentions:', tagsError.response?.data?.error?.message);
    }

    // Step 4: Try to get DM conversations (requires pageId)
    if (credentials.pageId) {
      try {
        const conversationsResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${credentials.pageId}/conversations`,
          {
            params: {
              platform: 'instagram',
              fields: 'id,participants,updated_time,messages.limit(1){id,message,from,created_time}',
              limit: 25,
              access_token: credentials.accessToken,
            },
          }
        );

        const conversations = conversationsResponse.data.data || [];

        for (const conv of conversations) {
          // Find the participant that is not our page/account
          const participant = conv.participants?.data?.find(
            (p: any) => p.id !== credentials.pageId && p.id !== credentials.accountId
          );
          const latestMessage = conv.messages?.data?.[0];

          if (latestMessage) {
            // Check if the last message is from someone else (not us)
            const isFromOther =
              latestMessage.from?.id !== credentials.pageId &&
              latestMessage.from?.id !== credentials.accountId;

            if (isFromOther) {
              interactions.push({
                id: `dm_${conv.id}`,
                type: 'dm',
                platform: 'instagram',
                content: latestMessage.message || '',
                from: {
                  id: participant?.id || latestMessage.from?.id || 'unknown',
                  username: participant?.username || latestMessage.from?.username || 'Unbekannter Nutzer',
                  name: participant?.name || participant?.username || latestMessage.from?.name || 'Unbekannter Nutzer',
                },
                timestamp: latestMessage.created_time,
                read: false,
                replied: false,
                conversationId: conv.id,
              });
            }
          }
        }
      } catch (dmError: any) {
        // DM endpoint requires instagram_manage_messages permission
        console.log('Could not fetch DMs:', dmError.response?.data?.error?.message);
      }
    } else {
      console.log('Could not fetch DMs: pageId not available');
    }

    // Sort by timestamp (newest first)
    interactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({
      success: true,
      data: interactions,
      usingMockData: false,
    });

  } catch (error: any) {
    console.error('Error fetching Instagram interactions:', error.response?.data || error.message);

    // Fall back to mock data on error
    return res.status(200).json({
      success: true,
      data: mockInteractions,
      usingMockData: true,
      error: error.response?.data?.error?.message || 'Fehler beim Laden der Interaktionen',
    });
  }
}

// GET /api/instagram/conversations - Get Instagram DM conversations
async function handleGetConversations(_req: VercelRequest, res: VercelResponse) {
  const credentials = await getInstagramCredentials();

  if (!credentials) {
    return res.status(200).json({
      success: true,
      data: [],
      usingMockData: true,
      error: 'Instagram nicht verbunden',
    });
  }

  if (!credentials.pageId) {
    return res.status(200).json({
      success: true,
      data: [],
      usingMockData: true,
      error: 'Page ID nicht verfügbar - bitte Instagram neu verbinden',
    });
  }

  try {
    // Get conversations from Facebook Page (for Instagram DMs)
    // Note: This requires instagram_manage_messages permission
    const conversationsResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${credentials.pageId}/conversations`,
      {
        params: {
          platform: 'instagram',
          fields: 'id,participants,updated_time,messages{id,message,from,created_time}',
          limit: 25,
          access_token: credentials.accessToken,
        },
      }
    );

    const conversations = conversationsResponse.data.data || [];

    // Transform conversations into our format
    const formattedConversations = conversations.map((conv: any) => {
      const participant = conv.participants?.data?.find(
        (p: any) => p.id !== credentials.pageId && p.id !== credentials.accountId
      );
      const latestMessage = conv.messages?.data?.[0];

      return {
        id: conv.id,
        participant: {
          id: participant?.id || 'unknown',
          username: participant?.username || 'Unbekannter Nutzer',
          name: participant?.name || participant?.username || 'Unbekannter Nutzer',
        },
        lastMessage: latestMessage ? {
          id: latestMessage.id,
          content: latestMessage.message,
          timestamp: latestMessage.created_time,
          fromMe: latestMessage.from?.id === credentials.pageId || latestMessage.from?.id === credentials.accountId,
        } : null,
        updatedAt: conv.updated_time,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedConversations,
      usingMockData: false,
    });

  } catch (error: any) {
    console.error('Error fetching Instagram conversations:', error.response?.data || error.message);

    return res.status(200).json({
      success: true,
      data: [],
      usingMockData: true,
      error: error.response?.data?.error?.message || 'Fehler beim Laden der Konversationen',
    });
  }
}

// GET /api/instagram/messages?conversationId=xxx - Get messages in a conversation
async function handleGetMessages(req: VercelRequest, res: VercelResponse) {
  const conversationId = req.query.conversationId as string;

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      error: 'conversationId ist erforderlich',
    });
  }

  const credentials = await getInstagramCredentials();

  if (!credentials) {
    return res.status(200).json({
      success: false,
      error: 'Instagram nicht verbunden',
    });
  }

  try {
    // Get messages from the conversation
    const messagesResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${conversationId}`,
      {
        params: {
          fields: 'messages{id,message,from,created_time,attachments}',
          access_token: credentials.accessToken,
        },
      }
    );

    const messages = messagesResponse.data.messages?.data || [];

    // Transform messages into our format
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id,
      content: msg.message || '',
      timestamp: msg.created_time,
      from: {
        id: msg.from?.id || 'unknown',
        username: msg.from?.username || msg.from?.name || 'Unbekannter Nutzer',
        name: msg.from?.name || msg.from?.username || 'Unbekannter Nutzer',
      },
      fromMe: msg.from?.id === credentials.pageId || msg.from?.id === credentials.accountId,
      attachments: msg.attachments?.data || [],
    }));

    return res.status(200).json({
      success: true,
      data: formattedMessages,
    });

  } catch (error: any) {
    console.error('Error fetching messages:', error.response?.data || error.message);

    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Fehler beim Laden der Nachrichten',
    });
  }
}

// POST /api/instagram/send-message - Send a DM reply
async function handleSendMessage(req: VercelRequest, res: VercelResponse) {
  const { recipientId, message } = req.body;

  if (!recipientId || !message) {
    return res.status(400).json({
      success: false,
      error: 'recipientId und message sind erforderlich',
    });
  }

  const credentials = await getInstagramCredentials();

  if (!credentials) {
    return res.status(200).json({
      success: false,
      error: 'Instagram nicht verbunden',
    });
  }

  if (!credentials.pageId) {
    return res.status(200).json({
      success: false,
      error: 'Page ID nicht verfügbar - bitte Instagram neu verbinden',
    });
  }

  try {
    // Send message using the Facebook Page Messaging API (for Instagram DMs)
    // Note: This requires instagram_manage_messages permission
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${credentials.pageId}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message },
      },
      {
        params: {
          access_token: credentials.accessToken,
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        messageId: response.data.message_id,
        recipientId: response.data.recipient_id,
      },
    });

  } catch (error: any) {
    console.error('Error sending Instagram message:', error.response?.data || error.message);

    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Nachricht konnte nicht gesendet werden',
    });
  }
}
