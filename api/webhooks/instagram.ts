import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// Webhook verification token - must match what you set in Meta App Dashboard
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'staplercup_webhook_2024';
const APP_SECRET = process.env.META_APP_SECRET;

/**
 * Instagram Webhook Handler
 *
 * This endpoint receives real-time notifications from Instagram when:
 * - New comments are posted on your media
 * - Comments are edited or deleted
 * - New mentions occur
 *
 * Setup in Meta App Dashboard:
 * 1. Go to your app > Webhooks
 * 2. Subscribe to "Instagram" webhooks
 * 3. Add callback URL: https://your-domain.vercel.app/api/webhooks/instagram
 * 4. Set verify token to match WEBHOOK_VERIFY_TOKEN
 * 5. Subscribe to: comments, mentions
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET request = Webhook verification from Meta
  if (req.method === 'GET') {
    return handleVerification(req, res);
  }

  // POST request = Incoming webhook event
  if (req.method === 'POST') {
    return handleWebhookEvent(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Handle webhook verification challenge from Meta
 * Meta sends: hub.mode, hub.verify_token, hub.challenge
 */
function handleVerification(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification request:', { mode, token, challenge: challenge ? 'present' : 'missing' });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    // Must return the challenge as plain text
    return res.status(200).send(challenge);
  }

  console.error('Webhook verification failed - token mismatch');
  return res.status(403).json({ error: 'Verification failed' });
}

/**
 * Verify webhook signature to ensure request is from Meta
 */
function verifySignature(req: VercelRequest, body: string): boolean {
  if (!APP_SECRET) {
    console.warn('META_APP_SECRET not configured - skipping signature verification');
    return true; // Allow in development, but log warning
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    console.error('No signature header present');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Handle incoming webhook events from Instagram
 */
async function handleWebhookEvent(req: VercelRequest, res: VercelResponse) {
  const body = JSON.stringify(req.body);

  // Verify signature
  if (!verifySignature(req, body)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body;
  console.log('Webhook received:', JSON.stringify(payload, null, 2));

  // Must respond with 200 quickly to acknowledge receipt
  // Process asynchronously to avoid timeout
  res.status(200).json({ received: true });

  // Process the webhook event
  try {
    await processWebhookPayload(payload);
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Don't throw - we already sent 200 response
  }
}

/**
 * Process the webhook payload and store relevant data
 */
async function processWebhookPayload(payload: any) {
  // Ensure the webhook_comments table exists
  await ensureWebhookTable();

  const { object, entry } = payload;

  // We only care about Instagram events
  if (object !== 'instagram') {
    console.log('Ignoring non-Instagram webhook:', object);
    return;
  }

  for (const entryItem of entry || []) {
    const { id: accountId, time, changes } = entryItem;

    for (const change of changes || []) {
      const { field, value } = change;

      if (field === 'comments') {
        await processCommentEvent(accountId, value, time);
      } else if (field === 'mentions') {
        await processMentionEvent(accountId, value, time);
      } else {
        console.log('Unhandled webhook field:', field);
      }
    }
  }
}

/**
 * Process a comment webhook event
 */
async function processCommentEvent(accountId: string, value: any, timestamp: number) {
  const { id: commentId, text, from, media } = value;

  console.log('Processing comment:', { commentId, text: text?.substring(0, 50), from, media });

  // Skip if this is a delete event (no text)
  if (!text) {
    console.log('Skipping comment event without text (likely deletion)');
    return;
  }

  try {
    // Insert or update the comment
    await sql`
      INSERT INTO webhook_comments (
        comment_id,
        media_id,
        account_id,
        text,
        from_id,
        from_username,
        timestamp,
        event_type,
        raw_payload
      ) VALUES (
        ${commentId},
        ${media?.id || null},
        ${accountId},
        ${text},
        ${from?.id || null},
        ${from?.username || null},
        ${new Date(timestamp * 1000).toISOString()},
        'comment',
        ${JSON.stringify(value)}
      )
      ON CONFLICT (comment_id) DO UPDATE SET
        text = EXCLUDED.text,
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log('Comment stored successfully:', commentId);
  } catch (error) {
    console.error('Error storing comment:', error);
    throw error;
  }
}

/**
 * Process a mention webhook event
 */
async function processMentionEvent(accountId: string, value: any, timestamp: number) {
  const { comment_id: commentId, media_id: mediaId } = value;

  console.log('Processing mention:', { commentId, mediaId });

  try {
    await sql`
      INSERT INTO webhook_comments (
        comment_id,
        media_id,
        account_id,
        text,
        from_id,
        from_username,
        timestamp,
        event_type,
        raw_payload
      ) VALUES (
        ${commentId || `mention_${mediaId}_${timestamp}`},
        ${mediaId},
        ${accountId},
        ${null},
        ${null},
        ${null},
        ${new Date(timestamp * 1000).toISOString()},
        'mention',
        ${JSON.stringify(value)}
      )
      ON CONFLICT (comment_id) DO NOTHING
    `;

    console.log('Mention stored successfully');
  } catch (error) {
    console.error('Error storing mention:', error);
    throw error;
  }
}

/**
 * Ensure the webhook_comments table exists
 */
async function ensureWebhookTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS webhook_comments (
        id SERIAL PRIMARY KEY,
        comment_id VARCHAR(255) UNIQUE NOT NULL,
        media_id VARCHAR(255),
        account_id VARCHAR(255),
        text TEXT,
        from_id VARCHAR(255),
        from_username VARCHAR(255),
        timestamp TIMESTAMP NOT NULL,
        event_type VARCHAR(50) DEFAULT 'comment',
        processed BOOLEAN DEFAULT FALSE,
        raw_payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_comments_timestamp
      ON webhook_comments(timestamp DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_comments_processed
      ON webhook_comments(processed)
    `;
  } catch (error) {
    // Table might already exist
    console.log('Table setup:', error);
  }
}
