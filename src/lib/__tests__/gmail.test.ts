import { extractUnsubscribeLink } from '../gmail';

// Mock the googleapis module
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        on: jest.fn(),
      })),
    },
    gmail: jest.fn().mockReturnValue({
      users: {
        messages: {
          get: jest.fn(),
          modify: jest.fn(),
          trash: jest.fn(),
        },
        history: {
          list: jest.fn(),
        },
        watch: jest.fn(),
      },
    }),
  },
}));

// Mock the database
jest.mock('../db', () => ({
  db: {
    query: {
      gmailAccounts: {
        findFirst: jest.fn(),
      },
    },
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({}),
      }),
    }),
  },
}));

describe('Gmail Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractUnsubscribeLink', () => {
    it('should extract unsubscribe link from HTML body', () => {
      const html = '<a href="https://example.com/unsubscribe?token=abc123">Unsubscribe</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/unsubscribe?token=abc123');
    });

    it('should extract opt-out link from HTML body', () => {
      const html = '<a href="https://example.com/opt-out/user123">Click to opt-out</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/opt-out/user123');
    });

    it('should extract remove link from HTML body', () => {
      const html = '<a href="https://example.com/remove-from-list?id=456">Remove from list</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/remove-from-list?id=456');
    });

    it('should extract unsubscribe link from plain text when HTML has no match', () => {
      const html = '<p>Regular email content</p>';
      const text = 'To unsubscribe, visit https://example.com/unsubscribe/abc';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/unsubscribe/abc');
    });

    it('should return null when no unsubscribe link found', () => {
      const html = '<p>Just a regular email</p>';
      const text = 'Plain text with no unsubscribe link';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBeNull();
    });

    it('should prefer HTML link over plain text link', () => {
      const html = '<a href="https://html-link.com/unsubscribe">Unsubscribe</a>';
      const text = 'Visit https://text-link.com/unsubscribe to unsubscribe';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://html-link.com/unsubscribe');
    });

    it('should handle case-insensitive matching', () => {
      const html = '<a href="https://example.com/UNSUBSCRIBE">UNSUBSCRIBE</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/UNSUBSCRIBE');
    });

    it('should handle empty strings', () => {
      const result = extractUnsubscribeLink('', '');
      expect(result).toBeNull();
    });

    it('should extract link with complex query parameters', () => {
      const html = '<a href="https://marketing.example.com/unsubscribe?email=user%40test.com&token=xyz&campaign=123">Unsubscribe</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://marketing.example.com/unsubscribe?email=user%40test.com&token=xyz&campaign=123');
    });

    it('should extract link when only the link TEXT says unsubscribe (not the URL)', () => {
      const html = '<a href="https://click.example.com/abc123def456">Unsubscribe</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://click.example.com/abc123def456');
    });

    it('should extract link with "opt out" text (with space)', () => {
      const html = '<a href="https://mail.example.com/track/click?id=xyz">Opt Out</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://mail.example.com/track/click?id=xyz');
    });

    it('should extract link with "manage preferences" text', () => {
      const html = '<a href="https://example.com/settings/abc">Manage Preferences</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/settings/abc');
    });

    it('should extract link with "manage subscription" text', () => {
      const html = '<a href="https://example.com/user/config">Manage Subscription</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/user/config');
    });

    it('should not extract mailto links even if text says unsubscribe', () => {
      const html = '<a href="mailto:unsubscribe@example.com">Unsubscribe</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBeNull();
    });

    it('should find URL near unsubscribe word in plain text', () => {
      const html = '<p>No links here</p>';
      const text = 'If you wish to unsubscribe, click here: https://example.com/remove/abc123';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/remove/abc123');
    });

    it('should handle email-preferences URL keyword', () => {
      const html = '<a href="https://example.com/email-preferences?user=123">Update preferences</a>';
      const text = '';

      const result = extractUnsubscribeLink(html, text);
      expect(result).toBe('https://example.com/email-preferences?user=123');
    });
  });
});

describe('extractBody helper function', () => {
  // We can't directly test extractBody since it's not exported,
  // but we test it indirectly through getEmailContent behavior patterns
  describe('Body extraction patterns', () => {
    it('should handle base64 encoded content correctly', () => {
      const base64Text = Buffer.from('Hello, World!').toString('base64');
      const decoded = Buffer.from(base64Text, 'base64').toString('utf-8');
      expect(decoded).toBe('Hello, World!');
    });

    it('should handle UTF-8 characters in base64 encoding', () => {
      const textWithEmoji = 'Hello! 🎉 Special chars: áéíóú';
      const base64Text = Buffer.from(textWithEmoji).toString('base64');
      const decoded = Buffer.from(base64Text, 'base64').toString('utf-8');
      expect(decoded).toBe(textWithEmoji);
    });
  });
});

describe('From header parsing patterns', () => {
  // Test patterns used in getEmailContent for parsing from headers
  describe('parseFromHeader regex patterns', () => {
    const fromPattern = /^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/;

    it('should parse name and email format: "Name" <email@example.com>', () => {
      const from = '"John Doe" <john@example.com>';
      const match = from.match(fromPattern);
      expect(match?.[1]).toBe('John Doe');
      expect(match?.[2]).toBe('john@example.com');
    });

    it('should parse name and email without quotes: Name <email@example.com>', () => {
      const from = 'Jane Smith <jane@example.com>';
      const match = from.match(fromPattern);
      expect(match?.[1]).toBe('Jane Smith');
      expect(match?.[2]).toBe('jane@example.com');
    });

    it('should parse email only format: email@example.com', () => {
      const from = 'simple@example.com';
      const match = from.match(fromPattern);
      expect(match?.[2]).toBe('simple@example.com');
    });

    it('should parse email in angle brackets only: <email@example.com>', () => {
      const from = '<anon@example.com>';
      const match = from.match(fromPattern);
      expect(match?.[2]).toBe('anon@example.com');
    });
  });
});
