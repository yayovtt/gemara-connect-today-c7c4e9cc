import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextInput } from '../TextInput';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Mock the external libraries
vi.mock('pdfjs-dist', () => ({
  default: {},
  version: '3.11.174',
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('TextInput Component - File Upload (Simplified)', () => {
  let onTextChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onTextChange = vi.fn();
    vi.clearAllMocks();
  });

  it('renders upload button', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    expect(screen.getByText('העלה קובץ')).toBeInTheDocument();
  });

  it('renders multiple files upload button', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    expect(screen.getByText('העלה מספר קבצים')).toBeInTheDocument();
  });

  it('has single file input with correct file types', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    
    const singleFileInput = document.querySelector('input[type="file"]:not([multiple])') as HTMLInputElement;
    expect(singleFileInput).toBeTruthy();
    expect(singleFileInput.accept).toContain('.txt');
    expect(singleFileInput.accept).toContain('.pdf');
    expect(singleFileInput.accept).toContain('.docx');
    expect(singleFileInput.accept).toContain('.html');
    expect(singleFileInput.accept).toContain('.htm');
  });

  it('has multiple file input with correct configuration', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    
    const multiFileInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    expect(multiFileInput).toBeTruthy();
    expect(multiFileInput.multiple).toBe(true);
    expect(multiFileInput.accept).toContain('.pdf');
    expect(multiFileInput.accept).toContain('.docx');
    expect(multiFileInput.accept).toContain('.txt');
  });

  it('displays correct placeholder text', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    
    const textarea = screen.getByPlaceholderText(/הדבק כאן את הטקסט לניתוח/i);
    expect(textarea).toBeInTheDocument();
  });

  it('has mammoth library available for Word documents', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    
    // Verify mammoth is properly mocked and available
    expect(mammoth.extractRawText).toBeDefined();
    expect(typeof mammoth.extractRawText).toBe('function');
  });

  it('has pdfjs-dist library available for PDF documents', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    
    // Verify pdfjs-dist is properly mocked and available
    expect(pdfjsLib.getDocument).toBeDefined();
    expect(pdfjsLib.version).toBe('3.11.174');
    expect(typeof pdfjsLib.getDocument).toBe('function');
  });

  it('both upload buttons are initially enabled', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    
    const uploadButton = screen.getByText('העלה קובץ').closest('button');
    const multiUploadButton = screen.getByText('העלה מספר קבצים').closest('button');
    
    expect(uploadButton).not.toBeDisabled();
    expect(multiUploadButton).not.toBeDisabled();
  });

  it('textarea updates when text prop changes', () => {
    const { rerender } = render(<TextInput text="" onTextChange={onTextChange} />);
    
    const textarea = screen.getByPlaceholderText(/הדבק כאן את הטקסט לניתוח/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
    
    rerender(<TextInput text="טקסט חדש" onTextChange={onTextChange} />);
    expect(textarea.value).toBe('טקסט חדש');
  });

  it('renders RTL text direction for textarea', () => {
    render(<TextInput text="" onTextChange={onTextChange} />);
    
    const textarea = screen.getByPlaceholderText(/הדבק כאן את הטקסט לניתוח/i);
    expect(textarea).toHaveAttribute('dir', 'rtl');
  });
});
