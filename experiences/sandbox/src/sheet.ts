// A shadow root's stylesheet, written as a `css` template so the stylesheet lint reads it, and built
// through CSSOM: an adopted sheet is no `<style>` element, so `style-src 'self'` allows it.

/**
 * A constructable stylesheet holding a template's rules. The tag takes no substitution: a sheet's
 * values come from its tokens.
 * @param {TemplateStringsArray} rules The template's text.
 * @returns {CSSStyleSheet} The sheet, ready to adopt.
 */
function css(rules: TemplateStringsArray): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  // oxlint-disable-next-line node/no-sync -- replaceSync is CSSOM, not Node I/O: the async replace would let the shadow root paint unstyled first
  sheet.replaceSync(rules.join(''));
  return sheet;
}

export { css };
