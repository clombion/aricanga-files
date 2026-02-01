import { describe, it, expect } from 'vitest';
import {
  createTextMessage,
  createAudioMessage,
  createImageMessage,
  createAttachmentMessage,
  createLinkPreviewMessage,
  isLinkPreviewMessage,
} from '../../framework/src/systems/conversation/types.js';

describe('message factory functions', () => {
  describe('receipt defaults', () => {
    it('sent text messages default to delivered receipt', () => {
      const msg = createTextMessage({ text: 'Hello', type: 'sent' });
      expect(msg.receipt).toBe('delivered');
    });

    it('sent audio messages default to delivered receipt', () => {
      const msg = createAudioMessage({
        transcript: 'Voice memo',
        type: 'sent',
      });
      expect(msg.receipt).toBe('delivered');
    });

    it('sent image messages default to delivered receipt', () => {
      const msg = createImageMessage({
        imageSrc: '/photo.jpg',
        type: 'sent',
      });
      expect(msg.receipt).toBe('delivered');
    });

    it('sent attachment messages default to delivered receipt', () => {
      const msg = createAttachmentMessage({
        attachmentSrc: '/doc.pdf',
        type: 'sent',
      });
      expect(msg.receipt).toBe('delivered');
    });

    it('received messages default to none receipt', () => {
      const msg = createTextMessage({ text: 'Hello', type: 'received' });
      expect(msg.receipt).toBe('none');
    });

    it('explicit receipt overrides default', () => {
      const msg = createTextMessage({
        text: 'Hello',
        type: 'sent',
        receipt: 'read',
      });
      expect(msg.receipt).toBe('read');
    });
  });

  describe('quote and label support', () => {
    it('text message includes quote when provided', () => {
      const quote = { text: 'Original message', speaker: 'Pat' };
      const msg = createTextMessage({ text: 'Reply', type: 'sent', quote });
      expect(msg.quote).toEqual(quote);
    });

    it('text message includes label when provided', () => {
      const msg = createTextMessage({
        text: 'Hello',
        type: 'received',
        label: 'greeting-1',
      });
      expect(msg.label).toBe('greeting-1');
    });

    it('audio message includes quote when provided', () => {
      const quote = { imageSrc: '/photo.jpg', speaker: 'Editor' };
      const msg = createAudioMessage({
        transcript: 'Voice reply',
        type: 'sent',
        quote,
      });
      expect(msg.quote).toEqual(quote);
    });

    it('audio message includes label when provided', () => {
      const msg = createAudioMessage({
        transcript: 'Voice memo',
        type: 'received',
        label: 'voice-1',
      });
      expect(msg.label).toBe('voice-1');
    });

    it('image message includes quote when provided', () => {
      const quote = { audioTranscript: 'Check this out', speaker: 'Spectre' };
      const msg = createImageMessage({
        imageSrc: '/photo.jpg',
        type: 'sent',
        quote,
      });
      expect(msg.quote).toEqual(quote);
    });

    it('image message includes label when provided', () => {
      const msg = createImageMessage({
        imageSrc: '/photo.jpg',
        type: 'received',
        label: 'photo-1',
      });
      expect(msg.label).toBe('photo-1');
    });

    it('attachment message includes quote when provided', () => {
      const quote = { text: 'Here is the doc', speaker: 'Pat' };
      const msg = createAttachmentMessage({
        attachmentSrc: '/report.pdf',
        type: 'sent',
        quote,
      });
      expect(msg.quote).toEqual(quote);
    });

    it('attachment message includes label when provided', () => {
      const msg = createAttachmentMessage({
        attachmentSrc: '/report.pdf',
        type: 'received',
        label: 'doc-1',
      });
      expect(msg.label).toBe('doc-1');
    });

    it('omits quote and label when not provided', () => {
      const msg = createTextMessage({ text: 'Plain message', type: 'sent' });
      expect(msg).not.toHaveProperty('quote');
      expect(msg).not.toHaveProperty('label');
    });
  });

  describe('link preview messages', () => {
    it('creates link preview with required fields', () => {
      const msg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'sent',
      });
      expect(msg.kind).toBe('linkPreview');
      expect(msg.url).toBe('glossary:eiti');
      expect(msg.type).toBe('sent');
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeDefined();
    });

    it('defaults layout to card', () => {
      const msg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'sent',
      });
      expect(msg.layout).toBe('card');
    });

    it('defaults isVideo to false', () => {
      const msg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'sent',
      });
      expect(msg.isVideo).toBe(false);
    });

    it('sent link preview messages default to delivered receipt', () => {
      const msg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'sent',
      });
      expect(msg.receipt).toBe('delivered');
    });

    it('received link preview messages default to none receipt', () => {
      const msg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'received',
      });
      expect(msg.receipt).toBe('none');
    });

    it('includes all optional preview fields', () => {
      const msg = createLinkPreviewMessage({
        url: 'https://example.com',
        domain: 'example.com',
        title: 'Example Site',
        description: 'A description',
        imageSrc: '/image.jpg',
        layout: 'inline',
        isVideo: true,
        type: 'sent',
      });
      expect(msg.domain).toBe('example.com');
      expect(msg.title).toBe('Example Site');
      expect(msg.description).toBe('A description');
      expect(msg.imageSrc).toBe('/image.jpg');
      expect(msg.layout).toBe('inline');
      expect(msg.isVideo).toBe(true);
    });

    it('includes quote when provided', () => {
      const quote = { text: 'Check this link', speaker: 'Pat' };
      const msg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'sent',
        quote,
      });
      expect(msg.quote).toEqual(quote);
    });

    it('includes label when provided', () => {
      const msg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'received',
        label: 'glossary-link-1',
      });
      expect(msg.label).toBe('glossary-link-1');
    });

    it('isLinkPreviewMessage type guard works', () => {
      const linkMsg = createLinkPreviewMessage({
        url: 'glossary:eiti',
        type: 'sent',
      });
      const textMsg = createTextMessage({ text: 'Hello', type: 'sent' });

      expect(isLinkPreviewMessage(linkMsg)).toBe(true);
      expect(isLinkPreviewMessage(textMsg)).toBe(false);
    });
  });
});
