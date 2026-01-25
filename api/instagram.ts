import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from './_lib/auth';
import { getInstagramCredentials } from './_lib/instagram-credentials';
import { sql } from '@vercel/postgres';
import axios from 'axios';


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

/**
 * Fetch comments from webhook table (real-time notifications)
 * These are comments that were pushed to us via Instagram webhooks
 */
async function getWebhookComments(credentials: { accountId: string; accessToken: string }): Promise<any[]> {
  try {
    // Check if table exists and fetch recent webhook comments
    const result = await sql`
      SELECT
        comment_id,
        media_id,
        text,
        from_id,
        from_username,
        timestamp,
        raw_payload
      FROM webhook_comments
      WHERE event_type = 'comment'
        AND text IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    if (result.rows.length === 0) {
      return [];
    }

    // We need to fetch media details for each unique media_id to get context
    const mediaIds = [...new Set(result.rows.map(r => r.media_id).filter(Boolean))];
    const mediaCache: Record<string, any> = {};

    // Fetch media details in batches (to avoid too many API calls)
    for (const mediaId of mediaIds.slice(0, 10)) { // Limit to 10 unique media items
      try {
        const mediaResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${mediaId}`,
          {
            params: {
              fields: 'id,caption,media_url,thumbnail_url,permalink,media_type,media_product_type',
              access_token: credentials.accessToken,
            },
            timeout: 3000,
          }
        );
        mediaCache[mediaId] = mediaResponse.data;
      } catch (err) {
        console.log(`Could not fetch media ${mediaId}:`, err);
      }
    }

    // Transform webhook comments to interaction format
    return result.rows.map(row => {
      const media = mediaCache[row.media_id] || {};
      return {
        id: row.comment_id,
        type: 'comment',
        platform: 'instagram',
        content: row.text,
        from: {
          id: row.from_id || 'unknown',
          username: row.from_username || 'Unbekannter Nutzer',
          name: row.from_username || 'Unbekannter Nutzer',
        },
        timestamp: row.timestamp,
        read: false,
        replied: false,
        context: {
          mediaId: row.media_id,
          mediaUrl: media.media_type === 'VIDEO'
            ? (media.thumbnail_url || media.media_url)
            : (media.media_url || media.thumbnail_url),
          mediaCaption: media.caption || '',
          mediaPermalink: media.permalink || '',
          mediaType: media.media_type,
          mediaProductType: media.media_product_type,
        },
        source: 'webhook', // Mark as coming from webhook
      };
    });
  } catch (error: any) {
    // Table might not exist yet - that's fine
    if (error.message?.includes('does not exist')) {
      console.log('Webhook comments table does not exist yet');
      return [];
    }
    console.error('Error fetching webhook comments:', error);
    return [];
  }
}

