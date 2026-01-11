import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table (managed by NextAuth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

// NextAuth accounts table
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

// NextAuth verification tokens
export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

// Connected Gmail accounts (can be multiple per user)
export const gmailAccounts = pgTable("gmail_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at"),
  historyId: text("history_id"),
  watchExpiration: timestamp("watch_expiration"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User-defined categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Imported emails
export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  gmailAccountId: uuid("gmail_account_id")
    .notNull()
    .references(() => gmailAccounts.id, { onDelete: "cascade" }),
  gmailId: text("gmail_id").notNull().unique(),
  threadId: text("thread_id"),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  fromAddress: text("from_address"),
  fromName: text("from_name"),
  subject: text("subject"),
  snippet: text("snippet"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  summary: text("summary"),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").defaultNow(),
  isRead: boolean("is_read").default(false),
  isDeleted: boolean("is_deleted").default(false),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  gmailAccounts: many(gmailAccounts),
  categories: many(categories),
}));

export const gmailAccountsRelations = relations(
  gmailAccounts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [gmailAccounts.userId],
      references: [users.id],
    }),
    emails: many(emails),
  }),
);

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
