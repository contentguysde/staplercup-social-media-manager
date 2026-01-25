import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// Webhook verification token - must match what you set in Meta App Dashboard
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'staplercup_webhook_2024';
const APP_SECRET = process.env.META_APP_SECRET;

/**
 * Facebook Page Webhook Handler
 *
 * This endpoint receives real-time notifications from Facebook when:
 * - New comments are posted on your Page posts
 * - Comments are edited or deleted
 * - New reactions occur
 *
 * Setup in Meta App Dashboard:
 * 1. Go to your app > Webhooks
 * 2. Subscribe to "Page" webhooks
 * 3. Add callback URL: https://your-domain.vercel.app/api/webhooks/facebook
 * 4. Set verify token to match WEBHOOK_VERIFY_TOKEN
 * 5. Subscribe to: feed (for post comments)
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

  console.log('Facebook Webhook verification request:', { mode, token, challenge: challenge ? 'present' : 'missing' });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Facebook Webhook verified successfully');
    // Must return the challenge as plain text
    return res.status(200).send(challenge);
  }

  console.error('Facebook Webhook verification failed - token mismatch');
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
 * Handle incoming webhook events from Facebook
 */
async function handleWebhookEvent(req: VercelRequest, res: VercelResponse) {
  const body = JSON.stringify(req.body);

  // Verify signature
  if (!verifySignature(req, body)) {
    console.error('Invalid Facebook webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body;
  console.log('Facebook Webhook received:', JSON.stringify(payload, null, 2));

  // Must respond with 200 quickly to acknowledge receipt
  // Process asynchronously to avoid timeout
  res.status(200).json({ received: true });

  // Process the webhook event
  try {
    await processWebhookPayload(payload);
  } catch (error) {
    console.error('Error processing Facebook webhook:', error);
    // Don't throw - we already sent 200 response
  }
}

/**
 * Process the webhook payload and store relevant data
 */
async function processWebhookPayload(payload: any) {
  // Ensure the webhook_comments table exists with platform column
  await ensureWebhookTable();

  const { object, entry } = payload;

  // We only care about Page events
  if (object !== 'page') {
    console.log('Ignoring non-Page webhook:', object);
    return;
  }

  for (const entryItem of entry || []) {
    const { id: pageId, time, changes } = entryItem;

    for (const change of changes || []) {
      const { field, value } = change;

      if (field === 'feed') {
        // Feed events include comments on posts
        await processFeedEvent(pageId, value, time);
      } else {
        console.log('Unhandled Facebook webhook field:', field);
      }
    }
  }
}

/**
 * Process a feed webhook event (includes comments)
 */
async function processFeedEvent(pageId: string, value: any, timestamp: number) {
  const { item, verb, comment_id, post_id, from, message, created_time } = value;

  console.log('Processing Facebook feed event:', { item, verb, comment_id, post_id, from });

  // We're interested in comment events
  if (item === 'comment') {
    if (verb === 'add' || verb === 'edited') {
      await storeComment(pageId, {
        commentId: comment_id,
        postId: post_id,
        text: message,
        from,
        createdTime: created_time,
        rawPayload: value,
      });
    } else if (verb === 'remove') {
      // Mark comment as deleted
      await markCommentDeleted(comment_id);
    }
  }
}

/**
 * Store a Facebook comment in the database
 */
async function storeComment(pageId: string, data: {
  commentId: string;
  postId: string;
  text: string;
  from: { id: string; name: string };
  createdTime: number;
  rawPayload: any;
}) {
  const { commentId, postId, text, from, createdTime, rawPayload } = data;

  // Skip if no text (likely a deletion event that slipped through)
  if (!text) {
    console.log('Skipping Facebook comment without text');
    return;
  }

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
        platform,
        raw_payload
      ) VALUES (
        ${commentId},
        ${postId},
        ${pageId},
        ${text},
        ${from?.id || null},
        ${from?.name || null},
        ${new Date(createdTime * 1000).toISOString()},
        'comment',
        'facebook',
        ${JSON.stringify(rawPayload)}
      )
      ON CONFLICT (comment_id) DO UPDATE SET
        text = EXCLUDED.text,
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log('Facebook comment stored successfully:', commentId);
  } catch (error) {
    console.error('Error storing Facebook comment:', error);
    throw error;
  }
}

/**
 * Mark a comment as deleted
 */
async function markCommentDeleted(commentId: string) {
  try {
    await sql`
      UPDATE webhook_comments
      SET deleted = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE comment_id = ${commentId}
    `;
    console.log('Facebook comment marked as deleted:', commentId);
  } catch (error) {
    console.error('Error marking comment as deleted:', error);
  }
}

/**
 * Ensure the webhook_comments table exists with platform column
 */
async function ensureWebhookTable() {
  try {
    // Create table if not exists
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
        platform VARCHAR(50) DEFAULT 'instagram',
        processed BOOLEAN DEFAULT FALSE,
        deleted BOOLEAN DEFAULT FALSE,
        raw_payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add platform column if it doesn't exist (for existing tables)
    try {
      await sql`ALTER TABLE webhook_comments ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'instagram'`;
    } catch {
      // Column might already exist
    }

    // Add deleted column if it doesn't exist
    try {
      await sql`ALTER TABLE webhook_comments ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE`;
    } catch {
      // Column might already exist
    }

    // Create indexes for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_comments_timestamp
      ON webhook_comments(timestamp DESC)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_comments_platform
      ON webhook_comments(platform)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_comments_processed
      ON webhook_comments(processed)
    `;
  } catch (error) {
    // Table might already exist
    console.log('Facebook webhook table setup:', error);
  }
}
