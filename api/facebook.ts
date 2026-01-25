import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from './_lib/auth';
import { getInstagramCredentials } from './_lib/instagram-credentials';
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

// GET /api/facebook/interactions - Fetch comments from Facebook Page posts
async function handleInteractions(_req: VercelRequest, res: VercelResponse) {
  const credentials = await getInstagramCredentials();

  console.log('Facebook handleInteractions - credentials:', credentials ? {
    source: credentials.source,
    hasPageId: !!credentials.pageId,
    tokenLength: credentials.accessToken?.length || 0,
  } : 'null');

  if (!credentials || !credentials.pageId) {
    return res.status(200).json({
      success: true,
      data: [],
      error: 'Keine Facebook-Seite verbunden',
    });
  }

  try {
    const interactions: any[] = [];

    // Configure axios with timeout to prevent Vercel function timeout
    const apiConfig = { timeout: 8000 };

    console.log('Fetching Facebook Page feed...');

    // Fetch posts from the Facebook Page with their comments
    const feedResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${credentials.pageId}/feed`,
      {
        ...apiConfig,
        params: {
          fields: 'id,message,created_time,permalink_url,full_picture,type,comments.limit(15).order(reverse_chronological){id,message,from,created_time}',
          limit: 20,
          access_token: credentials.accessToken,
        },
      }
    );

    const posts = feedResponse.data.data || [];
    const totalComments = posts.reduce((sum: number, p: any) => sum + (p.comments?.data?.length || 0), 0);
    console.log('Facebook feed SUCCESS:', posts.length, 'posts,', totalComments, 'total comments');

    // Transform posts and comments to interaction format
    for (const post of posts) {
      const comments = post.comments?.data || [];
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
            mediaUrl: post.full_picture || null,
            mediaCaption: post.message || '',
            mediaPermalink: post.permalink_url || `https://facebook.com/${post.id}`,
            mediaType: post.type === 'video' ? 'VIDEO' : 'IMAGE',
          },
        });
      }
    }

    // Sort by timestamp (newest first)
    interactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log('RETURNING', interactions.length, 'Facebook interactions');

    return res.status(200).json({
      success: true,
      data: interactions,
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
