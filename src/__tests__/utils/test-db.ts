import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@/lib/db/schema';

// Create a test database in memory
export async function createTestDb() {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema });

  // Create tables
  await pglite.exec(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      email_verified TIMESTAMP,
      image TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER,
      history_id TEXT,
      watch_expiration TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      gmail_account_id UUID NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
      gmail_id TEXT NOT NULL UNIQUE,
      thread_id TEXT,
      category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      from_address TEXT,
      from_name TEXT,
      subject TEXT,
      snippet TEXT,
      body_text TEXT,
      body_html TEXT,
      summary TEXT,
      received_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      is_read BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `);

  return { db, pglite };
}

type TestDb = Awaited<ReturnType<typeof createTestDb>>['db'];

// Create test data helpers
export async function createTestUser(db: TestDb, data?: Partial<typeof schema.users.$inferInsert>) {
  const user = {
    id: crypto.randomUUID(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    createdAt: new Date(),
    ...data,
  };

  await db.insert(schema.users).values(user);
  return user;
}

export async function createTestGmailAccount(db: TestDb, userId: string, data?: Partial<typeof schema.gmailAccounts.$inferInsert>) {
  const account = {
    id: crypto.randomUUID(),
    userId,
    email: `test-${Date.now()}@gmail.com`,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    historyId: '12345',
    createdAt: new Date(),
    ...data,
  };

  await db.insert(schema.gmailAccounts).values(account);
  return account;
}

export async function createTestCategory(db: TestDb, userId: string, data?: Partial<typeof schema.categories.$inferInsert>) {
  const category = {
    id: crypto.randomUUID(),
    userId,
    name: 'Test Category',
    description: 'A test category for testing',
    color: '#6366f1',
    createdAt: new Date(),
    ...data,
  };

  await db.insert(schema.categories).values(category);
  return category;
}

export async function createTestEmail(db: TestDb, gmailAccountId: string, categoryId: string | null, data?: Partial<typeof schema.emails.$inferInsert>) {
  const email = {
    id: crypto.randomUUID(),
    gmailAccountId,
    gmailId: `gmail-${Date.now()}`,
    threadId: `thread-${Date.now()}`,
    categoryId,
    fromAddress: 'sender@example.com',
    fromName: 'Test Sender',
    subject: 'Test Email Subject',
    snippet: 'This is a test email snippet...',
    bodyText: 'This is the full body text of the test email.',
    bodyHtml: '<p>This is the full body text of the test email.</p>',
    summary: 'A summary of the test email.',
    receivedAt: new Date(),
    createdAt: new Date(),
    isRead: false,
    isDeleted: false,
    ...data,
  };

  await db.insert(schema.emails).values(email);
  return email;
}
