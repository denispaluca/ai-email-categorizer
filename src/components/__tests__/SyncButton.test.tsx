import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncButton } from '../SyncButton';

// Mock next/navigation
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('SyncButton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  describe('Rendering', () => {
    it('should render with "Sync Now" text', () => {
      render(<SyncButton />);

      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });

    it('should render sync icon', () => {
      render(<SyncButton />);

      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Sync Action', () => {
    it('should call /api/sync on click', async () => {
      const user = userEvent.setup();
      render(<SyncButton />);

      await user.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/sync', { method: 'POST' });
      });
    });

    it('should show loading state while syncing', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        promise.then(() => ({ ok: true }))
      );

      render(<SyncButton />);

      await user.click(screen.getByText('Sync Now'));

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();

      // Check for spinning animation
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveClass('animate-spin');

      resolvePromise!();

      await waitFor(() => {
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });
    });

    it('should refresh page on successful sync', async () => {
      const user = userEvent.setup();
      render(<SyncButton />);

      await user.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should show alert on sync error', async () => {
      const user = userEvent.setup();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      render(<SyncButton />);

      await user.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          'Failed to sync emails. Please try again.'
        );
      });

      alertMock.mockRestore();
    });

    it('should re-enable button after error', async () => {
      const user = userEvent.setup();
      jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      render(<SyncButton />);

      await user.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(screen.getByRole('button')).not.toBeDisabled();
        expect(screen.getByText('Sync Now')).toBeInTheDocument();
      });
    });

    it('should handle fetch exceptions', async () => {
      const user = userEvent.setup();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<SyncButton />);

      await user.click(screen.getByText('Sync Now'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          'Failed to sync emails. Please try again.'
        );
      });

      alertMock.mockRestore();
    });
  });
});
