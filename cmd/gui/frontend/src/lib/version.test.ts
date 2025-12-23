import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersions } from './version';

describe('parseVersion', () => {
  it('parses stable versions', () => {
    expect(parseVersion('v1')).toEqual({ major: 1, stability: 3, stabilityOrder: 0 });
    expect(parseVersion('v2')).toEqual({ major: 2, stability: 3, stabilityOrder: 0 });
  });

  it('parses beta versions', () => {
    expect(parseVersion('v1beta1')).toEqual({ major: 1, stability: 2, stabilityOrder: 1 });
    expect(parseVersion('v1beta2')).toEqual({ major: 1, stability: 2, stabilityOrder: 2 });
  });

  it('parses alpha versions', () => {
    expect(parseVersion('v1alpha1')).toEqual({ major: 1, stability: 1, stabilityOrder: 1 });
    expect(parseVersion('v2alpha3')).toEqual({ major: 2, stability: 1, stabilityOrder: 3 });
  });

  it('handles versions without stability suffix number', () => {
    expect(parseVersion('v1beta')).toEqual({ major: 1, stability: 2, stabilityOrder: 0 });
    expect(parseVersion('v1alpha')).toEqual({ major: 1, stability: 1, stabilityOrder: 0 });
  });

  it('handles invalid versions gracefully', () => {
    expect(parseVersion('invalid')).toEqual({ major: 0, stability: 3, stabilityOrder: 0 });
    expect(parseVersion('')).toEqual({ major: 0, stability: 3, stabilityOrder: 0 });
  });
});

describe('compareVersions', () => {
  it('sorts by major version (higher first)', () => {
    expect(compareVersions('v2', 'v1')).toBeLessThan(0);
    expect(compareVersions('v1', 'v2')).toBeGreaterThan(0);
    expect(compareVersions('v1', 'v1')).toBe(0);
  });

  it('sorts by stability (stable > beta > alpha)', () => {
    expect(compareVersions('v1', 'v1beta1')).toBeLessThan(0);
    expect(compareVersions('v1beta1', 'v1alpha1')).toBeLessThan(0);
    expect(compareVersions('v1alpha1', 'v1')).toBeGreaterThan(0);
  });

  it('sorts by stability order (higher first)', () => {
    expect(compareVersions('v1beta2', 'v1beta1')).toBeLessThan(0);
    expect(compareVersions('v1alpha2', 'v1alpha1')).toBeLessThan(0);
  });

  it('handles complex version comparisons', () => {
    const versions = ['v1alpha1', 'v1beta1', 'v1', 'v2beta1', 'v2'];
    const sorted = [...versions].sort(compareVersions);
    expect(sorted).toEqual(['v2', 'v2beta1', 'v1', 'v1beta1', 'v1alpha1']);
  });
});
