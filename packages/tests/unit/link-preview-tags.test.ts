import { describe, it, expect } from 'vitest';
import { tagHandlers } from '../../framework/src/systems/conversation/tags/index.js';

function getHandler(tagName: string) {
  return tagHandlers.find((h) => h.tag === tagName);
}

describe('link preview tag handlers', () => {
  describe('linkUrl tag', () => {
    it('parses glossary URL', () => {
      const handler = getHandler('linkUrl');
      const result = handler?.handler('glossary:eiti', {});
      expect(result).toEqual({ linkUrl: 'glossary:eiti' });
    });

    it('parses external URL', () => {
      const handler = getHandler('linkUrl');
      const result = handler?.handler('https://example.com', {});
      expect(result).toEqual({ linkUrl: 'https://example.com' });
    });
  });

  describe('linkDomain tag', () => {
    it('parses domain', () => {
      const handler = getHandler('linkDomain');
      const result = handler?.handler('Glossary', {});
      expect(result).toEqual({ linkDomain: 'Glossary' });
    });
  });

  describe('linkTitle tag', () => {
    it('parses title', () => {
      const handler = getHandler('linkTitle');
      const result = handler?.handler('EITI', {});
      expect(result).toEqual({ linkTitle: 'EITI' });
    });
  });

  describe('linkDesc tag', () => {
    it('parses description', () => {
      const handler = getHandler('linkDesc');
      const result = handler?.handler('Extractive Industries Transparency Initiative', {});
      expect(result).toEqual({ linkDesc: 'Extractive Industries Transparency Initiative' });
    });
  });

  describe('linkImage tag', () => {
    it('parses image path', () => {
      const handler = getHandler('linkImage');
      const result = handler?.handler('/assets/icons/glossary.svg', {});
      expect(result).toEqual({ linkImage: '/assets/icons/glossary.svg' });
    });
  });

  describe('linkLayout tag', () => {
    it('parses card layout', () => {
      const handler = getHandler('linkLayout');
      const result = handler?.handler('card', {});
      expect(result).toEqual({ linkLayout: 'card' });
    });

    it('parses inline layout', () => {
      const handler = getHandler('linkLayout');
      const result = handler?.handler('inline', {});
      expect(result).toEqual({ linkLayout: 'inline' });
    });

    it('parses minimal layout', () => {
      const handler = getHandler('linkLayout');
      const result = handler?.handler('minimal', {});
      expect(result).toEqual({ linkLayout: 'minimal' });
    });
  });

  describe('linkVideo tag', () => {
    it('parses true value', () => {
      const handler = getHandler('linkVideo');
      const result = handler?.handler('true', {});
      expect(result).toEqual({ linkVideo: 'true' });
    });

    it('parses false value', () => {
      const handler = getHandler('linkVideo');
      const result = handler?.handler('false', {});
      expect(result).toEqual({ linkVideo: 'false' });
    });
  });
});
