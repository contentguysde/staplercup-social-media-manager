import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const enabled = process.env.REGISTRATION_ENABLED !== 'false';
  return res.status(200).json({ enabled });
}
