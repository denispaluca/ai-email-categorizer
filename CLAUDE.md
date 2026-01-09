# AI Email Sorter

An AI-powered email sorting application that automatically categorizes and summarizes Gmail emails using Claude.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite with Drizzle ORM
- **Auth**: NextAuth.js with Google OAuth
- **AI**: Anthropic Claude API
- **Styling**: Tailwind CSS
- **Email**: Gmail API with Pub/Sub push notifications

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page with Google sign-in
│   ├── dashboard/page.tsx          # Main dashboard
│   ├── categories/
│   │   ├── new/page.tsx            # Create category form
│   │   └── [id]/
│   │       ├── page.tsx            # Category detail with emails
│   │       └── edit/page.tsx       # Edit category
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth handlers
│       ├── categories/             # Category CRUD
│       ├── emails/                 # Email operations
│       ├── sync/                   # Manual email sync
│       ├── accounts/watch/         # Gmail push setup
│       └── webhooks/gmail/         # Pub/Sub webhook receiver
├── components/                     # React components
├── lib/
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema definitions
│   │   └── index.ts                # Database connection
│   ├── auth.ts                     # NextAuth configuration
│   ├── gmail.ts                    # Gmail API service
│   ├── claude.ts                   # Claude AI service
│   └── email-processor.ts          # Email processing pipeline
└── types/
    └── next-auth.d.ts              # NextAuth type extensions
```

## Key Files

- `src/lib/db/schema.ts` - Database schema (users, gmail_accounts, categories, emails)
- `src/lib/auth.ts` - OAuth config with Gmail scopes, auto watch setup on sign-in
- `src/lib/gmail.ts` - Gmail API: fetch, archive, delete, watch setup
- `src/lib/claude.ts` - AI categorization and summarization
- `src/lib/email-processor.ts` - Processes new emails through AI pipeline

## Environment Variables

Required in `.env.local`:
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret>
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
ANTHROPIC_API_KEY=<your-api-key>
GOOGLE_CLOUD_PROJECT_ID=<project-id>
```

## Google Cloud Setup

1. Enable Gmail API and Cloud Pub/Sub API
2. Create OAuth 2.0 credentials with redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Add test users in OAuth consent screen
4. Create Pub/Sub topic `gmail-notifications`
5. Grant `gmail-api-push@system.gserviceaccount.com` Publisher role on topic
6. Create push subscription to `https://<ngrok-url>/api/webhooks/gmail`

## Development with Push Notifications

```bash
# Terminal 1: Start ngrok
ngrok http 3000

# Terminal 2: Start dev server
npm run dev
```

Update Pub/Sub subscription URL to ngrok URL when it changes.

## Email Processing Flow

1. User signs in → Gmail account created → Watch automatically set up
2. New email arrives → Pub/Sub pushes to `/api/webhooks/gmail`
3. Webhook fetches email via Gmail API
4. Claude categorizes based on user's category descriptions
5. Claude generates summary
6. Email stored in database, archived in Gmail
