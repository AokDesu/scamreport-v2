import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '@/i18n';

// jsdom lacks these browser APIs used by Radix primitives and the evidence picker.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
Element.prototype.hasPointerCapture ??= () => false;
URL.createObjectURL ??= () => 'blob:test';
URL.revokeObjectURL ??= () => {};
window.scrollTo = () => {};

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await i18n.changeLanguage('th');
});
