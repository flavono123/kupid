import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isInputElementFocused } from './dom-utils';

describe('isInputElementFocused', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should return true when input element is focused', () => {
    const input = document.createElement('input');
    container.appendChild(input);
    input.focus();

    expect(isInputElementFocused()).toBe(true);
  });

  it('should return true when textarea element is focused', () => {
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);
    textarea.focus();

    expect(isInputElementFocused()).toBe(true);
  });

  it('should return true when contenteditable element is focused', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    container.appendChild(div);
    div.focus();

    expect(isInputElementFocused()).toBe(true);
  });

  it('should return false when regular div is focused', () => {
    const div = document.createElement('div');
    div.tabIndex = 0; // Make it focusable
    container.appendChild(div);
    div.focus();

    expect(isInputElementFocused()).toBe(false);
  });

  it('should return false when button is focused', () => {
    const button = document.createElement('button');
    container.appendChild(button);
    button.focus();

    expect(isInputElementFocused()).toBe(false);
  });

  it('should return false when nothing is focused', () => {
    // Focus on body (default state)
    document.body.focus();

    expect(isInputElementFocused()).toBe(false);
  });
});
