/**
 * QuickActions Component Tests
 *
 * Tests for project-aware quick actions component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickActions } from './QuickActions';

// Mock the useProjects hook
jest.mock('@/features/simple-projects', () => ({
  useProjects: jest.fn()
}));

import { useProjects } from '@/features/simple-projects';

describe('QuickActions Component', () => {
  const mockOnCreateTemplate = jest.fn();
  const mockOnImportBatch = jest.fn();
  const mockOnViewBatches = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when project is selected', () => {
    beforeEach(() => {
      (useProjects as jest.Mock).mockReturnValue({
        selectedProjectId: 'project-123',
        loading: false
      });
    });

    it('renders all action buttons enabled', () => {
      render(
        <QuickActions
          onCreateTemplate={mockOnCreateTemplate}
          onImportBatch={mockOnImportBatch}
          onViewBatches={mockOnViewBatches}
        />
      );

      const createButton = screen.getByRole('button', { name: /Template Designer/i });
      const importButton = screen.getByRole('button', { name: /import batch/i });
      const viewButton = screen.getByRole('button', { name: /view batches/i });

      expect(createButton).not.toBeDisabled();
      expect(importButton).not.toBeDisabled();
      expect(viewButton).not.toBeDisabled();
    });

    it('calls callbacks when buttons are clicked', () => {
      render(
        <QuickActions
          onCreateTemplate={mockOnCreateTemplate}
          onImportBatch={mockOnImportBatch}
          onViewBatches={mockOnViewBatches}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Template Designer/i }));
      expect(mockOnCreateTemplate).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /import batch/i }));
      expect(mockOnImportBatch).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /view batches/i }));
      expect(mockOnViewBatches).toHaveBeenCalledTimes(1);
    });

    it('does not show warning message', () => {
      render(<QuickActions />);
      expect(screen.queryByText(/select a project to enable actions/i)).not.toBeInTheDocument();
    });
  });

  describe('when no project is selected', () => {
    beforeEach(() => {
      (useProjects as jest.Mock).mockReturnValue({
        selectedProjectId: null,
        loading: false
      });
    });

    it('renders all action buttons disabled', () => {
      render(
        <QuickActions
          onCreateTemplate={mockOnCreateTemplate}
          onImportBatch={mockOnImportBatch}
          onViewBatches={mockOnViewBatches}
        />
      );

      const createButton = screen.getByRole('button', { name: /Template Designer/i });
      const importButton = screen.getByRole('button', { name: /import batch/i });
      const viewButton = screen.getByRole('button', { name: /view batches/i });

      expect(createButton).toBeDisabled();
      expect(importButton).toBeDisabled();
      expect(viewButton).toBeDisabled();
    });

    it('does not call callbacks when buttons are clicked', () => {
      render(
        <QuickActions
          onCreateTemplate={mockOnCreateTemplate}
          onImportBatch={mockOnImportBatch}
          onViewBatches={mockOnViewBatches}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Template Designer/i }));
      fireEvent.click(screen.getByRole('button', { name: /import batch/i }));
      fireEvent.click(screen.getByRole('button', { name: /view batches/i }));

      expect(mockOnCreateTemplate).not.toHaveBeenCalled();
      expect(mockOnImportBatch).not.toHaveBeenCalled();
      expect(mockOnViewBatches).not.toHaveBeenCalled();
    });

    it('shows warning message', () => {
      render(<QuickActions />);
      expect(screen.getByText(/select a project to enable actions/i)).toBeInTheDocument();
    });
  });

  describe('when loading projects', () => {
    beforeEach(() => {
      (useProjects as jest.Mock).mockReturnValue({
        selectedProjectId: null,
        loading: true
      });
    });

    it('renders all action buttons disabled', () => {
      render(
        <QuickActions
          onCreateTemplate={mockOnCreateTemplate}
          onImportBatch={mockOnImportBatch}
          onViewBatches={mockOnViewBatches}
        />
      );

      const createButton = screen.getByRole('button', { name: /Template Designer/i });
      const importButton = screen.getByRole('button', { name: /import batch/i });
      const viewButton = screen.getByRole('button', { name: /view batches/i });

      expect(createButton).toBeDisabled();
      expect(importButton).toBeDisabled();
      expect(viewButton).toBeDisabled();
    });

    it('shows loading state', () => {
      render(<QuickActions />);
      expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
    });
  });

  describe('styling and accessibility', () => {
    beforeEach(() => {
      (useProjects as jest.Mock).mockReturnValue({
        selectedProjectId: 'project-123',
        loading: false
      });
    });

    it('applies custom className', () => {
      const { container } = render(
        <QuickActions className="custom-class" />
      );

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-class');
    });

    it('has proper accessibility attributes', () => {
      render(
        <QuickActions
          onCreateTemplate={mockOnCreateTemplate}
          onImportBatch={mockOnImportBatch}
          onViewBatches={mockOnViewBatches}
        />
      );

      const createButton = screen.getByRole('button', { name: /Template Designer/i });
      expect(createButton).toHaveAttribute('aria-label', 'Template Designer');
      expect(createButton).toHaveAttribute('title', 'Create a new card template');
    });
  });
});