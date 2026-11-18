import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { UploadsPreview } from './UploadsPreview';

afterEach(cleanup);

it('TASK-115 the development preview shows FileDrop, Submit and the photo viewer over sample files', async () => {
  render(<UploadsPreview />);
  expect(screen.getByRole('heading', { name: 'Repair photos' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Submit step' })).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Open the photo viewer' }));
    await Promise.resolve();
  });
  expect(screen.getByRole('dialog', { name: 'IMG_0001.jpg' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
