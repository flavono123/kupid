import { describe, it, expect } from 'vitest';
import {
  getResourceKey,
  applyBatchEvents,
  applyBatchEventsWithChanges,
  diffFields,
  type ResourceEvent,
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

describe('applyBatchEvents', () => {
  const createResource = (context: string, namespace: string, name: string, extra: Record<string, any> = {}) => ({
    _context: context,
    metadata: { namespace, name },
    ...extra,
  });

  it('should return same array when events is empty', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1'),
      createResource('cluster1', 'default', 'pod-2'),
    ];

    const result = applyBatchEvents(data, []);

    expect(result).toBe(data); // Same reference
  });

  it('should add new resource on ADDED event', () => {
    const data = [createResource('cluster1', 'default', 'pod-1')];
    const newPod = createResource('cluster1', 'default', 'pod-2');

    const result = applyBatchEvents(data, [
      { type: 'ADDED', object: newPod },
    ]);

    expect(result).toHaveLength(2);
    expect(result.find(r => r.metadata.name === 'pod-2')).toBeDefined();
  });

  it('should update existing resource on MODIFIED event', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1', { spec: { replicas: 1 } }),
    ];
    const updatedPod = createResource('cluster1', 'default', 'pod-1', { spec: { replicas: 3 } });

    const result = applyBatchEvents(data, [
      { type: 'MODIFIED', object: updatedPod },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].spec.replicas).toBe(3);
  });

  it('should remove resource on DELETED event', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1'),
      createResource('cluster1', 'default', 'pod-2'),
    ];
    const deletedPod = createResource('cluster1', 'default', 'pod-1');

    const result = applyBatchEvents(data, [
      { type: 'DELETED', object: deletedPod },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].metadata.name).toBe('pod-2');
  });

  it('should handle multiple events in batch', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1'),
      createResource('cluster1', 'default', 'pod-2'),
    ];

    const events: ResourceEvent[] = [
      { type: 'DELETED', object: createResource('cluster1', 'default', 'pod-1') },
      { type: 'ADDED', object: createResource('cluster1', 'default', 'pod-3') },
      { type: 'MODIFIED', object: createResource('cluster1', 'default', 'pod-2', { updated: true }) },
    ];

    const result = applyBatchEvents(data, events);

    expect(result).toHaveLength(2);
    expect(result.find(r => r.metadata.name === 'pod-1')).toBeUndefined();
    expect(result.find(r => r.metadata.name === 'pod-2')?.updated).toBe(true);
    expect(result.find(r => r.metadata.name === 'pod-3')).toBeDefined();
  });

  it('should handle ADDED then DELETED for same resource', () => {
    const data: any[] = [];
    const pod = createResource('cluster1', 'default', 'pod-1');

    const events: ResourceEvent[] = [
      { type: 'ADDED', object: pod },
      { type: 'DELETED', object: pod },
    ];

    const result = applyBatchEvents(data, events);

    expect(result).toHaveLength(0);
  });

  it('should handle multiple MODIFIED events for same resource', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1', { version: 1 }),
    ];

    const events: ResourceEvent[] = [
      { type: 'MODIFIED', object: createResource('cluster1', 'default', 'pod-1', { version: 2 }) },
      { type: 'MODIFIED', object: createResource('cluster1', 'default', 'pod-1', { version: 3 }) },
      { type: 'MODIFIED', object: createResource('cluster1', 'default', 'pod-1', { version: 4 }) },
    ];

    const result = applyBatchEvents(data, events);

    expect(result).toHaveLength(1);
    expect(result[0].version).toBe(4); // Last version wins
  });

  it('should handle resources from multiple contexts', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1'),
      createResource('cluster2', 'default', 'pod-1'), // Same name, different context
    ];

    const events: ResourceEvent[] = [
      { type: 'DELETED', object: createResource('cluster1', 'default', 'pod-1') },
    ];

    const result = applyBatchEvents(data, events);

    expect(result).toHaveLength(1);
    expect(result[0]._context).toBe('cluster2'); // cluster2's pod remains
  });

  it('should handle cluster-scoped resources correctly', () => {
    const data = [
      createResource('cluster1', '', 'node-1'),
      createResource('cluster1', '', 'node-2'),
    ];

    const events: ResourceEvent[] = [
      { type: 'MODIFIED', object: createResource('cluster1', '', 'node-1', { status: 'Ready' }) },
    ];

    const result = applyBatchEvents(data, events);

    expect(result).toHaveLength(2);
    expect(result.find(r => r.metadata.name === 'node-1')?.status).toBe('Ready');
  });
});

