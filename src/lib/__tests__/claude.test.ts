// Mock the Anthropic SDK - needs to be before import
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  }));
});

import { categorizeAndSummarizeEmail } from '../claude';

describe('Claude Service', () => {
  const mockCategories = [
    { id: 'cat-work', name: 'Work', description: 'Work-related emails' },
    { id: 'cat-personal', name: 'Personal', description: 'Personal emails' },
    { id: 'cat-promo', name: 'Promotions', description: 'Marketing and promotional emails' },
  ];

  const mockEmail = {
    subject: 'Meeting Tomorrow',
    from: 'boss@company.com',
    snippet: 'Reminder about our meeting tomorrow at 10am',
    bodyText: 'Hi, just a quick reminder about our meeting tomorrow at 10am in conference room B. Please bring your quarterly reports.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('categorizeAndSummarizeEmail', () => {
    it('should categorize email and generate summary successfully', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: 'cat-work',
              summary: 'Meeting reminder for tomorrow at 10am with request to bring quarterly reports.',
            }),
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe('cat-work');
      expect(result.summary).toBe('Meeting reminder for tomorrow at 10am with request to bring quarterly reports.');
    });

    it('should return null categoryId when no category matches', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: null,
              summary: 'Email about weather forecast.',
            }),
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBeNull();
      expect(result.summary).toBe('Email about weather forecast.');
    });

    it('should invalidate categoryId when it does not match any known category', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: 'cat-unknown',
              summary: 'Some summary.',
            }),
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBeNull(); // Should be null since cat-unknown doesn't exist
      expect(result.summary).toBe('Some summary.');
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '```json\n{"categoryId": "cat-personal", "summary": "A personal email."}\n```',
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe('cat-personal');
      expect(result.summary).toBe('A personal email.');
    });

    it('should handle JSON with extra text around it', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Here is my analysis:\n\n{"categoryId": "cat-promo", "summary": "Promotional email."}\n\nLet me know if you need more details.',
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe('cat-promo');
      expect(result.summary).toBe('Promotional email.');
    });

    it('should return default values when API call fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBeNull();
      expect(result.summary).toBe('Unable to generate summary.');
    });

    it('should return default values when response has no text content', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBeNull();
      expect(result.summary).toBe('Unable to generate summary.');
    });

    it('should return default values when JSON parsing fails', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'This is not valid JSON at all',
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBeNull();
      expect(result.summary).toBe('Unable to generate summary.');
    });

    it('should handle empty categories array', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: null,
              summary: 'No categories available.',
            }),
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, []);

      expect(result.categoryId).toBeNull();
      expect(result.summary).toBe('No categories available.');
    });

    it('should handle missing summary in response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: 'cat-work',
            }),
          },
        ],
      });

      const result = await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(result.categoryId).toBe('cat-work');
      expect(result.summary).toBe('Unable to generate summary.');
    });

    it('should truncate long email body to 2000 characters', async () => {
      const longBodyEmail = {
        ...mockEmail,
        bodyText: 'a'.repeat(3000),
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: 'cat-work',
              summary: 'Email with very long body.',
            }),
          },
        ],
      });

      await categorizeAndSummarizeEmail(longBodyEmail, mockCategories);

      // Verify the API was called with truncated content
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      const messageContent = callArgs.messages[0].content;
      // The body in the prompt should be truncated
      expect(messageContent).toContain('a'.repeat(2000));
      expect(messageContent).not.toContain('a'.repeat(2001));
    });

    it('should send correct model and max_tokens parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: 'cat-work',
              summary: 'Test summary.',
            }),
          },
        ],
      });

      await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
        })
      );
    });

    it('should include all category information in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: 'cat-work',
              summary: 'Test.',
            }),
          },
        ],
      });

      await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      const callArgs = mockCreate.mock.calls[0][0];
      const messageContent = callArgs.messages[0].content;

      expect(messageContent).toContain('cat-work');
      expect(messageContent).toContain('Work');
      expect(messageContent).toContain('Work-related emails');
      expect(messageContent).toContain('cat-personal');
      expect(messageContent).toContain('cat-promo');
    });

    it('should include email details in prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              categoryId: 'cat-work',
              summary: 'Test.',
            }),
          },
        ],
      });

      await categorizeAndSummarizeEmail(mockEmail, mockCategories);

      const callArgs = mockCreate.mock.calls[0][0];
      const messageContent = callArgs.messages[0].content;

      expect(messageContent).toContain(mockEmail.subject);
      expect(messageContent).toContain(mockEmail.from);
      expect(messageContent).toContain(mockEmail.snippet);
      expect(messageContent).toContain(mockEmail.bodyText);
    });
  });
});
