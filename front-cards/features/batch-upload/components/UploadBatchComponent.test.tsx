/**
 * UploadBatchComponent — template download links and clipboard paste.
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithLocale } from '@/features/i18n/testUtils';
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

describe('UploadBatchComponent', () => {
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
    renderWithLocale(<UploadBatchComponent />);

    const rows = screen.getByRole('link', { name: 'Download template (rows)' });
    expect(rows).toHaveAttribute('href', '/templates/import-template-horizontal.xlsx');
    expect(rows).toHaveAttribute('download');

    const columns = screen.getByRole('link', { name: 'Download template (columns)' });
    expect(columns).toHaveAttribute('href', '/templates/import-template-vertical.xlsx');
    expect(columns).toHaveAttribute('download');
  });

  it('supports clipboard paste of plain text to start a batch import', async () => {
    renderWithLocale(<UploadBatchComponent />);

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
    // Exactly once — the document listener must not double-handle the event.
    expect(batchService.previewBatchFile).toHaveBeenCalledTimes(1);

    const fileArg = (batchService.previewBatchFile as jest.Mock).mock.calls[0][0] as File;
    expect(fileArg.name).toBe('pasted-content.txt');
    expect(fileArg.type).toBe('text/plain');
  });

  it('supports clipboard paste of a file to start a batch import', async () => {
    renderWithLocale(<UploadBatchComponent />);

    const pastedFile = new File(['work_phone:\t+506 2222-1234'], 'clipboard-data.txt', {
      type: 'text/plain',
    });
    const fileList = { item: (i: number) => (i === 0 ? pastedFile : null), length: 1, 0: pastedFile };

    fireEvent.paste(document, {
      clipboardData: {
        getData: () => '',
        files: fileList as unknown as FileList,
      } as unknown as DataTransfer,
    });

    await waitFor(() => {
      expect(batchService.previewBatchFile).toHaveBeenCalled();
    });
    expect(batchService.previewBatchFile).toHaveBeenCalledTimes(1);

    const fileArg = (batchService.previewBatchFile as jest.Mock).mock.calls[0][0] as File;
    expect(fileArg.name).toBe('clipboard-data.txt');
  });

  it('does not hijack clipboard paste when an input is focused', async () => {
    renderWithLocale(<UploadBatchComponent />);

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

  it('imports the clipboard contents when the Paste button is clicked', async () => {
    const readText = jest.fn().mockResolvedValue('work_phone:\t+506 2222-1234\nemail:\tjane@example.com');
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText },
      configurable: true,
    });
    renderWithLocale(<UploadBatchComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));

    await waitFor(() => {
      expect(batchService.previewBatchFile).toHaveBeenCalled();
    });
    expect(batchService.previewBatchFile).toHaveBeenCalledTimes(1);

    const fileArg = (batchService.previewBatchFile as jest.Mock).mock.calls[0][0] as File;
    expect(fileArg.name).toBe('pasted-content.txt');
    expect(fileArg.type).toBe('text/plain');
  });

  it('shows a hint instead of importing when the clipboard has no text', async () => {
    const readText = jest.fn().mockResolvedValue('');
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText },
      configurable: true,
    });
    renderWithLocale(<UploadBatchComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));

    await waitFor(() => {
      expect(screen.getByText(/clipboard has no text to import/i)).toBeInTheDocument();
    });
    expect(batchService.previewBatchFile).not.toHaveBeenCalled();
  });

  it('shows a hint instead of crashing when clipboard access is denied', async () => {
    const readText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText },
      configurable: true,
    });
    renderWithLocale(<UploadBatchComponent />);

    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));

    await waitFor(() => {
      expect(screen.getByText(/clipboard access unavailable/i)).toBeInTheDocument();
    });
    expect(batchService.previewBatchFile).not.toHaveBeenCalled();
  });
});
