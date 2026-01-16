import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAccessToken, getTokenFromHeader } from './_lib/auth';
import {
  getAllInteractionMetadata,
  getArchivedInteractionIds,
  getReadInteractionIds,
  markInteractionAsRead,
  markInteractionAsUnread,
  archiveInteraction,
  unarchiveInteraction,
  assignInteraction,
  unassignInteraction,
  getInteractionsAssignedToUser,
  getAllAssignments,
  getAllUsers,
} from './_lib/db';

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

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'Ungültiger Token' });
    }

    // Extract the action from query parameter (set by Vercel rewrite)
    const action = (req.query.action as string) || '';

    // GET /api/interactions/metadata - Get all interaction metadata
    if (req.method === 'GET' && action === 'metadata') {
      const metadata = await getAllInteractionMetadata();
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    }

    // GET /api/interactions/archived - Get archived interaction IDs
    if (req.method === 'GET' && action === 'archived') {
      const archivedIds = await getArchivedInteractionIds();
      return res.status(200).json({
        success: true,
        data: archivedIds,
      });
    }

    // GET /api/interactions/read - Get read interaction IDs
    if (req.method === 'GET' && action === 'read') {
      const readIds = await getReadInteractionIds();
      return res.status(200).json({
        success: true,
        data: readIds,
      });
    }

    // POST /api/interactions/mark-read - Mark interaction as read
    if (req.method === 'POST' && action === 'mark-read') {
      // Viewers can read interactions
      const { interactionId } = req.body;
      if (!interactionId) {
        return res.status(400).json({ error: 'interactionId ist erforderlich' });
      }

      const metadata = await markInteractionAsRead(interactionId);
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    }

    // POST /api/interactions/mark-unread - Mark interaction as unread
    if (req.method === 'POST' && action === 'mark-unread') {
      // Viewers can mark as unread
      const { interactionId } = req.body;
      if (!interactionId) {
        return res.status(400).json({ error: 'interactionId ist erforderlich' });
      }

      const metadata = await markInteractionAsUnread(interactionId);
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    }

    // POST /api/interactions/archive - Archive an interaction
    if (req.method === 'POST' && action === 'archive') {
      // Only managers and admins can archive
      if (payload.role === 'viewer') {
        return res.status(403).json({ error: 'Keine Berechtigung zum Archivieren' });
      }

      const { interactionId } = req.body;
      if (!interactionId) {
        return res.status(400).json({ error: 'interactionId ist erforderlich' });
      }

      const metadata = await archiveInteraction(interactionId);
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    }

    // POST /api/interactions/unarchive - Unarchive an interaction
    if (req.method === 'POST' && action === 'unarchive') {
      // Only managers and admins can unarchive
      if (payload.role === 'viewer') {
        return res.status(403).json({ error: 'Keine Berechtigung zum Wiederherstellen' });
      }

      const { interactionId } = req.body;
      if (!interactionId) {
        return res.status(400).json({ error: 'interactionId ist erforderlich' });
      }

      const metadata = await unarchiveInteraction(interactionId);
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    }

    // POST /api/interactions/assign - Assign interaction to a user
    if (req.method === 'POST' && action === 'assign') {
      // Only managers and admins can assign
      if (payload.role === 'viewer') {
        return res.status(403).json({ error: 'Keine Berechtigung zum Zuweisen' });
      }

      const { interactionId, userId } = req.body;
      if (!interactionId) {
        return res.status(400).json({ error: 'interactionId ist erforderlich' });
      }
      if (!userId) {
        return res.status(400).json({ error: 'userId ist erforderlich' });
      }

      const metadata = await assignInteraction(interactionId, userId);
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    }

    // POST /api/interactions/unassign - Remove assignment from interaction
    if (req.method === 'POST' && action === 'unassign') {
      // Only managers and admins can unassign
      if (payload.role === 'viewer') {
        return res.status(403).json({ error: 'Keine Berechtigung zum Entfernen der Zuweisung' });
      }

      const { interactionId } = req.body;
      if (!interactionId) {
        return res.status(400).json({ error: 'interactionId ist erforderlich' });
      }

      const metadata = await unassignInteraction(interactionId);
      return res.status(200).json({
        success: true,
        data: metadata,
      });
    }

    // GET /api/interactions/my-assigned - Get interactions assigned to current user
    if (req.method === 'GET' && action === 'my-assigned') {
      const assignedIds = await getInteractionsAssignedToUser(payload.userId);
      return res.status(200).json({
        success: true,
        data: assignedIds,
      });
    }

    // GET /api/interactions/assignments - Get all assignments with user info
    if (req.method === 'GET' && action === 'assignments') {
      const assignments = await getAllAssignments();
      return res.status(200).json({
        success: true,
        data: assignments,
      });
    }

    // GET /api/interactions/users - Get all users for assignment dropdown
    if (req.method === 'GET' && action === 'users') {
      const users = await getAllUsers();
      return res.status(200).json({
        success: true,
        data: users,
      });
    }

    return res.status(404).json({ error: 'Endpoint nicht gefunden' });
  } catch (error) {
    console.error('Interactions error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler' });
  }
}
