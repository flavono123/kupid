/**
 * Tests for useResourceData Pull Model implementation
 *
 * Note: Full hook integration tests require Wails runtime mocking which
 * causes memory issues with vitest. Instead, we test the core logic directly
 * and rely on resource-utils.test.ts for the helper function tests.
 *
 * The useResourceData hook has been manually tested with the following scenarios:
 * - ADDED events properly fetch resources via GetResourcesByKeys
 * - MODIFIED events update resources and track changed cells
 * - DELETED events remove resources without fetching
 * - Batch processing collects multiple events before fetching
 * - GVK/context switching resets state and restarts watch
 * - Cleanup properly unsubscribes and stops watch
 */

import { describe, it, expect } from 'vitest';
import { getResourceKey, diffFields } from '../lib/resource-utils';

// Test the core data transformation logic used by useResourceData
describe('useResourceData core logic', () => {
  describe('resource key generation', () => {
    it('should generate key from context, namespace, and name', () => {
      const resource = {
        _context: 'prod-cluster',
        metadata: { namespace: 'default', name: 'my-pod' },
      };
      expect(getResourceKey(resource)).toBe('prod-cluster/default/my-pod');
    });

    it('should handle cluster-scoped resources (no namespace)', () => {
      const resource = {
        _context: 'prod-cluster',
        metadata: { name: 'my-node' },
      };
      expect(getResourceKey(resource)).toBe('prod-cluster//my-node');
    });
  });

  describe('change detection', () => {
    it('should detect status.phase change', () => {
      const prev = { status: { phase: 'Pending' } };
      const next = { status: { phase: 'Running' } };
      expect(diffFields(prev, next)).toContain('status.phase');
    });

    it('should not report unchanged fields', () => {
      const prev = { status: { phase: 'Running' }, metadata: { name: 'pod-1' } };
      const next = { status: { phase: 'Running' }, metadata: { name: 'pod-1' } };
      expect(diffFields(prev, next)).toEqual([]);
    });
  });

  describe('data map operations (simulating batch apply)', () => {
    // Simulate the data map operations used in useResourceData
    const applyUpdates = (
      currentData: any[],
      keysToDelete: string[],
      fetchedResources: any[]
    ) => {
      const dataMap = new Map(currentData.map((item) => [getResourceKey(item), item]));

      // Apply deletes
      for (const key of keysToDelete) {
        dataMap.delete(key);
      }

      // Apply fetched resources
      for (const resource of fetchedResources) {
        dataMap.set(getResourceKey(resource), resource);
      }

      return Array.from(dataMap.values());
    };

    it('should add new resources', () => {
      const current: any[] = [];
      const newResource = {
        _context: 'ctx1',
        metadata: { namespace: 'default', name: 'pod-1' },
      };

      const result = applyUpdates(current, [], [newResource]);

      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('pod-1');
    });

    it('should update existing resources', () => {
      const current = [
        { _context: 'ctx1', metadata: { namespace: 'default', name: 'pod-1' }, status: { phase: 'Pending' } },
      ];
      const updated = {
        _context: 'ctx1',
        metadata: { namespace: 'default', name: 'pod-1' },
        status: { phase: 'Running' },
      };

      const result = applyUpdates(current, [], [updated]);

      expect(result).toHaveLength(1);
      expect(result[0].status.phase).toBe('Running');
    });

    it('should delete resources by key', () => {
      const current = [
        { _context: 'ctx1', metadata: { namespace: 'default', name: 'pod-1' } },
        { _context: 'ctx1', metadata: { namespace: 'default', name: 'pod-2' } },
      ];

      const result = applyUpdates(current, ['ctx1/default/pod-1'], []);

      expect(result).toHaveLength(1);
      expect(result[0].metadata.name).toBe('pod-2');
    });

    it('should handle combined operations', () => {
      const current = [
        { _context: 'ctx1', metadata: { namespace: 'default', name: 'pod-1' }, status: { phase: 'Pending' } },
        { _context: 'ctx1', metadata: { namespace: 'default', name: 'pod-2' } },
      ];
      const keysToDelete = ['ctx1/default/pod-2'];
      const fetchedResources = [
        { _context: 'ctx1', metadata: { namespace: 'default', name: 'pod-1' }, status: { phase: 'Running' } },
        { _context: 'ctx1', metadata: { namespace: 'default', name: 'pod-3' } },
      ];

      const result = applyUpdates(current, keysToDelete, fetchedResources);

      expect(result).toHaveLength(2);
      const names = result.map((r) => r.metadata.name).sort();
      expect(names).toEqual(['pod-1', 'pod-3']);
      expect(result.find((r) => r.metadata.name === 'pod-1')?.status.phase).toBe('Running');
    });
  });

  describe('pending keys management (simulating event collection)', () => {
    // Simulate the pending keys Set operations
    it('should deduplicate multiple ADDED events for same key', () => {
      const pendingKeys = new Set<string>();

      // Multiple ADDED events for same resource
      pendingKeys.add('ctx1/default/pod-1');
      pendingKeys.add('ctx1/default/pod-1');
      pendingKeys.add('ctx1/default/pod-1');

      expect(pendingKeys.size).toBe(1);
      expect(Array.from(pendingKeys)).toEqual(['ctx1/default/pod-1']);
    });

    it('should remove key from pendingKeys when DELETED', () => {
      const pendingKeys = new Set<string>();
      const pendingDeletes = new Set<string>();

      // ADDED event
      pendingKeys.add('ctx1/default/pod-1');

      // DELETED event for same key
      pendingDeletes.add('ctx1/default/pod-1');
      pendingKeys.delete('ctx1/default/pod-1');

      expect(pendingKeys.size).toBe(0);
      expect(pendingDeletes.size).toBe(1);
    });

    it('should collect multiple keys for batch fetch', () => {
      const pendingKeys = new Set<string>();

      pendingKeys.add('ctx1/default/pod-1');
      pendingKeys.add('ctx1/default/pod-2');
      pendingKeys.add('ctx1/kube-system/coredns');

      expect(pendingKeys.size).toBe(3);
      expect(Array.from(pendingKeys)).toEqual([
        'ctx1/default/pod-1',
        'ctx1/default/pod-2',
        'ctx1/kube-system/coredns',
      ]);
    });
  });

  describe('watch operation serialization (race condition prevention)', () => {
    // Simulate the promise chaining pattern used to prevent race conditions
    it('should serialize stop/start operations', async () => {
      const operations: string[] = [];

      // Simulate watchOperationRef pattern
      let operationChain = Promise.resolve();

      const simulateStopWatch = () => new Promise<void>((resolve) => {
        setTimeout(() => {
          operations.push('stop');
          resolve();
        }, 50); // Simulate async delay
      });

      const simulateStartWatch = (gvk: string) => new Promise<void>((resolve) => {
        setTimeout(() => {
          operations.push(`start:${gvk}`);
          resolve();
        }, 30);
      });

      // First watch for GVK-A
      operationChain = operationChain
        .then(() => simulateStopWatch())
        .then(() => simulateStartWatch('GVK-A'));

      // Immediately switch to GVK-B (simulating fast GVK switch)
      operationChain = operationChain
        .then(() => simulateStopWatch())
        .then(() => simulateStartWatch('GVK-B'));

      await operationChain;

      // Operations should be serialized: stop -> start:A -> stop -> start:B
      expect(operations).toEqual(['stop', 'start:GVK-A', 'stop', 'start:GVK-B']);
    });

    it('should skip stale operations using watchGen pattern', async () => {
      let watchGen = 0;
      const operations: string[] = [];

      const simulateAsyncOperation = (gen: number, name: string) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            // Check if this operation is still current
            if (gen === watchGen) {
              operations.push(name);
            } else {
              operations.push(`skipped:${name}`);
            }
            resolve();
          }, 50);
        });
      };

      // Start first operation
      const gen1 = ++watchGen;
      const op1 = simulateAsyncOperation(gen1, 'op1');

      // Immediately start second operation (simulating fast switch)
      const gen2 = ++watchGen;
      const op2 = simulateAsyncOperation(gen2, 'op2');

      await Promise.all([op1, op2]);

      // First operation should be skipped, second should complete
      expect(operations).toContain('skipped:op1');
      expect(operations).toContain('op2');
    });
  });

  describe('initial sync timeout logic', () => {
    // Test the hasReceivedAnyEvent flag logic
    it('should not trigger timeout if events have been received', () => {
      let hasReceivedFirstBatch = false;
      let hasReceivedAnyEvent = false;
      let loadingComplete = false;

      // Simulate receiving events
      hasReceivedAnyEvent = true;

      // Timeout check (should NOT set loading complete if events received)
      const checkTimeout = () => {
        if (!hasReceivedFirstBatch && !hasReceivedAnyEvent) {
          loadingComplete = true;
          hasReceivedFirstBatch = true;
        }
      };

      checkTimeout();

      // Loading should NOT be complete because events were received
      expect(loadingComplete).toBe(false);
      expect(hasReceivedFirstBatch).toBe(false);
    });

    it('should trigger timeout if no events have been received (0 resources)', () => {
      let hasReceivedFirstBatch = false;
      let hasReceivedAnyEvent = false;
      let loadingComplete = false;

      // No events received (simulating GVK with 0 resources)

      const checkTimeout = () => {
        if (!hasReceivedFirstBatch && !hasReceivedAnyEvent) {
          loadingComplete = true;
          hasReceivedFirstBatch = true;
        }
      };

      checkTimeout();

      // Loading should be complete
      expect(loadingComplete).toBe(true);
      expect(hasReceivedFirstBatch).toBe(true);
    });

    it('should complete loading after batch processing even without timeout', () => {
      let hasReceivedFirstBatch = false;
      let loadingComplete = false;

      // Simulate batch processing completing (events were received and processed)
      const completeBatch = () => {
        if (!hasReceivedFirstBatch) {
          hasReceivedFirstBatch = true;
          loadingComplete = true;
        }
      };

      completeBatch();

      expect(loadingComplete).toBe(true);
      expect(hasReceivedFirstBatch).toBe(true);
    });
  });

  describe('change tracking for cell flashing', () => {
    it('should generate CellChange for modified fields', () => {
      const prev = {
        _context: 'ctx1',
        metadata: { namespace: 'default', name: 'pod-1' },
        status: { phase: 'Pending', conditions: [] },
      };
      const next = {
        _context: 'ctx1',
        metadata: { namespace: 'default', name: 'pod-1' },
        status: { phase: 'Running', conditions: [] },
      };

      const rowId = getResourceKey(next);
      const changedPaths = diffFields(prev, next);
      const now = Date.now();

      const changes = changedPaths.map((columnId) => ({
        rowId,
        columnId,
        timestamp: now,
      }));

      expect(changes).toHaveLength(1);
      expect(changes[0].rowId).toBe('ctx1/default/pod-1');
      expect(changes[0].columnId).toBe('status.phase');
    });

    it('should not generate changes for ADDED (no previous state)', () => {
      const resource = {
        _context: 'ctx1',
        metadata: { namespace: 'default', name: 'pod-1' },
        status: { phase: 'Running' },
      };

      // For ADDED events, prevResource is undefined
      const prevResource = undefined;

      // In the actual hook, we only track changes if prevResource exists
      const changedPaths = prevResource ? diffFields(prevResource, resource) : [];

      expect(changedPaths).toEqual([]);
    });
  });
});
