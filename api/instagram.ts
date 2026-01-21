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
    post: {
      id: 'post_1',
      mediaUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400',
      caption: 'StaplerCup 2024 - Die besten Momente!',
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
    post: {
      id: 'post_2',
      mediaUrl: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400',
      caption: 'Finale StaplerCup 2024',
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

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    switch (action) {
      case 'status':
        return handleStatus(req, res);
      case 'interactions':
        return handleInteractions(req, res);
      default:
        return res.status(404).json({ error: 'Endpoint nicht gefunden' });
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
            post: {
              id: post.id,
              mediaUrl: post.media_url || post.thumbnail_url,
              caption: post.caption || '',
              permalink: post.permalink,
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
          post: {
            id: tag.id,
            mediaUrl: tag.media_url,
            caption: tag.caption || '',
            permalink: tag.permalink,
          },
        });
      }
    } catch (tagsError: any) {
      // Tags endpoint might not be available
      console.log('Could not fetch mentions:', tagsError.response?.data?.error?.message);
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
