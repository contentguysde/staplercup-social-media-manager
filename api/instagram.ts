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

  // Allow debug-webhooks endpoint without auth (temporary for debugging)
  const action = (req.query.action as string) || '';
  if (action === 'debug-webhooks' && req.method === 'GET') {
    return handleDebugWebhooks(req, res);
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
        case 'debug-webhooks':
          return handleDebugWebhooks(req, res);
        default:
          return res.status(404).json({ error: 'Endpoint nicht gefunden' });
      }
    } else if (req.method === 'POST') {
      // Check for comment reply pattern: comments/{commentId}/reply
      const replyMatch = action.match(/^comments\/([^/]+)\/reply$/);
      if (replyMatch) {
        return handleReplyToComment(req, res, replyMatch[1]);
      }

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

// GET /api/instagram/debug-webhooks - Debug endpoint to check webhook merging
async function handleDebugWebhooks(_req: VercelRequest, res: VercelResponse) {
  const credentials = await getInstagramCredentials();

  if (!credentials) {
    return res.status(200).json({
      success: false,
      error: 'No credentials found',
    });
  }

  try {
    const webhookComments = await getWebhookComments(credentials);
    return res.status(200).json({
      success: true,
      count: webhookComments.length,
      comments: webhookComments.map(c => ({
        id: c.id,
        content: c.content?.substring(0, 50),
        from: c.from?.username,
        timestamp: c.timestamp,
        hasContext: !!c.context?.mediaUrl,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
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
 * Verify if a comment still exists via Graph API
 * Returns true if comment exists, false if deleted/not found
 */
async function verifyCommentExists(commentId: string, accessToken: string): Promise<boolean> {
  try {
    await axios.get(
      `https://graph.facebook.com/v18.0/${commentId}`,
      {
        params: {
          fields: 'id',
          access_token: accessToken,
        },
        timeout: 3000,
      }
    );
    return true;
  } catch (error: any) {
    const errorCode = error.response?.data?.error?.code;
    // Error code 100 = "Unsupported get request" (comment deleted or doesn't exist)
    // Error code 190 = Invalid access token (shouldn't mark as deleted)
    if (errorCode === 100 || error.response?.status === 404) {
      return false;
    }
    // For other errors, assume comment still exists to avoid false positives
    return true;
  }
}

/**
 * Mark a comment as deleted in the webhook_comments table
 */
async function markCommentAsDeleted(commentId: string): Promise<void> {
  try {
    await sql`
      UPDATE webhook_comments
      SET deleted = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE comment_id = ${commentId}
    `;
    console.log(`Marked comment ${commentId} as deleted`);
  } catch (error) {
    console.error(`Error marking comment ${commentId} as deleted:`, error);
  }
}

/**
 * Fetch comments from webhook table (real-time notifications)
 * These are comments that were pushed to us via Instagram webhooks
 */
async function getWebhookComments(credentials: { accountId: string; accessToken: string }): Promise<any[]> {
  try {
    // Check if table exists and fetch recent webhook comments for Instagram only
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
      WHERE (platform = 'instagram' OR platform IS NULL)
        AND event_type = 'comment'
        AND text IS NOT NULL
        AND (deleted IS NULL OR deleted = FALSE)
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    if (result.rows.length === 0) {
      return [];
    }

    // Verify comments still exist (check a sample to avoid too many API calls)
    // Only verify comments that are less than 7 days old to avoid unnecessary API calls for old data
    const recentComments = result.rows.filter(row => {
      const commentAge = Date.now() - new Date(row.timestamp).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      return commentAge < sevenDays;
    });

    // Verify up to 10 recent comments in parallel
    const commentsToVerify = recentComments.slice(0, 10);
    const verificationResults = await Promise.all(
      commentsToVerify.map(async (row) => {
        const exists = await verifyCommentExists(row.comment_id, credentials.accessToken);
        if (!exists) {
          await markCommentAsDeleted(row.comment_id);
        }
        return { commentId: row.comment_id, exists };
      })
    );

    // Create a set of deleted comment IDs
    const deletedCommentIds = new Set(
      verificationResults.filter(r => !r.exists).map(r => r.commentId)
    );

    // Filter out deleted comments
    const validRows = result.rows.filter(row => !deletedCommentIds.has(row.comment_id));

    if (validRows.length === 0) {
      return [];
    }

    // We need to fetch media details for each unique media_id to get context
    const mediaIds = [...new Set(validRows.map(r => r.media_id).filter(Boolean))];
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
    return validRows.map(row => {
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
        status: 'unread', // Frontend expects status field
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
    console.log('=== STARTING handleInteractions try block ===');
    const interactions: any[] = [];
    let dmPermissionMissing = false;

    // Configure axios with shorter timeout to prevent Vercel function timeout
    const apiConfig = { timeout: 8000 }; // 8 seconds max per request
    console.log('API config set, timeout:', apiConfig.timeout);

    // Run API calls sequentially for debugging
    console.log('Starting media fetch...');
    let mediaResult: PromiseSettledResult<any>;
    try {
      const mediaResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${credentials.accountId}/media`,
        {
          ...apiConfig,
          params: {
            fields: 'id,caption,media_url,thumbnail_url,permalink,timestamp,media_type,media_product_type,comments.limit(15).order(reverse_chronological){id,text,timestamp,from{id,username},replies.limit(10){id,text,timestamp,from{id,username}}}',
            limit: 20,
            access_token: credentials.accessToken,
          },
        }
      );
      mediaResult = { status: 'fulfilled', value: mediaResponse };
      const posts = mediaResponse.data.data || [];
      const totalComments = posts.reduce((sum: number, p: any) => sum + (p.comments?.data?.length || 0), 0);
      console.log('Media fetch SUCCESS:', posts.length, 'posts,', totalComments, 'total comments');
      // Log first 3 posts with their comment counts
      posts.slice(0, 3).forEach((p: any, i: number) => {
        console.log(`  Post ${i + 1}: ${p.id}, comments: ${p.comments?.data?.length || 0}`);
      });
    } catch (err: any) {
      mediaResult = { status: 'rejected', reason: err };
      console.log('Media fetch FAILED:', err.response?.data?.error?.message || err.message);
    }

    // Skip tags and conversations fetch for now - they're timing out
    // TODO: Re-enable once core functionality works
    console.log('Tags and conversations fetch SKIPPED (disabled for debugging)');

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
            status: 'unread', // Frontend expects status field, not read/replied booleans
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
            // Include replies from the API (responses to this comment)
            replies: comment.replies?.data?.map((reply: any) => ({
              id: reply.id,
              content: reply.text,
              timestamp: reply.timestamp,
              isOwn: reply.from?.id === credentials.accountId,
              from: {
                id: reply.from?.id || 'unknown',
                username: reply.from?.username || 'Unbekannt',
              },
            })) || [],
          });
        }
      }
    } else {
      console.log('Could not fetch media:', (mediaResult.reason as any)?.response?.data?.error?.message || mediaResult.reason);
    }

    // Tags/mentions and DMs are currently disabled for debugging
    // TODO: Re-enable once core functionality works

    // Merge webhook comments (for comments on older posts not in Graph API response)
    if (webhookResult.status === 'fulfilled' && Array.isArray(webhookResult.value)) {
      const webhookComments = webhookResult.value;
      const existingIds = new Set(interactions.map(i => i.id));

      let addedFromWebhook = 0;
      for (const webhookComment of webhookComments) {
        // Only add if not already in Graph API results (deduplicate by comment_id)
        if (!existingIds.has(webhookComment.id)) {
          interactions.push(webhookComment);
          existingIds.add(webhookComment.id);
          addedFromWebhook++;
        }
      }
      console.log(`Merged ${addedFromWebhook} webhook comments (${webhookComments.length} total in webhook table)`);
    }

    // Sort by timestamp (newest first)
    interactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log('RETURNING', interactions.length, 'interactions (Graph API + Webhook merged)');

    return res.status(200).json({
      success: true,
      data: interactions,
      usingMockData: false,
      dmPermissionMissing: false,
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

// POST /api/instagram/comments/{commentId}/reply - Reply to a comment
async function handleReplyToComment(req: VercelRequest, res: VercelResponse, commentId: string) {
  const { message } = req.body;

  console.log('[Instagram Reply] Request received:', { commentId, messageLength: message?.length });

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'message ist erforderlich',
    });
  }

  const credentials = await getInstagramCredentials();

  console.log('[Instagram Reply] Credentials:', {
    hasCredentials: !!credentials,
    accountId: credentials?.accountId,
    tokenLength: credentials?.accessToken?.length,
    source: credentials?.source,
  });

  if (!credentials) {
    return res.status(200).json({
      success: false,
      error: 'Instagram nicht verbunden',
    });
  }

  try {
    // Reply to comment using the Facebook Graph API
    // Instagram uses /replies endpoint, requires instagram_manage_comments scope
    const url = `https://graph.facebook.com/v18.0/${commentId}/replies`;
    console.log('[Instagram Reply] Making request to:', url);

    const response = await axios.post(
      url,
      null, // Send as query params for consistency with Graph API
      {
        params: {
          message,
          access_token: credentials.accessToken,
        },
      }
    );

    console.log('[Instagram Reply] Success response:', JSON.stringify(response.data, null, 2));

    return res.status(200).json({
      success: true,
      data: {
        id: response.data.id,
      },
    });
  } catch (error: any) {
    console.error('[Instagram Reply] Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Antwort konnte nicht gesendet werden',
      debug: {
        status: error.response?.status,
        errorCode: error.response?.data?.error?.code,
        errorType: error.response?.data?.error?.type,
      },
    });
  }
}
