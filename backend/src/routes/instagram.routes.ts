import { Router, Request, Response } from 'express';
import { instagramService, ConnectionStatus } from '../services/instagram.service.js';
import type { APIResponse, Interaction } from '../types/index.js';

const router = Router();

// Get connection status
router.get('/status', (_req: Request, res: Response<APIResponse<ConnectionStatus>>) => {
  const status = instagramService.getConnectionStatus();
  res.json({
    success: true,
    data: status,
  });
});

// Get all interactions (comments, DMs, mentions)
router.get('/interactions', async (_req: Request, res: Response<APIResponse<Interaction[]>>) => {
  try {
    const interactions = await instagramService.getAllInteractions();
    res.json({
      success: true,
      data: interactions,
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch interactions',
    });
  }
});

// Get comments only
router.get('/comments', async (_req: Request, res: Response<APIResponse<Interaction[]>>) => {
  try {
    const comments = await instagramService.getAllComments();
    res.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch comments',
    });
  }
});

// Reply to a comment
router.post('/comments/:id/reply', async (req: Request, res: Response<APIResponse<{ id: string }>>) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        error: 'Message is required',
      });
      return;
    }

    const result = await instagramService.replyToComment(id, message);
    res.json({
      success: true,
      data: result,
      message: 'Reply posted successfully',
    });
  } catch (error) {
    console.error('Error replying to comment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reply to comment',
    });
  }
});

// Like a comment
router.post('/comments/:id/like', async (req: Request, res: Response<APIResponse<{ success: boolean }>>) => {
  try {
    const { id } = req.params;
    const result = await instagramService.likeComment(id);
    res.json({
      success: true,
      data: result,
      message: result.success ? 'Comment liked' : 'Failed to like comment',
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to like comment',
    });
  }
});

// Get mentions
router.get('/mentions', async (_req: Request, res: Response<APIResponse<Interaction[]>>) => {
  try {
    const mentions = await instagramService.getMentions();
    res.json({
      success: true,
      data: mentions,
    });
  } catch (error) {
    console.error('Error fetching mentions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch mentions',
    });
  }
});

// Get DMs (messages)
router.get('/messages', async (_req: Request, res: Response<APIResponse<Interaction[]>>) => {
  try {
    const conversations = await instagramService.getConversations();
    const messages: Interaction[] = [];

    for (const conv of conversations) {
      const convMessages = await instagramService.getConversationMessages(conv.id);
      messages.push(...convMessages);
    }

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch messages',
    });
  }
});

// Send a DM
router.post('/messages', async (req: Request, res: Response<APIResponse<{ id: string }>>) => {
  try {
    const { recipientId, message } = req.body;

    if (!recipientId || !message) {
      res.status(400).json({
        success: false,
        error: 'recipientId and message are required',
      });
      return;
    }

    const result = await instagramService.sendMessage(recipientId, message);
    res.json({
      success: true,
      data: result,
      message: 'Message sent successfully',
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    });
  }
});

export default router;
