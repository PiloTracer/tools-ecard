import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RenderStatusBadge } from './RenderStatusBadge';

// Mock fetch globally
global.fetch = jest.fn();

describe('RenderStatusBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null when idle', () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Not found'));
    const { container } = render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders active state with progress', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          recordId: 'rec-1',
          status: 'active',
          progress: 45,
        },
      }),
    });

    render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Rendering 45%/)).toBeInTheDocument();
    });
  });

  it('renders completed state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          recordId: 'rec-1',
          status: 'completed',
          progress: 100,
        },
      }),
    });

    render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);

    await waitFor(() => {
      expect(screen.getByText('Rendered')).toBeInTheDocument();
    });
  });

  it('renders failed state with error', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          recordId: 'rec-1',
          status: 'failed',
          progress: 0,
          failedReason: 'Out of memory',
        },
      }),
    });

    render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('uses custom apiBaseUrl', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          recordId: 'rec-1',
          status: 'completed',
          progress: 100,
        },
      }),
    });

    render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" apiBaseUrl="https://api.example.com" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/batches/batch-1/records/rec-1/render-status'
      );
    });
  });

  it('handles waiting status as active', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          recordId: 'rec-1',
          status: 'waiting',
          progress: 0,
        },
      }),
    });

    render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Rendering/)).toBeInTheDocument();
    });
  });

  it('handles delayed status as active', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          recordId: 'rec-1',
          status: 'delayed',
          progress: 10,
        },
      }),
    });

    render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Rendering 10%/)).toBeInTheDocument();
    });
  });

  it('handles unknown status as idle', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          recordId: 'rec-1',
          status: 'unknown',
          progress: 0,
        },
      }),
    });

    const { container } = render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('handles network errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { container } = render(<RenderStatusBadge recordId="rec-1" batchId="batch-1" />);
    expect(container.firstChild).toBeNull();
  });
});
