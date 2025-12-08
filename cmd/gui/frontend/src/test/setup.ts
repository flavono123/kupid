import '@testing-library/jest-dom';

// Mock ResizeObserver for jsdom environment
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView for jsdom environment
Element.prototype.scrollIntoView = function() {};
