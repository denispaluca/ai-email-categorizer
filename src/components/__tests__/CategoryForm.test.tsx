import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryForm } from '../CategoryForm';

// Mock next/navigation
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('CategoryForm Component', () => {
  const existingCategory = {
    id: 'cat-123',
    name: 'Work',
    description: 'Work-related emails',
    color: '#3b82f6',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-cat' }),
    });
  });

  describe('Rendering', () => {
    it('should render form fields', () => {
      render(<CategoryForm />);

      expect(screen.getByLabelText('Category Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByText('Color')).toBeInTheDocument();
    });

    it('should render with empty fields for new category', () => {
      render(<CategoryForm />);

      const nameInput = screen.getByLabelText('Category Name') as HTMLInputElement;
      const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement;

      expect(nameInput.value).toBe('');
      expect(descriptionInput.value).toBe('');
    });

    it('should render with existing values when editing', () => {
      render(<CategoryForm category={existingCategory} />);

      const nameInput = screen.getByLabelText('Category Name') as HTMLInputElement;
      const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement;

      expect(nameInput.value).toBe('Work');
      expect(descriptionInput.value).toBe('Work-related emails');
    });

    it('should show "Create Category" button for new category', () => {
      render(<CategoryForm />);

      expect(screen.getByText('Create Category')).toBeInTheDocument();
    });

    it('should show "Update Category" button when editing', () => {
      render(<CategoryForm category={existingCategory} />);

      expect(screen.getByText('Update Category')).toBeInTheDocument();
    });

    it('should render all color options', () => {
      render(<CategoryForm />);

      // Should have 8 color buttons
      const colorButtons = screen.getAllByRole('button').filter(
        (btn) => btn.className.includes('rounded-full')
      );
      expect(colorButtons).toHaveLength(8);
    });

    it('should render Cancel button', () => {
      render(<CategoryForm />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Form Input', () => {
    it('should update name field on input', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      const nameInput = screen.getByLabelText('Category Name');
      await user.type(nameInput, 'Newsletters');

      expect(nameInput).toHaveValue('Newsletters');
    });

    it('should update description field on input', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      const descriptionInput = screen.getByLabelText('Description');
      await user.type(descriptionInput, 'Marketing emails');

      expect(descriptionInput).toHaveValue('Marketing emails');
    });

    it('should select color when color button is clicked', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      const colorButtons = screen.getAllByRole('button').filter(
        (btn) => btn.className.includes('rounded-full')
      );

      // Click the second color (pink)
      await user.click(colorButtons[1]);

      // The button should have the ring class indicating selection
      expect(colorButtons[1]).toHaveClass('ring-2');
    });
  });

  describe('Form Submission - Create', () => {
    it('should call POST to /api/categories for new category', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      await user.type(screen.getByLabelText('Category Name'), 'New Category');
      await user.type(screen.getByLabelText('Description'), 'New description');

      await user.click(screen.getByText('Create Category'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Category',
            description: 'New description',
            color: '#6366f1', // Default color
          }),
        });
      });
    });

    it('should navigate to dashboard on successful create', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      await user.type(screen.getByLabelText('Category Name'), 'Test');
      await user.type(screen.getByLabelText('Description'), 'Test desc');

      await user.click(screen.getByText('Create Category'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('should show loading state while submitting', async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        promise.then(() => ({ ok: true, json: async () => ({}) }))
      );

      render(<CategoryForm />);

      await user.type(screen.getByLabelText('Category Name'), 'Test');
      await user.type(screen.getByLabelText('Description'), 'Test desc');

      await user.click(screen.getByText('Create Category'));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeDisabled();

      resolvePromise!();
    });
  });

  describe('Form Submission - Update', () => {
    it('should call PUT to /api/categories/:id for existing category', async () => {
      const user = userEvent.setup();
      render(<CategoryForm category={existingCategory} />);

      // Clear and type new value
      const nameInput = screen.getByLabelText('Category Name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Work');

      await user.click(screen.getByText('Update Category'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/categories/cat-123', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Updated Work',
            description: 'Work-related emails',
            color: '#3b82f6',
          }),
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should show alert on submission error', async () => {
      const user = userEvent.setup();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      render(<CategoryForm />);

      await user.type(screen.getByLabelText('Category Name'), 'Test');
      await user.type(screen.getByLabelText('Description'), 'Test desc');

      await user.click(screen.getByText('Create Category'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          'Failed to save category. Please try again.'
        );
      });

      alertMock.mockRestore();
    });

    it('should re-enable form after error', async () => {
      const user = userEvent.setup();
      jest.spyOn(window, 'alert').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      render(<CategoryForm />);

      await user.type(screen.getByLabelText('Category Name'), 'Test');
      await user.type(screen.getByLabelText('Description'), 'Test desc');

      await user.click(screen.getByText('Create Category'));

      await waitFor(() => {
        expect(screen.getByText('Create Category')).not.toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      await user.click(screen.getByText('Cancel'));

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should have required attribute on name input', () => {
      render(<CategoryForm />);

      const nameInput = screen.getByLabelText('Category Name');
      expect(nameInput).toHaveAttribute('required');
    });

    it('should have required attribute on description input', () => {
      render(<CategoryForm />);

      const descriptionInput = screen.getByLabelText('Description');
      expect(descriptionInput).toHaveAttribute('required');
    });
  });

  describe('Color Selection', () => {
    it('should use default color when creating new category', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      await user.type(screen.getByLabelText('Category Name'), 'Test');
      await user.type(screen.getByLabelText('Description'), 'Test desc');

      await user.click(screen.getByText('Create Category'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: expect.stringContaining('#6366f1'),
          })
        );
      });
    });

    it('should use selected color in submission', async () => {
      const user = userEvent.setup();
      render(<CategoryForm />);

      // Select a different color (pink - second option)
      const colorButtons = screen.getAllByRole('button').filter(
        (btn) => btn.className.includes('rounded-full')
      );
      await user.click(colorButtons[1]); // Pink

      await user.type(screen.getByLabelText('Category Name'), 'Test');
      await user.type(screen.getByLabelText('Description'), 'Test desc');

      await user.click(screen.getByText('Create Category'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: expect.stringContaining('#ec4899'),
          })
        );
      });
    });

    it('should preserve existing color when editing', () => {
      render(<CategoryForm category={existingCategory} />);

      const colorButtons = screen.getAllByRole('button').filter(
        (btn) => btn.className.includes('rounded-full')
      );

      // The blue color should be selected (index 4)
      const blueButton = colorButtons[4]; // #3b82f6 is at index 4
      expect(blueButton).toHaveClass('ring-2');
    });
  });
});
