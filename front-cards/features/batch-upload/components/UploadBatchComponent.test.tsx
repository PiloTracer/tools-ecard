/**
 * UploadBatchComponent — template download links and clipboard paste.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UploadBatchComponent } from './UploadBatchComponent';

jest.mock('@/features/simple-projects', () => ({
  useProjects: () => ({ selectedProjectId: 'project-1', loading: false }),
}));

jest.mock('../services/batchService', () => ({
  batchService: {
    uploadBatch: jest.fn(),
    previewBatchFile: jest.fn(),
    listBatches: jest.fn().mockResolvedValue({ batches: [] }),
    saveMappingPreset: jest.fn().mockResolvedValue({}),
  },
}));

import { batchService } from '../services/batchService';

describe('UploadBatchComponent template downloads', () => {
  beforeEach(() => {
    (batchService.uploadBatch as jest.Mock).mockReset();
    (batchService.previewBatchFile as jest.Mock).mockReset();
    (batchService.previewBatchFile as jest.Mock).mockResolvedValue({
      fileName: 'pasted-content.txt',
      rowsTotal: 1,
      columns: [{ header: 'work_phone', confidence: 'high' }],
      targetFields: [],
      suggestedPreset: null,
    });
    (batchService.uploadBatch as jest.Mock).mockResolvedValue({ id: 'batch-1', status: 'LOADED' });
  });

  it('links both import-template workbooks for download', () => {
    render(<UploadBatchComponent />);

    const rows = screen.getByRole('link', { name: 'Download template (rows)' });
    expect(rows).toHaveAttribute('href', '/templates/import-template-horizontal.xlsx');
    expect(rows).toHaveAttribute('download');

    const columns = screen.getByRole('link', { name: 'Download template (columns)' });
    expect(columns).toHaveAttribute('href', '/templates/import-template-vertical.xlsx');
    expect(columns).toHaveAttribute('download');
  });

  it('creates a batch from pasted plain text', async () => {
    render(<UploadBatchComponent />);

    const text = 'work_phone:\t+506 2222-1234\nemail:\tjohn.doe@eco.com';
    fireEvent.paste(document, {
      clipboardData: {
        getData: (format: string) => (format === 'text/plain' ? text : ''),
        files: [],
      } as unknown as DataTransfer,
    });

    await waitFor(() => {
      expect(batchService.previewBatchFile).toHaveBeenCalled();
    });

    const fileArg = (batchService.previewBatchFile as jest.Mock).mock.calls[0][0] as File;
    expect(fileArg.name).toBe('pasted-content.txt');
    expect(fileArg.type).toBe('text/plain');
  });

  it('does not hijack paste when an input is focused', async () => {
    render(<UploadBatchComponent />);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const text = 'work_phone:\t+506 2222-1234';
    fireEvent.paste(document, {
      clipboardData: {
        getData: (format: string) => (format === 'text/plain' ? text : ''),
        files: [],
      } as unknown as DataTransfer,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(batchService.previewBatchFile).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('focuses the dropzone on hover and accepts paste directly on it', async () => {
    render(<UploadBatchComponent />);

    const dropzone = screen.getByRole('button', { name: 'Import Batch' });
    fireEvent.mouseEnter(dropzone);

    // Hovering should move focus to the dropzone so onPaste fires directly.
    await waitFor(() => {
      expect(document.activeElement).toBe(dropzone);
    });

    const text = 'work_phone:\t+506 2222-1234\nemail:\tjohn.doe@eco.com';
    fireEvent.paste(dropzone, {
      clipboardData: {
        getData: (format: string) => (format === 'text/plain' ? text : ''),
        files: [],
      } as unknown as DataTransfer,
    });

    await waitFor(() => {
      expect(batchService.previewBatchFile).toHaveBeenCalled();
    });

    const fileArg = (batchService.previewBatchFile as jest.Mock).mock.calls[0][0] as File;
    expect(fileArg.name).toBe('pasted-content.txt');
    expect(fileArg.type).toBe('text/plain');
  });
});
