import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PrepReferenceEditor, PrepReferenceText, referenceToken } from './PrepReferences';

describe('Private prep references', () => {
  it('inserts a stable ID using keyboard selection and excludes itself', () => {
    function Editor() {
      const [value, setValue] = useState('');
      return <PrepReferenceEditor value={value} onChange={setValue} currentId={1} notes={[{ id: 1, title: 'Self' }, { id: 2, title: 'Tower' }, { id: 3, title: 'Tower' }]} />;
    }
    render(<Editor />);
    const editor = screen.getByRole('combobox');
    fireEvent.change(editor, { target: { value: '@', selectionStart: 1 } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(editor, { key: 'ArrowDown' }); fireEvent.keyDown(editor, { key: 'Enter' });
    expect(editor).toHaveValue('@[Tower](note:3)');
  });
  it('resolves renames by ID and displays deleted or malformed targets safely', () => {
    const open = vi.fn();
    render(<PrepReferenceText content="@[Old](note:2) @[Gone](note:9) @[broken <script>alert(1)</script>" notes={[{ id: 2, title: 'Renamed' }]} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: 'Renamed' }));
    expect(open).toHaveBeenCalledWith(2);
    expect(screen.getByText('Gone (note unavailable)')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
  it('keeps titles with delimiters readable', () => {
    expect(referenceToken({ id: 2, title: 'A]\nB' })).toBe('@[A  B](note:2)');
  });
});
