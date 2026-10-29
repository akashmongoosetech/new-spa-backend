import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Rich-text allowlist. This is intentionally shared by every blog HTML field
 * (excerpt, content and custom sections). Anything not listed here is removed
 * on the server before it is stored.
 */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
  'sub', 'sup', 'mark', 'small',
  'ul', 'ol', 'li',
  'a', 'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
  'hr', 'div', 'span', 'figure', 'figcaption',
  'img',
];

const ALLOWED_ATTRS = [
  'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height', 'loading', 'decoding',
  'style', 'colspan', 'rowspan', 'scope',
];

const ALLOWED_STYLE_PROPS = new Set([
  'text-align', 'font-weight', 'font-style', 'text-decoration',
  'color', 'background-color', 'font-size', 'font-family', 'line-height',
  'width', 'height', 'max-width',
]);

const SAFE_URI = /^(?:(?:https?|mailto|tel):|\/(?!\/)|#|\.{0,2}\/)/i;

function cleanStyle(style = '') {
  return String(style)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const [prop] = part.split(':');
      if (!prop || !ALLOWED_STYLE_PROPS.has(prop.trim().toLowerCase())) return false;
      return !/url\s*\(|expression\s*\(|@import|behavior\s*:/i.test(part);
    })
    .join('; ');
}

function isSafeUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return false;
  if (!SAFE_URI.test(url)) return false;
  return !/^(?:javascript|data|vbscript|file):/i.test(url);
}

function cleanAttributes(element) {
  for (const attr of Array.from(element.attributes || [])) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || name === 'id' || name === 'class') {
      element.removeAttribute(attr.name);
      continue;
    }
    if (!ALLOWED_ATTRS.includes(name)) {
      element.removeAttribute(attr.name);
      continue;
    }
    if (name === 'style') {
      const style = cleanStyle(attr.value);
      if (style) element.setAttribute('style', style);
      else element.removeAttribute('style');
      continue;
    }
    if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
      element.removeAttribute(attr.name);
    }
  }

  if (element.tagName === 'A') {
    if (!element.getAttribute('href')) {
      // Keep the link text, but remove the now-useless anchor wrapper.
      const parent = element.parentNode;
      if (parent) {
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        element.remove();
      }
      return;
    }
    if (element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    } else {
      element.removeAttribute('target');
    }
  }

  if (element.tagName === 'IMG' && !element.getAttribute('src')) {
    element.remove();
  }
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Sanitize editor-generated HTML. The editor is never trusted: this allowlist
 * is the source of truth for what can be persisted and rendered publicly.
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  const purified = DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ALLOWED_URI_REGEXP: SAFE_URI,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio'],
    FORBID_ATTR: ['srcset', 'formaction', 'xlink:href'],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });

  const dom = new JSDOM(`<body>${purified}</body>`);
  const body = dom.window.document.body;
  for (const element of Array.from(body.querySelectorAll('*'))) {
    cleanAttributes(element);
  }

  // Remove empty paragraphs left behind by editor clear-format actions.
  for (const paragraph of Array.from(body.querySelectorAll('p'))) {
    if (!paragraph.textContent.trim() && !paragraph.querySelector('img,br,hr,table')) {
      paragraph.remove();
    }
  }

  return body.innerHTML;
}

/**
 * Convert sanitized HTML into plain text for excerpts, metadata and search.
 */
export function extractText(html) {
  if (!html) return '';
  const dom = new JSDOM(`<body>${String(html)}</body>`);
  const body = dom.window.document.body;
  body.querySelectorAll('script,style,noscript,template').forEach((node) => node.remove());
  return (body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate reading time from visible article text only. Defaults to 220 WPM,
 * which is configurable with BLOG_READING_WPM.
 */
export function calculateReadTime(html, wordsPerMinute = Number(process.env.BLOG_READING_WPM) || 220) {
  const text = Array.isArray(html) ? html.map(extractText).join(' ') : extractText(html);
  if (!text) return 1;
  const words = text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.max(1, Math.ceil(words / Math.max(100, wordsPerMinute)));
}

export function truncateText(value, maxLength = 160) {
  const text = extractText(value);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > Math.floor(maxLength * 0.6) ? cut.slice(0, lastSpace) : cut).trim();
}

export default {
  sanitizeHtml,
  escapeHtml,
  calculateReadTime,
  extractText,
  truncateText,
};
