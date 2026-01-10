import { describe, it, expect } from 'vitest';
import {
  getResourceKey,
  diffFields,
} from './resource-utils';

describe('getResourceKey', () => {
  it('should generate key from context, namespace, and name', () => {
    const resource = {
      _context: 'prod-cluster',
      metadata: {
        namespace: 'default',
        name: 'my-pod',
      },
    };

    expect(getResourceKey(resource)).toBe('prod-cluster/default/my-pod');
  });

  it('should handle cluster-scoped resources (no namespace)', () => {
    const resource = {
      _context: 'prod-cluster',
      metadata: {
        name: 'my-node',
      },
    };

    expect(getResourceKey(resource)).toBe('prod-cluster//my-node');
  });

  it('should handle missing context', () => {
    const resource = {
      metadata: {
        namespace: 'kube-system',
        name: 'coredns',
      },
    };

    expect(getResourceKey(resource)).toBe('/kube-system/coredns');
  });

  it('should handle missing metadata', () => {
    const resource = {
      _context: 'test-cluster',
    };

    expect(getResourceKey(resource)).toBe('test-cluster//');
  });

  it('should handle empty object', () => {
    expect(getResourceKey({})).toBe('//');
  });
});

describe('diffFields', () => {
  it('should return empty array for identical objects', () => {
    const obj = { a: 1, b: 'hello' };
    expect(diffFields(obj, obj)).toEqual([]);
  });

  it('should detect changed leaf values', () => {
    const prev = { status: { phase: 'Running' } };
    const next = { status: { phase: 'Pending' } };
    expect(diffFields(prev, next)).toContain('status.phase');
  });

  it('should detect multiple changed fields', () => {
    const prev = { a: 1, b: 2, c: 3 };
    const next = { a: 1, b: 20, c: 30 };
    const changes = diffFields(prev, next);
    expect(changes).toContain('b');
    expect(changes).toContain('c');
    expect(changes).not.toContain('a');
  });

  it('should detect deeply nested changes', () => {
    const prev = { spec: { containers: { image: 'nginx:1.0' } } };
    const next = { spec: { containers: { image: 'nginx:2.0' } } };
    expect(diffFields(prev, next)).toContain('spec.containers.image');
  });

  it('should detect added fields', () => {
    const prev = { a: 1 };
    const next = { a: 1, b: 2 };
    expect(diffFields(prev, next)).toContain('b');
  });

  it('should detect removed fields', () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1 };
    expect(diffFields(prev, next)).toContain('b');
  });

  it('should handle null to value change', () => {
    const prev = { a: null };
    const next = { a: 'value' };
    expect(diffFields(prev, next)).toContain('a');
  });

  it('should handle value to null change', () => {
    const prev = { a: 'value' };
    const next = { a: null };
    expect(diffFields(prev, next)).toContain('a');
  });

  it('should handle undefined to value change', () => {
    const prev = { a: undefined };
    const next = { a: 'value' };
    expect(diffFields(prev, next)).toContain('a');
  });

  it('should treat array changes as single field change', () => {
    const prev = { items: [1, 2, 3] };
    const next = { items: [1, 2, 3, 4] };
    expect(diffFields(prev, next)).toEqual(['items']);
  });

  it('should return empty for identical arrays', () => {
    const prev = { items: [1, 2, 3] };
    const next = { items: [1, 2, 3] };
    expect(diffFields(prev, next)).toEqual([]);
  });

  it('should handle empty objects', () => {
    expect(diffFields({}, {})).toEqual([]);
  });

  it('should handle both null', () => {
    expect(diffFields(null, null)).toEqual([]);
  });

  it('should handle one null one object', () => {
    expect(diffFields(null, { a: 1 })).toEqual([]);
    expect(diffFields({ a: 1 }, null)).toEqual([]);
  });
});
