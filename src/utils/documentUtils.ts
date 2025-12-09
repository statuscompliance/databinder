/**
 * Document Utilities
 * 
 * Provides utility functions for working with various document formats
 * including ODT, PDF, DOCX, and more.
 */

import { logger } from '../core/logger';
import { NetworkError } from '../core/errors';

/**
 * Document metadata interface
 */
export interface DocumentMetadata {
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Creation date */
  createdAt?: Date;
  /** Last modified date */
  modifiedAt?: Date;
  /** Document subject */
  subject?: string;
  /** Document keywords */
  keywords?: string[];
  /** Page count */
  pageCount?: number;
  /** Word count */
  wordCount?: number;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Parsed document result
 */
export interface ParsedDocument {
  /** Extracted text content */
  content: string;
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Original format */
  format: string;
  /** File size in bytes */
  size?: number;
}

/**
 * Document format detection result
 */
export interface DocumentFormat {
  /** MIME type */
  mimeType: string;
  /** File extension */
  extension: string;
  /** Format name */
  name: string;
  /** Whether format is supported */
  supported: boolean;
}

/**
 * Detects document format from file buffer or filename
 * 
 * @param input - File buffer or filename
 * @returns Document format information
 */
export function detectDocumentFormat(input: ArrayBuffer | string): DocumentFormat {
  let buffer: Uint8Array | null = null;
  let filename: string | null = null;

  if (typeof input === 'string') {
    filename = input;
  } else {
    buffer = new Uint8Array(input);
  }

  // Check magic bytes if buffer is available
  if (buffer) {
    // PDF signature
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return {
        mimeType: 'application/pdf',
        extension: '.pdf',
        name: 'PDF',
        supported: true
      };
    }

    // ZIP-based formats (ODT, DOCX, etc.) - PK signature
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      // Need to check content for specific format
      return {
        mimeType: 'application/zip',
        extension: '.zip',
        name: 'ZIP-based Document',
        supported: true
      };
    }

    // RTF signature
    if (buffer[0] === 0x7B && buffer[1] === 0x5C && buffer[2] === 0x72 && buffer[3] === 0x74) {
      return {
        mimeType: 'application/rtf',
        extension: '.rtf',
        name: 'Rich Text Format',
        supported: false
      };
    }

    // DOC signature (old Word format)
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
      return {
        mimeType: 'application/msword',
        extension: '.doc',
        name: 'Microsoft Word (Legacy)',
        supported: false
      };
    }
  }

  // Fallback to filename extension
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'pdf':
        return {
          mimeType: 'application/pdf',
          extension: '.pdf',
          name: 'PDF',
          supported: true
        };
      case 'odt':
        return {
          mimeType: 'application/vnd.oasis.opendocument.text',
          extension: '.odt',
          name: 'OpenDocument Text',
          supported: true
        };
      case 'ods':
        return {
          mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
          extension: '.ods',
          name: 'OpenDocument Spreadsheet',
          supported: true
        };
      case 'odp':
        return {
          mimeType: 'application/vnd.oasis.opendocument.presentation',
          extension: '.odp',
          name: 'OpenDocument Presentation',
          supported: true
        };
      case 'docx':
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: '.docx',
          name: 'Microsoft Word',
          supported: true
        };
      case 'xlsx':
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: '.xlsx',
          name: 'Microsoft Excel',
          supported: true
        };
      case 'pptx':
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          extension: '.pptx',
          name: 'Microsoft PowerPoint',
          supported: true
        };
      case 'txt':
        return {
          mimeType: 'text/plain',
          extension: '.txt',
          name: 'Plain Text',
          supported: true
        };
      case 'md':
        return {
          mimeType: 'text/markdown',
          extension: '.md',
          name: 'Markdown',
          supported: true
        };
      default:
        return {
          mimeType: 'application/octet-stream',
          extension: `.${ext}`,
          name: 'Unknown',
          supported: false
        };
    }
  }

  return {
    mimeType: 'application/octet-stream',
    extension: '.bin',
    name: 'Unknown',
    supported: false
  };
}

/**
 * Extracts text content from OpenDocument format files (ODT, ODS, ODP)
 * This is a basic implementation that extracts content.xml
 * 
 * @param buffer - File buffer
 * @returns Extracted text content
 */
export async function extractODFContent(buffer: ArrayBuffer): Promise<string> {
  try {
    // Try to import JSZip (peer dependency)
    let JSZip: any;
    try {
      JSZip = (await import('jszip')).default;
    } catch (e) {
      throw new Error('jszip is required for ODF document parsing. Install it with: npm install jszip');
    }

    const zip = await JSZip.loadAsync(buffer);
    const contentXml = await zip.file('content.xml')?.async('string');

    if (!contentXml) {
      throw new Error('content.xml not found in ODF document');
    }

    // Simple text extraction - remove XML tags
    let text = contentXml
      .replace(/<text:line-break\s*\/?>/g, '\n')
      .replace(/<text:tab\s*\/?>/g, '\t')
      .replace(/<text:s\s*text:c="(\d+)"\s*\/?>/g, (_: string, count: string) => ' '.repeat(parseInt(count)))
      .replace(/<text:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  } catch (error) {
    logger.error('Failed to extract ODF content', { error });
    throw new NetworkError(
      `Failed to extract ODF content: ${error instanceof Error ? error.message : String(error)}`,
      'document',
      'parse'
    );
  }
}

/**
 * Extracts text content from DOCX files
 * This is a basic implementation that extracts document.xml
 * 
 * @param buffer - File buffer
 * @returns Extracted text content
 */
export async function extractDOCXContent(buffer: ArrayBuffer): Promise<string> {
  try {
    // Try to import JSZip (peer dependency)
    let JSZip: any;
    try {
      JSZip = (await import('jszip')).default;
    } catch (e) {
      throw new Error('jszip is required for DOCX document parsing. Install it with: npm install jszip');
    }

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('word/document.xml not found in DOCX document');
    }

    // Simple text extraction - remove XML tags
    let text = documentXml
      .replace(/<w:br\s*\/?>/g, '\n')
      .replace(/<w:tab\s*\/?>/g, '\t')
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  } catch (error) {
    logger.error('Failed to extract DOCX content', { error });
    throw new NetworkError(
      `Failed to extract DOCX content: ${error instanceof Error ? error.message : String(error)}`,
      'document',
      'parse'
    );
  }
}

