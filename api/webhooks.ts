import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import * as crypto from 'crypto';

// Webhook verification token - must match what you set in Meta App Dashboard
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'staplercup_webhook_2024';
const APP_SECRET = process.env.META_APP_SECRET;

/**
 * Unified Webhook Handler for Instagram and Facebook
 *
 * Routes:
 * - /api/webhooks?platform=instagram - Instagram webhooks
 * - /api/webhooks?platform=facebook - Facebook Page webhooks
 *
 * Setup in Meta App Dashboard:
 * 1. Go to your app > Webhooks
 * 2. For Instagram: Subscribe to "Instagram" webhooks, subscribe to: comments, mentions
 * 3. For Facebook: Subscribe to "Page" webhooks, subscribe to: feed
 * 4. Set callback URL to: https://your-domain.vercel.app/api/webhooks?platform=instagram (or facebook)
 * 5. Set verify token to match WEBHOOK_VERIFY_TOKEN
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const platform = (req.query.platform as string) || 'instagram';

  // GET request = Webhook verification from Meta
  if (req.method === 'GET') {
    return handleVerification(req, res, platform);
  }

  // POST request = Incoming webhook event
  if (req.method === 'POST') {
    return handleWebhookEvent(req, res, platform);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Handle webhook verification challenge from Meta
 */
function handleVerification(req: VercelRequest, res: VercelResponse, platform: string) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`${platform} Webhook verification request:`, { mode, token, challenge: challenge ? 'present' : 'missing' });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log(`${platform} Webhook verified successfully`);
    return res.status(200).send(challenge);
  }

  console.error(`${platform} Webhook verification failed - token mismatch`);
  return res.status(403).json({ error: 'Verification failed' });
}

/**
 * Verify webhook signature to ensure request is from Meta
 */
