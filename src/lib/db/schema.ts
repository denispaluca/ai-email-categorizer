import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Users table (managed by NextAuth)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// NextAuth accounts table
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

// NextAuth sessions table
export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

// NextAuth verification tokens (uses composite key of identifier + token)
export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
}, (vt) => []);

// Connected Gmail accounts (can be multiple per user)
export const gmailAccounts = sqliteTable("gmail_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at"),
  historyId: text("history_id"),
  watchExpiration: integer("watch_expiration", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// User-defined categories
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Imported emails
export const emails = sqliteTable("emails", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  gmailAccountId: text("gmail_account_id").notNull().references(() => gmailAccounts.id, { onDelete: "cascade" }),
  gmailId: text("gmail_id").notNull().unique(),
  threadId: text("thread_id"),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  fromAddress: text("from_address"),
  fromName: text("from_name"),
  subject: text("subject"),
  snippet: text("snippet"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  summary: text("summary"),
  receivedAt: integer("received_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  isRead: integer("is_read", { mode: "boolean" }).default(false),
  isDeleted: integer("is_deleted", { mode: "boolean" }).default(false),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  gmailAccounts: many(gmailAccounts),
  categories: many(categories),
}));

export const gmailAccountsRelations = relations(gmailAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [gmailAccounts.userId],
    references: [users.id],
  }),
  emails: many(emails),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  emails: many(emails),
}));

export const emailsRelations = relations(emails, ({ one }) => ({
  gmailAccount: one(gmailAccounts, {
    fields: [emails.gmailAccountId],
    references: [gmailAccounts.id],
  }),
  category: one(categories, {
    fields: [emails.categoryId],
    references: [categories.id],
  }),
}));
