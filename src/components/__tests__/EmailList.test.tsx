import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailList } from '../EmailList';

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock EmailDetailModal
jest.mock('../EmailDetailModal', () => ({
  EmailDetailModal: ({ email, onClose }: { email: { subject: string }; onClose: () => void }) => (
    <div data-testid="email-modal">
      <span>{email.subject}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('EmailList Component', () => {
  const mockEmails = [
    {
      id: 'email-1',
      gmailAccountId: 'gmail-1',
      gmailId: 'gmail-msg-1',
      fromAddress: 'sender1@example.com',
      fromName: 'Sender One',
      subject: 'First Email Subject',
      summary: 'Summary of the first email',
      receivedAt: new Date('2024-01-15T10:00:00'),
      isRead: false,
    },
    {
      id: 'email-2',
      gmailAccountId: 'gmail-1',
      gmailId: 'gmail-msg-2',
      fromAddress: 'sender2@example.com',
      fromName: 'Sender Two',
      subject: 'Second Email Subject',
      summary: 'Summary of the second email',
      receivedAt: new Date('2024-01-14T15:30:00'),
      isRead: true,
    },
    {
      id: 'email-3',
      gmailAccountId: 'gmail-1',
      gmailId: 'gmail-msg-3',
      fromAddress: 'sender3@example.com',
      fromName: null,
      subject: null,
      summary: null,
      receivedAt: null,
      isRead: false,
    },
  ];

  const defaultProps = {
    emails: mockEmails,
    categoryColor: '#6366f1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, deletedCount: 1 }),
    });
  });

  describe('Rendering', () => {
    it('should render all emails', () => {
      render(<EmailList {...defaultProps} />);

      expect(screen.getByText('Sender One')).toBeInTheDocument();
      expect(screen.getByText('Sender Two')).toBeInTheDocument();
      expect(screen.getByText('First Email Subject')).toBeInTheDocument();
      expect(screen.getByText('Second Email Subject')).toBeInTheDocument();
    });

    it('should show email summaries', () => {
      render(<EmailList {...defaultProps} />);

      expect(screen.getByText('Summary of the first email')).toBeInTheDocument();
      expect(screen.getByText('Summary of the second email')).toBeInTheDocument();
    });

    it('should show fallback text for missing sender name', () => {
      render(<EmailList {...defaultProps} />);

      // When fromName is null, it should show fromAddress
      expect(screen.getByText('sender3@example.com')).toBeInTheDocument();
    });

    it('should show "(No Subject)" for missing subject', () => {
      render(<EmailList {...defaultProps} />);

      expect(screen.getByText('(No Subject)')).toBeInTheDocument();
    });

    it('should show "No summary available" for missing summary', () => {
      render(<EmailList {...defaultProps} />);

      expect(screen.getByText('No summary available')).toBeInTheDocument();
    });

    it('should apply different styles for read vs unread emails', () => {
      render(<EmailList {...defaultProps} />);

      // Unread email should have the unread indicator
      const firstEmailSender = screen.getByText('Sender One');
      expect(firstEmailSender).toHaveClass('font-semibold');

      // Read email should not have font-semibold
      const secondEmailSender = screen.getByText('Sender Two');
      expect(secondEmailSender).not.toHaveClass('font-semibold');
    });

    it('should render empty list gracefully', () => {
      render(<EmailList emails={[]} categoryColor="#6366f1" />);

      expect(screen.queryByText('Sender One')).not.toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should toggle individual email selection', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const firstEmailCheckbox = checkboxes[1]; // First checkbox is "select all"

      expect(firstEmailCheckbox).not.toBeChecked();

      await user.click(firstEmailCheckbox);
      expect(firstEmailCheckbox).toBeChecked();

      await user.click(firstEmailCheckbox);
      expect(firstEmailCheckbox).not.toBeChecked();
    });

    it('should show selection count when emails are selected', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // Select first email

      expect(screen.getByText('1 selected')).toBeInTheDocument();

      await user.click(checkboxes[2]); // Select second email

      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('should toggle select all', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];

      await user.click(selectAllCheckbox);

      // All checkboxes should be checked
      const allCheckboxes = screen.getAllByRole('checkbox');
      allCheckboxes.forEach((checkbox) => {
        expect(checkbox).toBeChecked();
      });

      await user.click(selectAllCheckbox);

      // All should be unchecked
      allCheckboxes.forEach((checkbox) => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should show action buttons when emails are selected', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      // Initially no action buttons
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
      expect(screen.queryByText('Unsubscribe')).not.toBeInTheDocument();

      // Select an email
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      // Action buttons should appear
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Unsubscribe')).toBeInTheDocument();
    });
  });

  describe('Bulk Delete', () => {
    it('should call bulk delete API when delete button clicked', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      // Select emails
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Click delete
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/emails/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('email-1'),
        });
      });
    });

    it('should show loading state while deleting', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() => promise.then(() => ({
        ok: true,
        json: async () => ({ success: true }),
      })));

      render(<EmailList {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(screen.getByText('Deleting...')).toBeInTheDocument();

      resolvePromise!();
      await waitFor(() => {
        expect(screen.queryByText('Deleting...')).not.toBeInTheDocument();
      });
    });

    it('should refresh page after successful delete', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should show alert on delete error', async () => {
      const user = userEvent.setup();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      render(<EmailList {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          'Failed to delete emails. Please try again.'
        );
      });

      alertMock.mockRestore();
    });
  });

  describe('Bulk Unsubscribe', () => {
    it('should call bulk unsubscribe API when button clicked', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ processed: 2, unsubscribed: 1 }),
      });

      render(<EmailList {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await user.click(screen.getByText('Unsubscribe'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/emails/bulk-unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('email-1'),
        });
      });
    });

    it('should show processing state while unsubscribing', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() => promise.then(() => ({
        ok: true,
        json: async () => ({ processed: 1, unsubscribed: 1 }),
      })));

      render(<EmailList {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);

      await user.click(screen.getByText('Unsubscribe'));

      expect(screen.getByText('Processing...')).toBeInTheDocument();

      resolvePromise!();
    });
  });

  describe('Email Detail Modal', () => {
    it('should open modal when email is clicked', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      const emailButton = screen.getByText('First Email Subject');
      await user.click(emailButton);

      expect(screen.getByTestId('email-modal')).toBeInTheDocument();
    });

    it('should close modal when close is clicked', async () => {
      const user = userEvent.setup();
      render(<EmailList {...defaultProps} />);

      // Open modal
      await user.click(screen.getByText('First Email Subject'));
      expect(screen.getByTestId('email-modal')).toBeInTheDocument();

      // Close modal
      await user.click(screen.getByText('Close'));
      expect(screen.queryByTestId('email-modal')).not.toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    beforeEach(() => {
      // Mock current date
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should format today\'s date as time', () => {
      const todayEmail = [{
        ...mockEmails[0],
        receivedAt: new Date('2024-01-15T10:30:00'),
      }];

      render(<EmailList emails={todayEmail} categoryColor="#6366f1" />);

      // Should show time format for today
      expect(screen.getByText(/10:30/)).toBeInTheDocument();
    });

    it('should format yesterday\'s date as "Yesterday"', () => {
      const yesterdayEmail = [{
        ...mockEmails[0],
        receivedAt: new Date('2024-01-14T10:30:00'),
      }];

      render(<EmailList emails={yesterdayEmail} categoryColor="#6366f1" />);

      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });
  });
});
