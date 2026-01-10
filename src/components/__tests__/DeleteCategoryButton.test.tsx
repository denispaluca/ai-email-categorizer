import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteCategoryButton } from '../DeleteCategoryButton';

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock window.confirm
const mockConfirm = jest.fn();
window.confirm = mockConfirm;

describe('DeleteCategoryButton Component', () => {
  const categoryId = 'cat-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  describe('Rendering', () => {
    it('should render delete button', () => {
      render(<DeleteCategoryButton categoryId={categoryId} />);

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should have correct styling', () => {
      render(<DeleteCategoryButton categoryId={categoryId} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-red-600');
    });
  });

  describe('Confirmation', () => {
    it('should show confirmation dialog on click', async () => {
      const user = userEvent.setup();
      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this category? Emails in this category will become uncategorized.'
      );
    });

    it('should not delete when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);

      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should proceed with delete when confirmed', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);

      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/categories/cat-123',
          { method: 'DELETE' }
        );
      });
    });
  });

  describe('Delete Action', () => {
    it('should show loading state while deleting', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        promise.then(() => ({ ok: true }))
      );

      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      expect(screen.getByText('Deleting...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();

      resolvePromise!();

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      });
    });

    it('should navigate to dashboard on successful delete', async () => {
      const user = userEvent.setup();
      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should show alert on delete error', async () => {
      const user = userEvent.setup();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          'Failed to delete category. Please try again.'
        );
      });

      alertMock.mockRestore();
    });

    it('should re-enable button after error', async () => {
      const user = userEvent.setup();
      jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(screen.getByRole('button')).not.toBeDisabled();
        expect(screen.getByText('Delete')).toBeInTheDocument();
      });
    });

    it('should handle fetch exceptions', async () => {
      const user = userEvent.setup();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<DeleteCategoryButton categoryId={categoryId} />);

      await user.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          'Failed to delete category. Please try again.'
        );
      });

      alertMock.mockRestore();
    });
  });
});