function verifySignature(req: VercelRequest, body: string): boolean {
  if (!APP_SECRET) {
    console.warn('META_APP_SECRET not configured - skipping signature verification');
    return true;
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
 * Handle incoming webhook events
 */
async function handleWebhookEvent(req: VercelRequest, res: VercelResponse, platform: string) {
  const body = JSON.stringify(req.body);

  if (!verifySignature(req, body)) {
    console.error(`Invalid ${platform} webhook signature`);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body;
  console.log(`${platform} Webhook received:`, JSON.stringify(payload, null, 2));

  // Respond immediately to acknowledge receipt
  res.status(200).json({ received: true });

  try {
    await processWebhookPayload(payload, platform);
  } catch (error) {
    console.error(`Error processing ${platform} webhook:`, error);
  }
}

/**
 * Process the webhook payload and store relevant data
 */
async function processWebhookPayload(payload: any, platform: string) {
  await ensureWebhookTable();

  const { object, entry } = payload;

  // Route to the correct processor based on object type
  if (object === 'instagram') {
    await processInstagramPayload(entry);
  } else if (object === 'page') {
    await processFacebookPayload(entry);
  } else {
    console.log(`Ignoring webhook object type: ${object}`);
  }
}

/**
 * Process Instagram webhook entries
 */
async function processInstagramPayload(entries: any[]) {
  for (const entryItem of entries || []) {
    const { id: accountId, time, changes } = entryItem;

    for (const change of changes || []) {
      const { field, value } = change;

      if (field === 'comments') {
        await processInstagramComment(accountId, value, time);
      } else if (field === 'mentions') {
        await processInstagramMention(accountId, value, time);
      } else {
        console.log('Unhandled Instagram webhook field:', field);
      }
    }
  }
}

/**
 * Process Facebook webhook entries
 */
async function processFacebookPayload(entries: any[]) {
  for (const entryItem of entries || []) {
    const { id: pageId, time, changes } = entryItem;

    for (const change of changes || []) {
      const { field, value } = change;

      if (field === 'feed') {
        await processFacebookFeedEvent(pageId, value, time);
      } else {
        console.log('Unhandled Facebook webhook field:', field);
      }
    }
  }
}

/**
 * Process Instagram comment event
 */
async function processInstagramComment(accountId: string, value: any, timestamp: number) {
  const { id: commentId, text, from, media } = value;

  console.log('Processing Instagram comment:', { commentId, text: text?.substring(0, 50), from, media });

  if (!text) {
    console.log('Skipping comment event without text (likely deletion)');
    return;
  }

  try {
    await sql`
      INSERT INTO webhook_comments (
        comment_id, media_id, account_id, text, from_id, from_username,
        timestamp, event_type, platform, raw_payload
      ) VALUES (
        ${commentId}, ${media?.id || null}, ${accountId}, ${text},
        ${from?.id || null}, ${from?.username || null},
        ${new Date(timestamp * 1000).toISOString()}, 'comment', 'instagram',
        ${JSON.stringify(value)}
      )
      ON CONFLICT (comment_id) DO UPDATE SET
        text = EXCLUDED.text,
        updated_at = CURRENT_TIMESTAMP
    `;
    console.log('Instagram comment stored:', commentId);
  } catch (error) {
    console.error('Error storing Instagram comment:', error);
    throw error;
  }
}

/**
 * Process Instagram mention event
 */
async function processInstagramMention(accountId: string, value: any, timestamp: number) {
  const { comment_id: commentId, media_id: mediaId } = value;

  console.log('Processing Instagram mention:', { commentId, mediaId });

  try {
    await sql`
      INSERT INTO webhook_comments (
        comment_id, media_id, account_id, text, from_id, from_username,
        timestamp, event_type, platform, raw_payload
      ) VALUES (
        ${commentId || `mention_${mediaId}_${timestamp}`}, ${mediaId}, ${accountId},
        ${null}, ${null}, ${null},
        ${new Date(timestamp * 1000).toISOString()}, 'mention', 'instagram',
        ${JSON.stringify(value)}
      )
      ON CONFLICT (comment_id) DO NOTHING
    `;
    console.log('Instagram mention stored');
  } catch (error) {
    console.error('Error storing Instagram mention:', error);
    throw error;
  }
}

/**
 * Process Facebook feed event (includes comments)
 */
async function processFacebookFeedEvent(pageId: string, value: any, timestamp: number) {
  const { item, verb, comment_id, post_id, from, message, created_time } = value;

  console.log('Processing Facebook feed event:', { item, verb, comment_id, post_id, from });

  if (item === 'comment') {
    if (verb === 'add' || verb === 'edited') {
      if (!message) {
        console.log('Skipping Facebook comment without message');
        return;
      }

      try {
        await sql`
          INSERT INTO webhook_comments (
            comment_id, media_id, account_id, text, from_id, from_username,
            timestamp, event_type, platform, raw_payload
          ) VALUES (
            ${comment_id}, ${post_id}, ${pageId}, ${message},
            ${from?.id || null}, ${from?.name || null},
            ${new Date(created_time * 1000).toISOString()}, 'comment', 'facebook',
            ${JSON.stringify(value)}
          )
          ON CONFLICT (comment_id) DO UPDATE SET
            text = EXCLUDED.text,
            updated_at = CURRENT_TIMESTAMP
        `;
        console.log('Facebook comment stored:', comment_id);
      } catch (error) {
        console.error('Error storing Facebook comment:', error);
        throw error;
      }
    } else if (verb === 'remove') {
      try {
        await sql`
          UPDATE webhook_comments
          SET deleted = TRUE, updated_at = CURRENT_TIMESTAMP
          WHERE comment_id = ${comment_id}
        `;
        console.log('Facebook comment marked as deleted:', comment_id);
      } catch (error) {
        console.error('Error marking comment as deleted:', error);
      }
    }
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
        platform VARCHAR(50) DEFAULT 'instagram',
        processed BOOLEAN DEFAULT FALSE,
        deleted BOOLEAN DEFAULT FALSE,
        raw_payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add columns if they don't exist (for existing tables)
    try {
      await sql`ALTER TABLE webhook_comments ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'instagram'`;
      await sql`ALTER TABLE webhook_comments ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE`;
    } catch {
      // Columns might already exist
    }

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_webhook_comments_timestamp ON webhook_comments(timestamp DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_webhook_comments_platform ON webhook_comments(platform)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_webhook_comments_processed ON webhook_comments(processed)`;
  } catch (error) {
    console.log('Webhook table setup:', error);
  }
}
