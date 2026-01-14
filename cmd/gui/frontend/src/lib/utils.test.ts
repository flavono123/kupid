import { describe, it, expect } from 'vitest';
import { pluralize } from './utils';

describe('pluralize', () => {
  it('adds -ies for consonant + y', () => {
    expect(pluralize('policy')).toBe('policies');
    expect(pluralize('Policy')).toBe('Policies');
    expect(pluralize('repository')).toBe('repositories');
  });

  it('adds -s for vowel + y', () => {
    expect(pluralize('key')).toBe('keys');
    expect(pluralize('day')).toBe('days');
  });

  it('adds -es for s, x, ch, sh endings', () => {
    expect(pluralize('status')).toBe('statuses');
    expect(pluralize('ingress')).toBe('ingresses');
    expect(pluralize('prefix')).toBe('prefixes');
    expect(pluralize('watch')).toBe('watches');
    expect(pluralize('mesh')).toBe('meshes');
  });

  it('adds -s for regular words', () => {
    expect(pluralize('pod')).toBe('pods');
    expect(pluralize('node')).toBe('nodes');
    expect(pluralize('service')).toBe('services');
    expect(pluralize('deployment')).toBe('deployments');
    expect(pluralize('resource')).toBe('resources');
  });
});
