import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDatabase, findUserByEmail, createUser, getUserCount } from './_lib/db';
import { hashPassword } from './_lib/auth';

interface AdditionalUser {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests with a secret key for security
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { initSecret, adminEmail, adminPassword, adminName, additionalUsers } = req.body;

  // Require a secret to prevent unauthorized initialization
  const expectedSecret = process.env.INIT_SECRET || 'staplercup-init-2024';
  if (initSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid init secret' });
  }

  try {
    // Initialize database tables
    await initDatabase();

    const results: string[] = ['Database tables created/verified'];

    // Check if we need to create an admin user
    const userCount = await getUserCount();

    if (userCount === 0 && adminEmail && adminPassword && adminName) {
      // Create the first admin user
      const passwordHash = await hashPassword(adminPassword);
      await createUser({
        email: adminEmail,
        passwordHash,
        name: adminName,
        role: 'admin',
        emailVerified: 1,
      });
      results.push(`Admin user created: ${adminEmail}`);
    } else if (userCount === 0) {
      results.push('No users exist. Provide adminEmail, adminPassword, and adminName to create an admin.');
    } else {
      const existingAdmin = await findUserByEmail(adminEmail || '');
      if (existingAdmin) {
        results.push(`Admin user already exists: ${adminEmail}`);
      } else {
        results.push(`${userCount} user(s) already exist in database`);
      }
    }

    // Create additional users if provided
    if (additionalUsers && Array.isArray(additionalUsers)) {
      for (const user of additionalUsers as AdditionalUser[]) {
        if (user.email && user.password && user.name && user.role) {
          const existingUser = await findUserByEmail(user.email);
          if (existingUser) {
            results.push(`User already exists: ${user.email}`);
          } else {
            const passwordHash = await hashPassword(user.password);
            await createUser({
              email: user.email,
              passwordHash,
              name: user.name,
              role: user.role,
              emailVerified: 1,
            });
            results.push(`User created: ${user.email} (${user.role})`);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Initialization complete',
      results,
    });
  } catch (error) {
    console.error('Init error:', error);
    return res.status(500).json({
      error: 'Initialization failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
