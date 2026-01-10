import type { EmailMessage } from '@/lib/gmail';

// Mock Gmail message data
export const mockGmailMessage = {
  data: {
    id: 'msg-12345',
    threadId: 'thread-12345',
    snippet: 'This is a test email snippet',
    labelIds: ['INBOX', 'UNREAD'],
    payload: {
      headers: [
        { name: 'Subject', value: 'Test Email Subject' },
        { name: 'From', value: 'John Doe <john@example.com>' },
        { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 +0000' },
      ],
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: Buffer.from('This is the plain text body').toString('base64'),
          },
        },
        {
          mimeType: 'text/html',
          body: {
            data: Buffer.from('<p>This is the HTML body</p>').toString('base64'),
          },
        },
      ],
    },
  },
};

export const mockEmailMessage: EmailMessage = {
  id: 'msg-12345',
  threadId: 'thread-12345',
  snippet: 'This is a test email snippet',
  subject: 'Test Email Subject',
  from: {
    name: 'John Doe',
    email: 'john@example.com',
  },
  bodyText: 'This is the plain text body',
  bodyHtml: '<p>This is the HTML body</p>',
  receivedAt: new Date('2024-01-01T12:00:00Z'),
  labelIds: ['INBOX', 'UNREAD'],
};

// Mock Gmail history response
export const mockHistoryResponse = {
  data: {
    historyId: '67890',
    history: [
      {
        messagesAdded: [
          { message: { id: 'msg-new-1' } },
          { message: { id: 'msg-new-2' } },
        ],
      },
    ],
  },
};

// Mock Gmail watch response
export const mockWatchResponse = {
  data: {
    historyId: '12345',
    expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
};

// Mock Claude API response
export const mockClaudeResponse = {
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({
        categoryId: 'cat-123',
        summary: 'This is a test email summary.',
      }),
    },
  ],
};

export const mockClaudeResponseNoCategory = {
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({
        categoryId: null,
        summary: 'This email does not match any category.',
      }),
    },
  ],
};

// Create mock Gmail client
export function createMockGmailClient() {
  return {
    users: {
      messages: {
        get: jest.fn().mockResolvedValue(mockGmailMessage),
        modify: jest.fn().mockResolvedValue({}),
        trash: jest.fn().mockResolvedValue({}),
        list: jest.fn().mockResolvedValue({
          data: { messages: [{ id: 'msg-1' }, { id: 'msg-2' }] },
        }),
      },
      history: {
        list: jest.fn().mockResolvedValue(mockHistoryResponse),
      },
      watch: jest.fn().mockResolvedValue(mockWatchResponse),
    },
  };
}

// Create mock Anthropic client
export function createMockAnthropicClient() {
  return {
    messages: {
      create: jest.fn().mockResolvedValue(mockClaudeResponse),
    },
  };
}

// Mock session for NextAuth
export const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export const mockUnauthenticatedSession = null;

// Mock Next.js request/response helpers
export function createMockRequest(options: {
  method?: string;
  body?: unknown;
  searchParams?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const { method = 'GET', body, searchParams = {}, headers = {} } = options;

  const url = new URL('http://localhost:3000/api/test');
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return {
    method,
    url: url.toString(),
    json: async () => body,
    nextUrl: url,
    headers: new Headers(headers),
  } as unknown as Request;
}

// Wait helper for async tests
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
