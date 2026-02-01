import { describe, it, expect } from 'vitest';
import {
  hashName,
  avatarInitials,
  avatarColors,
  avatarColorForName,
  namedColorToCss,
  renderAvatar,
} from '../../framework/src/systems/conversation/utils/avatar.js';

// ---------------------------------------------------------------------------
// hashName
// ---------------------------------------------------------------------------
describe('hashName', () => {
  it('returns a non-negative integer', () => {
    expect(hashName('Alice')).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashName('Alice'))).toBe(true);
  });

  it('is deterministic', () => {
    expect(hashName('Bob')).toBe(hashName('Bob'));
  });

  it('produces different values for different strings', () => {
    expect(hashName('Alice')).not.toBe(hashName('Bob'));
  });

  it('handles empty string', () => {
    expect(hashName('')).toBe(5381); // djb2 seed
  });

  it('handles unicode', () => {
    const h = hashName('日本語');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// avatarInitials
// ---------------------------------------------------------------------------
describe('avatarInitials', () => {
  it('single word → one letter', () => {
    expect(avatarInitials('Alice')).toBe('A');
  });

  it('two words → first + last initials', () => {
    expect(avatarInitials('Alex Chen')).toBe('AC');
  });

  it('three words → first + last initials', () => {
    expect(avatarInitials('Maria Santos Lopez')).toBe('ML');
  });

  it('filters parenthetical words', () => {
    expect(avatarInitials('Pat (Editor)')).toBe('P');
  });

  it('filters parenthetical between normal words', () => {
    expect(avatarInitials('Gov (Official) Wire')).toBe('GW');
  });

  it('returns ? for empty string', () => {
    expect(avatarInitials('')).toBe('?');
  });

  it('uppercases lowercase input', () => {
    expect(avatarInitials('alice chen')).toBe('AC');
  });

  it('handles extra whitespace', () => {
    expect(avatarInitials('  Alex   Chen  ')).toBe('AC');
  });
});

// ---------------------------------------------------------------------------
// avatarColors
// ---------------------------------------------------------------------------
describe('avatarColors', () => {
  it('returns bg and fg HSL strings', () => {
    const { bg, fg } = avatarColors('Alice');
    expect(bg).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(fg).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it('bg and fg share the same hue and saturation', () => {
    const { bg, fg } = avatarColors('Alice');
    const bgMatch = bg.match(/hsl\((\d+), (\d+)%/);
    const fgMatch = fg.match(/hsl\((\d+), (\d+)%/);
    expect(bgMatch![1]).toBe(fgMatch![1]); // same hue
    expect(bgMatch![2]).toBe(fgMatch![2]); // same saturation
  });

  it('bg lightness > fg lightness (lighter bg, darker text)', () => {
    const { bg, fg } = avatarColors('Alice');
    const bgL = Number(bg.match(/(\d+)%\)$/)![1]);
    const fgL = Number(fg.match(/(\d+)%\)$/)![1]);
    expect(bgL).toBeGreaterThan(fgL);
  });

  it('is deterministic', () => {
    expect(avatarColors('Bob')).toEqual(avatarColors('Bob'));
  });
});

// ---------------------------------------------------------------------------
// namedColorToCss
// ---------------------------------------------------------------------------
describe('namedColorToCss', () => {
  it('resolves known color names', () => {
    const result = namedColorToCss('purple');
    expect(result).not.toBeNull();
    expect(result!.bg).toMatch(/^hsl\(/);
  });

  it('returns null for unknown names', () => {
    expect(namedColorToCss('chartreuse')).toBeNull();
  });

  it('gray has 0 saturation', () => {
    const { bg } = namedColorToCss('gray')!;
    expect(bg).toMatch(/hsl\(0, 0%/);
  });
});

// ---------------------------------------------------------------------------
// renderAvatar
// ---------------------------------------------------------------------------
describe('renderAvatar', () => {
  it('renders initials avatar with inline styles', () => {
    const html = renderAvatar({ title: 'Alex Chen' });
    expect(html).toContain('AC');
    expect(html).toContain('class="avatar"');
    expect(html).toContain('style="background:hsl(');
    expect(html).toContain('color:hsl(');
  });

  it('renders image avatar when avatarImage is set', () => {
    const html = renderAvatar({ title: 'Notes', avatarImage: 'avatars/notes-icon.svg' });
    expect(html).toContain('avatar-image');
    expect(html).toContain('<img src="assets/avatars/notes-icon.svg"');
  });

  it('respects avatarColorName override', () => {
    const html = renderAvatar({ title: 'Notes', avatarColorName: 'purple' });
    expect(html).toContain('hsl(270, 40%');
  });

  it('respects legacy avatarColor override', () => {
    const html = renderAvatar({ title: 'Test', avatarColor: '#ff0000' });
    expect(html).toContain('background:#ff0000');
  });

  it('respects avatarLetter override', () => {
    const html = renderAvatar({ title: 'Test', avatarLetter: 'ZZ' });
    expect(html).toContain('ZZ');
  });

  it('applies custom cssClass', () => {
    const html = renderAvatar({ title: 'Test' }, { cssClass: 'banner-avatar' });
    expect(html).toContain('class="banner-avatar"');
  });
});
