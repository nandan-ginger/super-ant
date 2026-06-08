/**
 * Ginger LiveChat AI Copilot — Context Extractor
 * ================================================
 * Runs inside the host website's browser context.
 * Extracts structured, clean page content for AI consumption.
 *
 * Exported function: extractPageContext()
 * Returns: { title, url, description, headings, visibleText, tables, forms }
 */

(function (global) {
  'use strict';

  // ─── Noise Selectors ──────────────────────────────────────────────────────
  // Elements that contain navigation/chrome — not business content
  const NOISE_SELECTORS = [
    'nav', 'header', 'footer',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.cookie-banner', '.cookie-notice', '.cookie-consent',
    '.gdpr', '.cc-banner',
    '#cookie-notice', '#cookie-banner',
    '.navbar', '.nav-menu', '.site-header', '.site-footer',
    '.breadcrumb', '.pagination',
    '.advertisement', '.ad', '[data-ad]',
    'script', 'style', 'noscript', 'iframe',
    '.ginger-livechat-widget', // exclude our own widget
  ];

  /**
   * Clone the document body and strip all noise elements.
   * Returns a detached element — safe to manipulate without affecting the page.
   * @returns {HTMLElement}
   */
  function getCleanBody() {
    const clone = document.body.cloneNode(true);
    NOISE_SELECTORS.forEach((selector) => {
      try {
        clone.querySelectorAll(selector).forEach((el) => el.remove());
      } catch (_) {}
    });
    // Remove hidden elements
    clone.querySelectorAll('[aria-hidden="true"], [hidden]').forEach((el) => el.remove());
    // Remove elements with display:none or visibility:hidden
    clone.querySelectorAll('*').forEach((el) => {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          el.remove();
        }
      } catch (_) {}
    });
    return clone;
  }

  /**
   * Extract all heading text from the page (h1–h6).
   * @returns {string[]}
   */
  function extractHeadings() {
    const headings = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const text = h.innerText?.trim();
      if (text && text.length > 1) headings.push(text);
    });
    return [...new Set(headings)]; // deduplicate
  }

  /**
   * Extract visible text from the cleaned body.
   * @param {HTMLElement} cleanBody
   * @returns {string}
   */
  function extractVisibleText(cleanBody) {
    // Replace block-level elements with newlines to preserve structure
    const blockTags = ['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'DT', 'DD', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    cleanBody.querySelectorAll(blockTags.join(',')).forEach((el) => {
      el.prepend(document.createTextNode('\n'));
    });

    let text = cleanBody.innerText || cleanBody.textContent || '';
    // Normalise whitespace: collapse multiple blank lines, trim lines
    text = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    return text;
  }

  /**
   * Extract all visible tables as formatted text.
   * @returns {string[]}
   */
  function extractTables() {
    const tables = [];
    document.querySelectorAll('table').forEach((table) => {
      const rows = [];
      table.querySelectorAll('tr').forEach((tr) => {
        const cells = [];
        tr.querySelectorAll('th, td').forEach((cell) => {
          cells.push(cell.innerText?.trim() || '');
        });
        if (cells.some(Boolean)) rows.push(cells.join(' | '));
      });
      if (rows.length > 0) tables.push(rows.join('\n'));
    });
    return tables;
  }

  /**
   * Extract form field labels and placeholders (useful for understanding page purpose).
   * @returns {Array<{label: string, type: string, placeholder: string}>}
   */
  function extractForms() {
    const forms = [];
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      // Skip hidden, submit, button, and password fields
      if (['hidden', 'submit', 'button', 'password', 'file'].includes(el.type)) return;

      // Find associated label
      let label = '';
      if (el.id) {
        const labelEl = document.querySelector(`label[for="${el.id}"]`);
        if (labelEl) label = labelEl.innerText?.trim() || '';
      }
      if (!label) {
        const parentLabel = el.closest('label');
        if (parentLabel) label = parentLabel.innerText?.trim() || '';
      }

      forms.push({
        label: label || el.name || el.id || '',
        type: el.type || el.tagName.toLowerCase(),
        placeholder: el.placeholder || '',
      });
    });
    return forms;
  }

  /**
   * Rough token estimator (mirrors backend logic).
   * @param {string} text
   * @returns {number}
   */
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
  }

  /**
   * Main extraction function.
   * Call this to get a structured context object representing the current page.
   *
   * @returns {{
   *   title: string,
   *   url: string,
   *   description: string,
   *   headings: string[],
   *   visibleText: string,
   *   tables: string[],
   *   forms: object[],
   *   estimatedTokens: number,
   *   extractedAt: string
   * }}
   */
  function extractPageContext() {
    const title = document.title?.trim() || '';
    const url = window.location.href;
    const description =
      document.querySelector('meta[name="description"]')?.content?.trim() ||
      document.querySelector('meta[property="og:description"]')?.content?.trim() ||
      '';

    const headings = extractHeadings();
    const cleanBody = getCleanBody();
    const visibleText = extractVisibleText(cleanBody);
    const tables = extractTables();
    const forms = extractForms();

    const fullTextEstimate = [title, description, visibleText, ...tables].join(' ');
    const estimatedTokens = estimateTokens(fullTextEstimate);

    return {
      title,
      url,
      description,
      headings,
      visibleText,
      tables,
      forms,
      estimatedTokens,
      extractedAt: new Date().toISOString(),
    };
  }

  // Expose on the global Ginger namespace
  global.GingerContextExtractor = { extractPageContext };

})(window);
