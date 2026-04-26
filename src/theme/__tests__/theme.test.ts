import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing the module
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, // default to light
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Theme System', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset module cache so getStoredTheme re-evaluates
    vi.resetModules();
  });

  describe('ThemeColors interface compliance', () => {
    it('should have all 29 properties in THEMES.dark', async () => {
      const { THEMES } = await import('../index');
      const expectedKeys = [
        'bg', 'bgSub', 'card', 'cardHover', 'elevated', 'input',
        'teal', 'tealMuted', 'tealDeep', 'tealGlow', 'tealBorder',
        'amber', 'red', 'green',
        'text', 'textSec', 'textDim', 'border', 'white',
        'sidebarBg', 'headerBg', 'chatBubbleSophia', 'chatBubbleUser',
        'panelBg', 'inputBg', 'hoverBg', 'activeBg', 'shadowColor',
      ];
      for (const key of expectedKeys) {
        expect(THEMES.dark).toHaveProperty(key);
        expect(typeof (THEMES.dark as unknown as Record<string, unknown>)[key]).toBe('string');
      }
      expect(Object.keys(THEMES.dark)).toHaveLength(28);
    });

    it('should have all 28 properties in THEMES.light', async () => {
      const { THEMES } = await import('../index');
      const expectedKeys = [
        'bg', 'bgSub', 'card', 'cardHover', 'elevated', 'input',
        'teal', 'tealMuted', 'tealDeep', 'tealGlow', 'tealBorder',
        'amber', 'red', 'green',
        'text', 'textSec', 'textDim', 'border', 'white',
        'sidebarBg', 'headerBg', 'chatBubbleSophia', 'chatBubbleUser',
        'panelBg', 'inputBg', 'hoverBg', 'activeBg', 'shadowColor',
      ];
      for (const key of expectedKeys) {
        expect(THEMES.light).toHaveProperty(key);
        expect(typeof (THEMES.light as unknown as Record<string, unknown>)[key]).toBe('string');
      }
      expect(Object.keys(THEMES.light)).toHaveLength(28);
    });
  });

  describe('C initialization', () => {
    it('should initialize C with light theme when no localStorage and system is light', async () => {
      (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches: false, // light mode
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      const { C, THEMES } = await import('../index');
      expect(C.bg).toBe(THEMES.light.bg);
      expect(C.teal).toBe(THEMES.light.teal);
    });

    it('should initialize C with dark theme when localStorage has dark', async () => {
      localStorageMock.setItem('sophia-theme', 'dark');
      const { C, THEMES } = await import('../index');
      expect(C.bg).toBe(THEMES.dark.bg);
      expect(C.teal).toBe(THEMES.dark.teal);
    });
  });

  describe('getStoredTheme', () => {
    it('should return dark when localStorage has dark', async () => {
      localStorageMock.setItem('sophia-theme', 'dark');
      const { getStoredTheme } = await import('../index');
      expect(getStoredTheme()).toBe('dark');
    });

    it('should return light when localStorage has light', async () => {
      localStorageMock.setItem('sophia-theme', 'light');
      const { getStoredTheme } = await import('../index');
      expect(getStoredTheme()).toBe('light');
    });

    it('should respect matchMedia when no stored value and system prefers dark', async () => {
      (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches: true, // dark mode
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      const { getStoredTheme } = await import('../index');
      expect(getStoredTheme()).toBe('dark');
    });
  });

  describe('ThemeProvider', () => {
    it('should toggle mode between dark and light', async () => {
      // Ensure clean state: no localStorage, matchMedia returns light
      localStorageMock.clear();
      (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { renderHook, act } = await import('@testing-library/react');
      const React = await import('react');
      const { ThemeProvider, useThemeMode } = await import('../index');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, null, children);

      const { result } = renderHook(() => useThemeMode(), { wrapper });

      // Initial mode is light (no localStorage, matchMedia returns false)
      expect(result.current.mode).toBe('light');

      // Toggle to dark
      act(() => { result.current.toggle(); });
      expect(result.current.mode).toBe('dark');

      // Toggle back to light
      act(() => { result.current.toggle(); });
      expect(result.current.mode).toBe('light');
    });

    it('should save mode to localStorage on toggle', async () => {
      localStorageMock.clear();
      (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { renderHook, act } = await import('@testing-library/react');
      const React = await import('react');
      const { ThemeProvider, useThemeMode } = await import('../index');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(ThemeProvider, null, children);

      const { result } = renderHook(() => useThemeMode(), { wrapper });

      act(() => { result.current.toggle(); });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('sophia-theme', 'dark');
    });
  });
});
