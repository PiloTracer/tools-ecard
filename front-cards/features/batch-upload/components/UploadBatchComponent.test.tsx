/**
 * UploadBatchComponent — template download links (plan tasks 6+7).
 *
 * The dropzone offers the two committed import-template workbooks
 * (front-cards/public/templates/) as static downloads in both Demo and Normal
 * mode; these tests guard the hrefs against typos/drift.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UploadBatchComponent } from './UploadBatchComponent';

jest.mock('@/features/simple-projects', () => ({
  useProjects: () => ({ selectedProjectId: 'project-1', loading: false }),
}));

describe('UploadBatchComponent template downloads', () => {
  it('links both import-template workbooks for download', () => {
    render(<UploadBatchComponent />);

    const rows = screen.getByRole('link', { name: 'Download template (rows)' });
    expect(rows).toHaveAttribute('href', '/templates/import-template-horizontal.xlsx');
    expect(rows).toHaveAttribute('download');

    const columns = screen.getByRole('link', { name: 'Download template (columns)' });
    expect(columns).toHaveAttribute('href', '/templates/import-template-vertical.xlsx');
    expect(columns).toHaveAttribute('download');
  });
});
