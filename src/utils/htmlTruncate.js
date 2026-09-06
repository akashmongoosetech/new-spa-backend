import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Strip all HTML tags and return plain text
 */
export function stripHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Truncate text at word boundary (not mid-word)
 */
export function truncateAtWordBoundary(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace === -1) {
    return truncated.trim();
  }
  
  return truncated.slice(0, lastSpace).trim();
}

/**
 * Generate excerpt from HTML content:
 * 1. Strip HTML tags
 * 2. Truncate at word boundary
 * 3. Return plain text
 */
export function generateExcerpt(html, maxLength = 200) {
  if (!html) return '';
  const plainText = stripHtml(html);
  return truncateAtWordBoundary(plainText, maxLength);
}

/**
 * Generate safe HTML excerpt from HTML content:
 * 1. Sanitize with DOMPurify (keep allowed tags)
 * 2. Truncate at word boundary (preserving tag structure)
 * 3. Return safe HTML
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li',
  'a', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
];

const ALLOWED_ATTRS = ['href', 'target', 'rel', 'title'];

export function generateExcerptHtml(html, maxLength = 200) {
  if (!html) return '';
  
  // First sanitize to keep only allowed tags
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
  
  // If already short enough, return as-is
  if (sanitized.length <= maxLength) return sanitized;
  
  // Truncate while preserving tag structure
  return truncateHtmlAtWordBoundary(sanitized, maxLength);
}

/**
 * Truncate HTML at word boundary while keeping tags balanced
 */
function truncateHtmlAtWordBoundary(html, maxLength) {
  if (!html || html.length <= maxLength) return html;
  
  // Parse HTML into DOM to manipulate
  const dom = new JSDOM(`<div>${html}</div>`);
  const document = dom.window.document;
  const container = document.querySelector('div');
  
  let currentLength = 0;
  const maxLen = maxLength;
  
  function truncateNode(node) {
    if (currentLength >= maxLen) {
      node.remove();
      return true;
    }
    
    if (node.nodeType === 3) { // Text node
      const text = node.textContent || '';
      const remaining = maxLen - currentLength;
      
      if (text.length > remaining) {
        const truncated = truncateAtWordBoundary(text, remaining);
        node.textContent = truncated;
        currentLength += truncated.length;
        return true; // Stop processing
      }
      currentLength += text.length;
    } else if (node.nodeType === 1) { // Element node
      // Process children
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (truncateNode(child)) {
          return true;
        }
      }
      // If element is empty after truncation, remove it
      if (node.childNodes.length === 0 && node.tagName !== 'BR') {
        node.remove();
      }
    }
    return false;
  }
  
  truncateNode(container);
  
  // Get the inner HTML back
  return container.innerHTML;
}

/**
 * Get excerpt length from environment or use default
 */
export function getExcerptLength() {
  return parseInt(process.env.EXCERPT_LENGTH || '200', 10);
}

export default {
  stripHtml,
  truncateAtWordBoundary,
  generateExcerpt,
  generateExcerptHtml,
  getExcerptLength,
};