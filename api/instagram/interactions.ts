import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from '../_lib/auth';

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    // For now, return mock data
    // In production, you would fetch from Instagram API here
    return res.status(200).json({
      success: true,
      data: mockInteractions,
    });
  } catch (error) {
    console.error('Interactions error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