// GET /api/instagram/interactions
async function handleInteractions(_req: VercelRequest, res: VercelResponse) {
  const credentials = await getInstagramCredentials();

  console.log('handleInteractions - credentials:', credentials ? {
    source: credentials.source,
    accountId: credentials.accountId,
    hasPageId: !!credentials.pageId,
    tokenLength: credentials.accessToken?.length || 0,
  } : 'null');

  if (!credentials) {
    // Return empty array if not connected
    return res.status(200).json({
      success: true,
      data: [],
      usingMockData: false,
      debug: { error: 'No credentials found' },
    });
  }

  try {
    const interactions: any[] = [];
    let dmPermissionMissing = false;

    // Configure axios with shorter timeout to prevent Vercel function timeout
    const apiConfig = { timeout: 5000 }; // 5 seconds max per request

    // Run API calls sequentially for debugging
    console.log('Starting media fetch...');
    let mediaResult: PromiseSettledResult<any>;
    try {
      const mediaResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${credentials.accountId}/media`,
        {
          ...apiConfig,
          params: {
            fields: 'id,caption,media_url,thumbnail_url,permalink,timestamp,media_type,media_product_type,comments.limit(15).order(reverse_chronological){id,text,timestamp,from{id,username}}',
            limit: 20,
            access_token: credentials.accessToken,
          },
        }
      );
      mediaResult = { status: 'fulfilled', value: mediaResponse };
      console.log('Media fetch SUCCESS:', mediaResponse.data.data?.length || 0, 'posts');
    } catch (err: any) {
      mediaResult = { status: 'rejected', reason: err };
      console.log('Media fetch FAILED:', err.response?.data?.error?.message || err.message);
    }

    console.log('Starting tags fetch...');
    let tagsResult: PromiseSettledResult<any>;
    try {
      const tagsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${credentials.accountId}/tags`,
        {
          ...apiConfig,
          params: {
            fields: 'id,caption,media_url,permalink,timestamp,username,media_type,media_product_type',
            limit: 10,
            access_token: credentials.accessToken,
          },
        }
      );
      tagsResult = { status: 'fulfilled', value: tagsResponse };
      console.log('Tags fetch SUCCESS:', tagsResponse.data.data?.length || 0, 'tags');
    } catch (err: any) {
      tagsResult = { status: 'rejected', reason: err };
      console.log('Tags fetch FAILED:', err.response?.data?.error?.message || err.message);
    }

    console.log('Starting conversations fetch...');
    let conversationsResult: PromiseSettledResult<any>;
    if (credentials.pageId) {
      try {
        const convResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${credentials.pageId}/conversations`,
          {
            ...apiConfig,
            params: {
              platform: 'instagram',
              fields: 'id,participants,updated_time,messages.limit(1){id,message,from,created_time}',
              limit: 10,
              access_token: credentials.accessToken,
            },
          }
        );
        conversationsResult = { status: 'fulfilled', value: convResponse };
        console.log('Conversations fetch SUCCESS:', convResponse.data.data?.length || 0, 'conversations');
      } catch (err: any) {
        conversationsResult = { status: 'rejected', reason: err };
        console.log('Conversations fetch FAILED:', err.response?.data?.error?.message || err.message);
      }
    } else {
      conversationsResult = { status: 'fulfilled', value: { data: { data: [] } } };
      console.log('Conversations fetch SKIPPED (no pageId)');
    }

    console.log('Starting webhook fetch...');
    let webhookResult: PromiseSettledResult<any>;
    try {
      const webhookComments = await getWebhookComments(credentials);
      webhookResult = { status: 'fulfilled', value: webhookComments };
      console.log('Webhook fetch SUCCESS:', webhookComments?.length || 0, 'comments');
    } catch (err: any) {
      webhookResult = { status: 'rejected', reason: err };
      console.log('Webhook fetch FAILED:', err.message);
    }

    console.log('All API calls completed');

    // Process media/comments
    if (mediaResult.status === 'fulfilled') {
      const posts = mediaResult.value.data.data || [];
      for (const post of posts) {
        const comments = post.comments?.data || [];
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
              // For videos/reels, use thumbnail_url as the preview image
              // For images, use media_url
              mediaUrl: post.media_type === 'VIDEO'
                ? (post.thumbnail_url || post.media_url)
                : (post.media_url || post.thumbnail_url),
              mediaCaption: post.caption || '',
              mediaPermalink: post.permalink,
              mediaType: post.media_type, // IMAGE, VIDEO, CAROUSEL_ALBUM
              mediaProductType: post.media_product_type, // FEED, REELS, STORY
            },
          });
        }
      }
    } else {
      console.log('Could not fetch media:', (mediaResult.reason as any)?.response?.data?.error?.message || mediaResult.reason);
    }

    // Process mentions
    if (tagsResult.status === 'fulfilled') {
      const tags = tagsResult.value.data.data || [];
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
            mediaType: tag.media_type,
            mediaProductType: tag.media_product_type,
          },
        });
      }
    } else {
      console.log('Could not fetch mentions:', (tagsResult.reason as any)?.response?.data?.error?.message || tagsResult.reason);
    }

    // Process DMs
    if (conversationsResult.status === 'fulfilled' && credentials.pageId) {
      const conversations = conversationsResult.value.data.data || [];
      for (const conv of conversations) {
        const participant = conv.participants?.data?.find(
          (p: any) => p.id !== credentials.pageId && p.id !== credentials.accountId
        );
        const latestMessage = conv.messages?.data?.[0];

        if (latestMessage) {
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
    } else if (conversationsResult.status === 'rejected') {
      const dmError = (conversationsResult.reason as any)?.response?.data?.error;
      const dmErrorMessage = dmError?.message || conversationsResult.reason;
      const dmErrorCode = dmError?.code;

      // Check if this is a permission error (code 10 = permission denied, code 200 = permission error)
      const isPermissionError = dmErrorCode === 10 || dmErrorCode === 200 ||
        dmErrorMessage?.toLowerCase().includes('permission') ||
        dmErrorMessage?.toLowerCase().includes('does not have');

      if (isPermissionError) {
        console.log('DM permission missing - instagram_business_manage_messages required');
        dmPermissionMissing = true;
      } else {
        console.log('Could not fetch DMs:', dmErrorMessage);
      }
    }

    // Process webhook comments (real-time notifications)
    // These may include comments on older posts that weren't fetched via polling
    if (webhookResult.status === 'fulfilled') {
      const webhookComments = webhookResult.value || [];
      console.log(`Found ${webhookComments.length} webhook comments`);

      // Create a Set of existing comment IDs for deduplication
      const existingIds = new Set(interactions.map(i => i.id));

      // Add webhook comments that aren't already in the list
      for (const comment of webhookComments) {
        if (!existingIds.has(comment.id)) {
          interactions.push(comment);
          existingIds.add(comment.id);
        }
      }
    } else {
      console.log('Could not fetch webhook comments:', webhookResult.reason);
    }

    // Sort by timestamp (newest first)
    interactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Include debug info to help diagnose issues
    const mediaData = mediaResult.status === 'fulfilled' ? mediaResult.value.data.data : null;
    const totalCommentsOnPosts = mediaData ? mediaData.reduce((sum: number, post: any) => sum + (post.comments?.data?.length || 0), 0) : 0;

    const debug = {
      credentialsSource: credentials.source,
      accountId: credentials.accountId,
      hasPageId: !!credentials.pageId,
      pageId: credentials.pageId || null,
      // Media details
      mediaFetched: mediaData?.length || 0,
      mediaError: mediaResult.status === 'rejected'
        ? ((mediaResult.reason as any)?.response?.data?.error?.message || String(mediaResult.reason))
        : null,
      totalCommentsOnPosts,
      // Show first few post IDs for debugging
      firstPosts: mediaData?.slice(0, 3).map((p: any) => ({
        id: p.id,
        commentCount: p.comments?.data?.length || 0,
        hasComments: !!(p.comments?.data?.length),
      })) || [],
      // Tags details
      tagsFetched: tagsResult.status === 'fulfilled' ? (tagsResult.value.data.data?.length || 0) : 0,
      tagsError: tagsResult.status === 'rejected'
        ? ((tagsResult.reason as any)?.response?.data?.error?.message || String(tagsResult.reason))
        : null,
      // Conversations details
      conversationsFetched: conversationsResult.status === 'fulfilled' ? (conversationsResult.value.data.data?.length || 0) : 0,
      conversationsError: conversationsResult.status === 'rejected'
        ? ((conversationsResult.reason as any)?.response?.data?.error?.message || String(conversationsResult.reason))
        : null,
      // Webhook details
      webhookCommentsFetched: webhookResult.status === 'fulfilled' ? (webhookResult.value?.length || 0) : 0,
      webhookError: webhookResult.status === 'rejected' ? String(webhookResult.reason) : null,
      // Total
      totalInteractions: interactions.length,
    };

    console.log('Instagram interactions fetch debug:', JSON.stringify(debug, null, 2));

    return res.status(200).json({
      success: true,
      data: interactions,
      usingMockData: false,
      dmPermissionMissing,
      debug,
    });

  } catch (error: any) {
    console.error('Error fetching Instagram interactions:', error.response?.data || error.message);

    // Return empty array on error
    return res.status(200).json({
      success: true,
      data: [],
      usingMockData: false,
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
