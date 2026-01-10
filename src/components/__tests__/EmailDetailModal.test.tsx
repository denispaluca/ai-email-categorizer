import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailDetailModal } from '../EmailDetailModal';

// Mock next/navigation
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('EmailDetailModal Component', () => {
  const mockEmail = {
    id: 'email-123',
    gmailAccountId: 'gmail-1',
    gmailId: 'gmail-msg-123',
    fromAddress: 'sender@example.com',
    fromName: 'Test Sender',
    subject: 'Test Email Subject',
    summary: 'AI generated summary of the email',
    receivedAt: new Date('2024-01-15T10:30:00'),
  };

  const mockEmailDetail = {
    id: 'email-123',
    subject: 'Test Email Subject',
    fromAddress: 'sender@example.com',
    fromName: 'Test Sender',
    summary: 'AI generated summary',
    bodyHtml: '<p>This is the HTML body of the email.</p>',
    bodyText: 'This is the plain text body of the email.',
    receivedAt: new Date('2024-01-15T10:30:00'),
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/read')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockEmailDetail,
      });
    });
  });

  describe('Rendering', () => {
    it('should render email subject', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      expect(screen.getByText('Test Email Subject')).toBeInTheDocument();
    });

    it('should render sender information', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      expect(screen.getByText(/Test Sender/)).toBeInTheDocument();
    });

    it('should render AI summary section', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      expect(screen.getByText('AI Summary')).toBeInTheDocument();
      expect(screen.getByText('AI generated summary of the email')).toBeInTheDocument();
    });

    it('should render close button', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('should show loading state initially', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      // Should show loading spinner
      const loadingSpinner = document.querySelector('.animate-spin');
      expect(loadingSpinner).toBeInTheDocument();
    });

    it('should show "(No Subject)" for missing subject', async () => {
      const emailWithoutSubject = { ...mockEmail, subject: null };
      render(<EmailDetailModal email={emailWithoutSubject} onClose={mockOnClose} />);

      expect(screen.getByText('(No Subject)')).toBeInTheDocument();
    });
  });

  describe('Content Loading', () => {
    it('should fetch email details on mount', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(`/api/emails/${mockEmail.id}`);
      });
    });

    it('should display email content after loading', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('This is the HTML body of the email.')).toBeInTheDocument();
      });
    });

    it('should show error message on fetch failure', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/read')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });

      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load email content')).toBeInTheDocument();
      });
    });
  });

  describe('Mark as Read', () => {
    it('should mark email as read on mount', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/emails/${mockEmail.id}/read`,
          { method: 'POST' }
        );
      });
    });

    it('should refresh page after marking as read', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('Close Action', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      // Find and click the close button (the button with the X icon)
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons[0]; // First button is the close button
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('View Toggle', () => {
    it('should show view toggle when both HTML and text are available', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Rich Text')).toBeInTheDocument();
        expect(screen.getByText('Plain Text')).toBeInTheDocument();
      });
    });

    it('should default to HTML view', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        const richTextButton = screen.getByText('Rich Text');
        expect(richTextButton).toHaveClass('bg-indigo-100');
      });
    });

    it('should switch to plain text view when clicked', async () => {
      const user = userEvent.setup();
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Plain Text')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Plain Text'));

      await waitFor(() => {
        const plainTextButton = screen.getByText('Plain Text');
        expect(plainTextButton).toHaveClass('bg-indigo-100');
      });

      // Should show plain text content
      expect(screen.getByText('This is the plain text body of the email.')).toBeInTheDocument();
    });

    it('should not show toggle when only HTML is available', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/read')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...mockEmailDetail, bodyText: null }),
        });
      });

      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByText('Rich Text')).not.toBeInTheDocument();
        expect(screen.queryByText('Plain Text')).not.toBeInTheDocument();
      });
    });

    it('should not show toggle when only text is available', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/read')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...mockEmailDetail, bodyHtml: null }),
        });
      });

      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.queryByText('Rich Text')).not.toBeInTheDocument();
        expect(screen.queryByText('Plain Text')).not.toBeInTheDocument();
      });
    });
  });

  describe('Fallback Content', () => {
    it('should show "No content available" when no body content', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/read')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...mockEmailDetail, bodyHtml: null, bodyText: null }),
        });
      });

      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('No content available')).toBeInTheDocument();
      });
    });
  });

  describe('Date Formatting', () => {
    it('should format received date correctly', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      // The date should be formatted using toLocaleString
      // This is locale-dependent, so we just check it's rendered
      await waitFor(() => {
        const dateText = screen.getByText(/2024/);
        expect(dateText).toBeInTheDocument();
      });
    });
  });

  describe('Sender Display', () => {
    it('should show email address alongside name when both available', async () => {
      render(<EmailDetailModal email={mockEmail} onClose={mockOnClose} />);

      expect(screen.getByText(/Test Sender/)).toBeInTheDocument();
      expect(screen.getByText(/<sender@example.com>/)).toBeInTheDocument();
    });

    it('should show only address when name is missing', async () => {
      const emailWithoutName = { ...mockEmail, fromName: null };
      render(<EmailDetailModal email={emailWithoutName} onClose={mockOnClose} />);

      expect(screen.getByText(/sender@example.com/)).toBeInTheDocument();
    });

    it('should show "Unknown" when both name and address are missing', async () => {
      const emailWithoutSender = { ...mockEmail, fromName: null, fromAddress: null };
      render(<EmailDetailModal email={emailWithoutSender} onClose={mockOnClose} />);

      expect(screen.getByText(/Unknown/)).toBeInTheDocument();
    });
  });
});
