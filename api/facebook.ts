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
        case 'debug':
          return handleDebug(req, res);
        default:
          return res.status(404).json({ error: 'Endpoint nicht gefunden' });
      }
    } else if (req.method === 'POST') {
      switch (action) {
        case 'reply':
          return handleReplyToComment(req, res);
        default:
          return res.status(404).json({ error: 'Endpoint nicht gefunden' });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Facebook API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}

// GET /api/facebook/debug - Debug Facebook API connection
async function handleDebug(_req: VercelRequest, res: VercelResponse) {
  const debug: any = {
    timestamp: new Date().toISOString(),
    steps: [],
  };

  try {
    // Step 1: Get credentials
    const credentials = await getInstagramCredentials();
    debug.steps.push({
      step: 'getCredentials',
      success: !!credentials,
      data: credentials ? {
        source: credentials.source,
        hasAccessToken: !!credentials.accessToken,
        tokenLength: credentials.accessToken?.length || 0,
        hasPageId: !!credentials.pageId,
        pageId: credentials.pageId,
        accountId: credentials.accountId,
      } : null,
    });

    if (!credentials || !credentials.pageId) {
      return res.status(200).json({
        success: true,
        data: {
          ...debug,
          error: 'No pageId in credentials',
        },
      });
    }

    // Step 2: Test Facebook Page access
    try {
      const pageInfo = await axios.get(
        `https://graph.facebook.com/v18.0/${credentials.pageId}`,
        {
          params: {
            fields: 'id,name,access_token',
            access_token: credentials.accessToken,
          },
          timeout: 5000,
        }
      );
      debug.steps.push({
        step: 'getPageInfo',
        success: true,
        data: {
          pageId: pageInfo.data.id,
          pageName: pageInfo.data.name,
        },
      });
    } catch (err: any) {
      debug.steps.push({
        step: 'getPageInfo',
        success: false,
        error: err.response?.data?.error || err.message,
      });
    }

    // Step 3: Test fetching posts
    try {
      const postsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${credentials.pageId}/posts`,
        {
          params: {
            fields: 'id,message,created_time',
            limit: 5,
            access_token: credentials.accessToken,
          },
          timeout: 5000,
        }
      );
      const posts = postsResponse.data.data || [];
      debug.steps.push({
        step: 'getPosts',
        success: true,
        data: {
          postCount: posts.length,
          posts: posts.map((p: any) => ({
            id: p.id,
            message: p.message?.substring(0, 50),
            created_time: p.created_time,
          })),
        },
      });

      // Step 4: Test fetching comments on first post
      if (posts.length > 0) {
        try {
          const commentsResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${posts[0].id}/comments`,
            {
              params: {
                fields: 'id,message,from,created_time',
                limit: 5,
                access_token: credentials.accessToken,
              },
              timeout: 5000,
            }
          );
          const comments = commentsResponse.data.data || [];
          debug.steps.push({
            step: 'getComments',
            success: true,
            data: {
              postId: posts[0].id,
              commentCount: comments.length,
              comments: comments.map((c: any) => ({
                id: c.id,
                message: c.message?.substring(0, 50),
                from: c.from?.name,
              })),
            },
          });
        } catch (err: any) {
          debug.steps.push({
            step: 'getComments',
            success: false,
            error: err.response?.data?.error || err.message,
          });
        }
      }
    } catch (err: any) {
      debug.steps.push({
        step: 'getPosts',
        success: false,
        error: err.response?.data?.error || err.message,
      });
    }

    // Step 5: Check webhook table
    try {
      const webhookResult = await sql`
        SELECT COUNT(*) as count FROM webhook_comments WHERE platform = 'facebook'
      `;
      debug.steps.push({
        step: 'checkWebhookTable',
        success: true,
        data: {
          facebookWebhookCount: webhookResult.rows[0]?.count || 0,
        },
      });
    } catch (err: any) {
      debug.steps.push({
        step: 'checkWebhookTable',
        success: false,
        error: err.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: debug,
    });
  } catch (error: any) {
    return res.status(200).json({
      success: true,
      data: {
        ...debug,
        finalError: error.message,
      },
    });
  }
}

