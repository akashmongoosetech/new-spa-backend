import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'ul', 'ol', 'li',
  'a', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'div', 'span',
  'img',
];

const ALLOWED_ATTRS = [
  'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height',
  'style', 'class', 'id',
  'colspan', 'rowspan',
];

const ALLOWED_STYLES = [
  'text-align', 'font-weight', 'font-style', 'text-decoration',
  'color', 'background-color', 'font-size', 'line-height',
  'margin', 'padding', 'border', 'width', 'height',
];

export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOWED_STYLE: ALLOWED_STYLES,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

export function calculateReadTime(html) {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(' ').filter(w => w.length > 0).length;
  const minutes = Math.ceil(words / 200);
  return minutes || 1;
}

export default { sanitizeHtml, calculateReadTime };