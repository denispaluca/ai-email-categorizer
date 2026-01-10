import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@/lib/db/schema';

// Create a test database in memory
export function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER,
      image TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER,
      history_id TEXT,
      watch_expiration INTEGER,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      gmail_account_id TEXT NOT NULL REFERENCES gmail_accounts(id) ON DELETE CASCADE,
      gmail_id TEXT NOT NULL UNIQUE,
      thread_id TEXT,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      from_address TEXT,
      from_name TEXT,
      subject TEXT,
      snippet TEXT,
      body_text TEXT,
      body_html TEXT,
      summary TEXT,
      received_at INTEGER,
      created_at INTEGER,
      is_read INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0
    );
  `);

  return { db, sqlite };
}

// Create test data helpers
export function createTestUser(db: ReturnType<typeof drizzle>, data?: Partial<typeof schema.users.$inferInsert>) {
  const user = {
    id: crypto.randomUUID(),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    createdAt: new Date(),
    ...data,
  };

  db.insert(schema.users).values(user).run();
  return user;
}

export function createTestGmailAccount(db: ReturnType<typeof drizzle>, userId: string, data?: Partial<typeof schema.gmailAccounts.$inferInsert>) {
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

  db.insert(schema.gmailAccounts).values(account).run();
  return account;
}

export function createTestCategory(db: ReturnType<typeof drizzle>, userId: string, data?: Partial<typeof schema.categories.$inferInsert>) {
  const category = {
    id: crypto.randomUUID(),
    userId,
    name: 'Test Category',
    description: 'A test category for testing',
    color: '#6366f1',
    createdAt: new Date(),
    ...data,
  };

  db.insert(schema.categories).values(category).run();
  return category;
}

export function createTestEmail(db: ReturnType<typeof drizzle>, gmailAccountId: string, categoryId: string | null, data?: Partial<typeof schema.emails.$inferInsert>) {
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

  db.insert(schema.emails).values(email).run();
  return email;
}