// GET /api/facebook/status - Check if Facebook Page is connected
async function handleStatus(_req: VercelRequest, res: VercelResponse) {
  const credentials = await getInstagramCredentials();

  if (!credentials || !credentials.pageId) {
    return res.status(200).json({
      success: true,
      data: {
        connected: false,
        error: 'Keine Facebook-Seite verbunden',
      },
    });
  }

  try {
    // Get Facebook Page info using the same credentials
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${credentials.pageId}`,
      {
        params: {
          fields: 'id,name,username,picture',
          access_token: credentials.accessToken,
        },
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        connected: true,
        pageId: response.data.id,
        pageName: response.data.name,
        username: response.data.username,
        picture: response.data.picture?.data?.url,
        source: credentials.source,
      },
    });
  } catch (error: any) {
    console.error('Facebook status check error:', error.response?.data || error.message);
    return res.status(200).json({
      success: true,
      data: {
        connected: false,
        error: error.response?.data?.error?.message || 'Verbindung fehlgeschlagen',
      },
    });
  }
}

/**
 * Fetch comments from webhook table (real-time notifications)
 * These are comments that were pushed to us via Facebook webhooks
 */
async function getWebhookComments(credentials: { pageId: string; accessToken: string }): Promise<any[]> {
  try {
    // Check if table exists and fetch recent webhook comments for Facebook
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
      WHERE platform = 'facebook'
        AND event_type = 'comment'
        AND text IS NOT NULL
        AND (deleted IS NULL OR deleted = FALSE)
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    if (result.rows.length === 0) {
      return [];
    }

    console.log('Facebook webhook comments found:', result.rows.length);

    // We need to fetch post details for each unique media_id to get context
    const postIds = [...new Set(result.rows.map(r => r.media_id).filter(Boolean))];
    const postCache: Record<string, any> = {};

    // Fetch post details in batches (to avoid too many API calls)
    for (const postId of postIds.slice(0, 10)) {
      try {
        const postResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${postId}`,
          {
            params: {
              fields: 'id,message,permalink_url,attachments{media,type}',
              access_token: credentials.accessToken,
            },
            timeout: 3000,
          }
        );
        postCache[postId] = postResponse.data;
      } catch (err) {
        console.log(`Could not fetch Facebook post ${postId}:`, err);
      }
    }

    // Transform webhook comments to interaction format
    return result.rows.map(row => {
      const post = postCache[row.media_id] || {};
      const attachment = post.attachments?.data?.[0];
      const mediaUrl = attachment?.media?.image?.src || null;
      const mediaType = attachment?.type === 'video_inline' ? 'VIDEO' : 'IMAGE';

      return {
        id: row.comment_id,
        type: 'comment',
        platform: 'facebook',
        content: row.text,
        from: {
          id: row.from_id || 'unknown',
          username: row.from_username || 'Unbekannter Nutzer',
          name: row.from_username || 'Unbekannter Nutzer',
        },
        timestamp: row.timestamp,
        status: 'unread',
        context: {
          mediaId: row.media_id,
          mediaUrl,
          mediaCaption: post.message || '',
          mediaPermalink: post.permalink_url || `https://facebook.com/${row.media_id}`,
          mediaType,
        },
        source: 'webhook',
      };
    });
  } catch (error: any) {
    // Table might not exist yet
    if (error.message?.includes('does not exist')) {
      console.log('Facebook webhook comments table does not exist yet');
    } else {
      console.error('Error fetching Facebook webhook comments:', error);
    }
    return [];
  }
}