describe('Performance characteristics', () => {
  it('should handle large batches efficiently', () => {
    // Create 1000 resources
    const data = Array.from({ length: 1000 }, (_, i) => ({
      _context: 'cluster1',
      metadata: { namespace: 'default', name: `pod-${i}` },
    }));

    // Create 100 events
    const events: ResourceEvent[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'MODIFIED' as const,
      object: {
        _context: 'cluster1',
        metadata: { namespace: 'default', name: `pod-${i}` },
        updated: true,
      },
    }));

    const start = performance.now();
    const result = applyBatchEvents(data, events);
    const duration = performance.now() - start;

    expect(result).toHaveLength(1000);
    // Should complete in reasonable time (< 100ms)
    expect(duration).toBeLessThan(100);
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

describe('applyBatchEventsWithChanges', () => {
  const createResource = (context: string, namespace: string, name: string, extra: Record<string, any> = {}) => ({
    _context: context,
    metadata: { namespace, name },
    ...extra,
  });

  it('should return empty changes for empty events', () => {
    const data = [createResource('cluster1', 'default', 'pod-1')];
    const result = applyBatchEventsWithChanges(data, []);

    expect(result.data).toBe(data);
    expect(result.changes).toEqual([]);
  });

  it('should track changes on MODIFIED event', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1', { status: { phase: 'Running' } }),
    ];
    const updated = createResource('cluster1', 'default', 'pod-1', { status: { phase: 'Pending' } });

    const result = applyBatchEventsWithChanges(data, [
      { type: 'MODIFIED', object: updated },
    ]);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].status.phase).toBe('Pending');
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].rowId).toBe('cluster1/default/pod-1');
    expect(result.changes[0].columnId).toBe('status.phase');
  });

  it('should not track changes for ADDED event', () => {
    const data: any[] = [];
    const newPod = createResource('cluster1', 'default', 'pod-1');

    const result = applyBatchEventsWithChanges(data, [
      { type: 'ADDED', object: newPod },
    ]);

    expect(result.data).toHaveLength(1);
    expect(result.changes).toEqual([]);
  });

  it('should not track changes for DELETED event', () => {
    const data = [createResource('cluster1', 'default', 'pod-1')];

    const result = applyBatchEventsWithChanges(data, [
      { type: 'DELETED', object: createResource('cluster1', 'default', 'pod-1') },
    ]);

    expect(result.data).toHaveLength(0);
    expect(result.changes).toEqual([]);
  });

  it('should track multiple field changes in single MODIFIED event', () => {
    const data = [
      createResource('cluster1', 'default', 'pod-1', { a: 1, b: 2 }),
    ];
    const updated = createResource('cluster1', 'default', 'pod-1', { a: 10, b: 20 });

    const result = applyBatchEventsWithChanges(data, [
      { type: 'MODIFIED', object: updated },
    ]);

    expect(result.changes).toHaveLength(2);
    expect(result.changes.map(c => c.columnId)).toContain('a');
    expect(result.changes.map(c => c.columnId)).toContain('b');
  });

  it('should include timestamp in changes', () => {
    const now = Date.now();
    const data = [
      createResource('cluster1', 'default', 'pod-1', { value: 1 }),
    ];
    const updated = createResource('cluster1', 'default', 'pod-1', { value: 2 });

    const result = applyBatchEventsWithChanges(data, [
      { type: 'MODIFIED', object: updated },
    ]);

    expect(result.changes[0].timestamp).toBeGreaterThanOrEqual(now);
  });
});