/**
 * Extracts metadata from OpenDocument format files
 * 
 * @param buffer - File buffer
 * @returns Document metadata
 */
export async function extractODFMetadata(buffer: ArrayBuffer): Promise<DocumentMetadata> {
  try {
    // Try to import JSZip (peer dependency)
    let JSZip: any;
    try {
      JSZip = (await import('jszip')).default;
    } catch (e) {
      throw new Error('jszip is required for ODF metadata extraction. Install it with: npm install jszip');
    }

    const zip = await JSZip.loadAsync(buffer);
    const metaXml = await zip.file('meta.xml')?.async('string');

    if (!metaXml) {
      return {};
    }

    const metadata: DocumentMetadata = {};

    // Extract title
    const titleMatch = /<dc:title>(.*?)<\/dc:title>/.exec(metaXml);
    if (titleMatch) metadata.title = titleMatch[1];

    // Extract author
    const authorMatch = /<dc:creator>(.*?)<\/dc:creator>/.exec(metaXml);
    if (authorMatch) metadata.author = authorMatch[1];

    // Extract subject
    const subjectMatch = /<dc:subject>(.*?)<\/dc:subject>/.exec(metaXml);
    if (subjectMatch) metadata.subject = subjectMatch[1];

    // Extract creation date
    const createdMatch = /<meta:creation-date>(.*?)<\/meta:creation-date>/.exec(metaXml);
    if (createdMatch) metadata.createdAt = new Date(createdMatch[1]);

    // Extract modification date
    const modifiedMatch = /<dc:date>(.*?)<\/dc:date>/.exec(metaXml);
    if (modifiedMatch) metadata.modifiedAt = new Date(modifiedMatch[1]);

    // Extract keywords
    const keywordsMatch = /<meta:keyword>(.*?)<\/meta:keyword>/g.exec(metaXml);
    if (keywordsMatch) {
      metadata.keywords = [keywordsMatch[1]];
    }

    return metadata;
  } catch (error) {
    logger.error('Failed to extract ODF metadata', { error });
    return {};
  }
}

/**
 * Parses a document and extracts content and metadata
 * 
 * @param buffer - File buffer
 * @param filename - Optional filename for format detection
 * @returns Parsed document with content and metadata
 */
export async function parseDocument(
  buffer: ArrayBuffer,
  filename?: string
): Promise<ParsedDocument> {
  const format = detectDocumentFormat(filename || buffer);

  if (!format.supported) {
    throw new Error(`Unsupported document format: ${format.name}`);
  }

  let content = '';
  let metadata: DocumentMetadata = {};

  try {
    // Extract content based on format
    if (format.mimeType === 'application/vnd.oasis.opendocument.text' ||
        format.extension === '.odt' ||
        format.extension === '.ods' ||
        format.extension === '.odp') {
      content = await extractODFContent(buffer);
      metadata = await extractODFMetadata(buffer);
    } else if (format.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
               format.extension === '.docx') {
      content = await extractDOCXContent(buffer);
    } else if (format.mimeType === 'text/plain' || format.extension === '.txt') {
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(buffer);
    } else if (format.mimeType === 'text/markdown' || format.extension === '.md') {
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(buffer);
    }

    return {
      content,
      metadata,
      format: format.name,
      size: buffer.byteLength
    };
  } catch (error) {
    logger.error('Failed to parse document', { error, format: format.name });
    throw new NetworkError(
      `Failed to parse document: ${error instanceof Error ? error.message : String(error)}`,
      'document',
      'parse'
    );
  }
}

/**
 * Converts plain text content to a simple HTML representation
 * 
 * @param text - Plain text content
 * @returns HTML string
 */
export function textToHTML(text: string): string {
  return text
    .split('\n')
    .map(line => `<p>${escapeHTML(line)}</p>`)
    .join('\n');
}

/**
 * Escapes HTML special characters
 * 
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHTML(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Calculates approximate word count from text
 * 
 * @param text - Text content
 * @returns Word count
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

/**
 * Extracts a preview/summary from text content
 * 
 * @param text - Full text content
 * @param maxLength - Maximum length of preview (default: 200)
 * @returns Preview text
 */
export function extractPreview(text: string, maxLength: number = 200): string {
  const cleanText = text.trim();
  
  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  // Try to break at a sentence boundary
  const truncated = cleanText.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > maxLength * 0.7) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }

  // Otherwise break at a word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace).trim() + '...';
  }

  return truncated + '...';
}
