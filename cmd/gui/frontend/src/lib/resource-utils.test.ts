import { describe, it, expect } from 'vitest';
import { getResourceKey, applyBatchEvents, type ResourceEvent } from './resource-utils';

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