// GET /api/facebook/interactions - Fetch comments from Facebook Page posts
async function handleInteractions(_req: VercelRequest, res: VercelResponse) {
  const credentials = await getInstagramCredentials();

  console.log('Facebook handleInteractions - credentials:', credentials ? {
    source: credentials.source,
    pageId: credentials.pageId,
    hasPageId: !!credentials.pageId,
    tokenLength: credentials.accessToken?.length || 0,
  } : 'null');

  if (!credentials || !credentials.pageId) {
    console.log('Facebook: No pageId found in credentials');
    return res.status(200).json({
      success: true,
      data: [],
      error: 'Keine Facebook-Seite verbunden',
    });
  }

  try {
    // Fetch both API comments and webhook comments in parallel
    // Note: pageId is guaranteed to be defined at this point due to the check above
    const [apiInteractions, webhookInteractions] = await Promise.all([
      fetchApiComments({ pageId: credentials.pageId!, accessToken: credentials.accessToken }),
      getWebhookComments({ pageId: credentials.pageId!, accessToken: credentials.accessToken }),
    ]);

    // Merge and deduplicate interactions (webhook comments take priority as they're more recent)
    const webhookIds = new Set(webhookInteractions.map(i => i.id));
    const uniqueApiInteractions = apiInteractions.filter(i => !webhookIds.has(i.id));

    const allInteractions = [...webhookInteractions, ...uniqueApiInteractions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log('RETURNING', allInteractions.length, 'Facebook interactions (',
      webhookInteractions.length, 'from webhook,',
      uniqueApiInteractions.length, 'from API)');

    return res.status(200).json({
      success: true,
      data: allInteractions,
    });

  } catch (error: any) {
    console.error('Error fetching Facebook interactions:', error.response?.data || error.message);

    // Check for specific permission errors
    const errorMessage = error.response?.data?.error?.message || '';
    if (errorMessage.includes('permission') || errorMessage.includes('scope')) {
      return res.status(200).json({
        success: true,
        data: [],
        error: 'Fehlende Berechtigung für Facebook-Seiten. Bitte verbinde die App erneut.',
      });
    }

    return res.status(200).json({
      success: true,
      data: [],
      error: error.response?.data?.error?.message || 'Fehler beim Laden der Facebook-Interaktionen',
    });
  }
}

/**
 * Fetch comments from Facebook Graph API (polling)
 */
async function fetchApiComments(credentials: { pageId: string; accessToken: string }): Promise<any[]> {
  const interactions: any[] = [];
  const apiConfig = { timeout: 8000 };

  console.log('Fetching Facebook Page feed for pageId:', credentials.pageId);

  // First, try to get the page info to confirm access
  try {
    const pageInfo = await axios.get(
      `https://graph.facebook.com/v18.0/${credentials.pageId}`,
      {
        ...apiConfig,
        params: {
          fields: 'id,name',
          access_token: credentials.accessToken,
        },
      }
    );
    console.log('Facebook Page info:', pageInfo.data);
  } catch (pageErr: any) {
    console.log('Failed to get page info:', pageErr.response?.data?.error || pageErr.message);
  }

  // Fetch posts from the Facebook Page with their comments
  // Using posts edge instead of published_posts to avoid deprecation issues
  // Using attachments{media} instead of deprecated full_picture field
  const feedResponse = await axios.get(
    `https://graph.facebook.com/v18.0/${credentials.pageId}/posts`,
    {
      ...apiConfig,
      params: {
        fields: 'id,message,created_time,permalink_url,attachments{media,type},comments.limit(20).order(reverse_chronological){id,message,from,created_time}',
        limit: 25,
        access_token: credentials.accessToken,
      },
    }
  );

  const posts = feedResponse.data.data || [];
  const totalComments = posts.reduce((sum: number, p: any) => sum + (p.comments?.data?.length || 0), 0);
  console.log('Facebook posts SUCCESS:', posts.length, 'posts,', totalComments, 'total comments');

  // Log first 3 posts for debugging
  posts.slice(0, 3).forEach((p: any, i: number) => {
    console.log(`  Post ${i + 1}: ${p.id}, comments: ${p.comments?.data?.length || 0}, message: ${(p.message || '').substring(0, 50)}...`);
  });

  // Transform posts and comments to interaction format
  for (const post of posts) {
    const comments = post.comments?.data || [];
    // Extract media URL from attachments (new API format)
    const attachment = post.attachments?.data?.[0];
    const mediaUrl = attachment?.media?.image?.src || null;
    const mediaType = attachment?.type === 'video_inline' ? 'VIDEO' : 'IMAGE';

    for (const comment of comments) {
      interactions.push({
        id: comment.id,
        type: 'comment',
        platform: 'facebook',
        content: comment.message || '',
        from: {
          id: comment.from?.id || 'unknown',
          username: comment.from?.name || 'Unbekannter Nutzer',
          name: comment.from?.name || 'Unbekannter Nutzer',
        },
        timestamp: comment.created_time,
        status: 'unread',
        context: {
          mediaId: post.id,
          mediaUrl,
          mediaCaption: post.message || '',
          mediaPermalink: post.permalink_url || `https://facebook.com/${post.id}`,
          mediaType,
        },
        source: 'api',
      });
    }
  }

  return interactions;
}

// POST /api/facebook/reply - Reply to a Facebook comment
async function handleReplyToComment(req: VercelRequest, res: VercelResponse) {
  const { commentId, message } = req.body;

  if (!commentId || !message) {
    return res.status(400).json({
      success: false,
      error: 'commentId und message sind erforderlich',
    });
  }

  const credentials = await getInstagramCredentials();

  if (!credentials || !credentials.pageId) {
    return res.status(200).json({
      success: false,
      error: 'Keine Facebook-Seite verbunden',
    });
  }

  try {
    // Reply to comment using the Facebook Graph API
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${commentId}/comments`,
      {
        message,
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
        id: response.data.id,
      },
    });

  } catch (error: any) {
    console.error('Error replying to Facebook comment:', error.response?.data || error.message);

    return res.status(200).json({
      success: false,
      error: error.response?.data?.error?.message || 'Antwort konnte nicht gesendet werden',
    });
  }
}
