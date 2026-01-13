/**
 * Tests for useCommandSearch hook
 *
 * These tests document the custom scoring algorithm for GVK search.
 * See useCommandSearch.ts for detailed documentation of the scoring strategy.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandSearch } from './useCommandSearch';
import { main } from '../../wailsjs/go/models';

// Helper to create mock GVK
const createMockGVK = (
  kind: string,
  group: string = '',
  version: string = 'v1',
  shortNames: string[] = [],
  contexts: string[] = ['ctx1']
): main.MultiClusterGVK => ({
  kind,
  group,
  version,
  shortNames,
  contexts,
  allCount: contexts.length,
});

// Helper to create mock favorite
const createMockFavorite = (
  id: string,
  name: string,
  kind: string,
  group: string = ''
): main.FavoriteViewResponse => ({
  id,
  name,
  gvk: { kind, group, version: 'v1' },
  fields: [],
});

describe('useCommandSearch', () => {
  describe('GVK search scoring', () => {
    it('should prioritize exact abbreviation match over fuzzy matches', () => {
      const gvks = [
        createMockGVK('ClusterWorkflowTemplate', 'argoproj.io', 'v1alpha1', ['cwft']),
        createMockGVK('Certificate', 'cert-manager.io', 'v1', ['cert']),
        createMockGVK('ClusterIssuer', 'cert-manager.io', 'v1', ['clusterissuer']),
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      act(() => {
        result.current.setQuery('cert');
      });

      // Certificate (abbr=cert) should be first due to exact match
      expect(result.current.filteredGVKs[0].gvk.kind).toBe('Certificate');
    });

    it('should prioritize abbreviation prefix match over kind prefix match', () => {
      const gvks = [
        createMockGVK('Deployment', 'apps', 'v1', ['deploy']),
        createMockGVK('DaemonSet', 'apps', 'v1', ['ds']),
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      act(() => {
        result.current.setQuery('de');
      });

      // Deployment (abbr starts with "de") should be first
      expect(result.current.filteredGVKs[0].gvk.kind).toBe('Deployment');
    });

    it('should prioritize kind prefix match over fuzzy matches', () => {
      const gvks = [
        createMockGVK('Pod', '', 'v1', ['po']),
        createMockGVK('HorizontalPodAutoscaler', 'autoscaling', 'v2', ['hpa']),
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      act(() => {
        result.current.setQuery('pod');
      });

      // Pod (kind starts with "pod") should be first
      expect(result.current.filteredGVKs[0].gvk.kind).toBe('Pod');
    });

    it('should deprioritize group-only matches', () => {
      const gvks = [
        createMockGVK('Certificate', 'cert-manager.io', 'v1', ['cert']),
        createMockGVK('Issuer', 'cert-manager.io', 'v1', []),
        createMockGVK('ClusterIssuer', 'cert-manager.io', 'v1', []),
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      act(() => {
        result.current.setQuery('cert');
      });

      // Certificate should be first (exact abbr match)
      // Issuer and ClusterIssuer only match on group, should be lower
      expect(result.current.filteredGVKs[0].gvk.kind).toBe('Certificate');
    });
  });

  describe('empty abbreviation handling', () => {
    it('should not boost GVKs without shortNames on empty string match', () => {
      const gvks = [
        createMockGVK('Pod', '', 'v1', ['po']),           // has shortName
        createMockGVK('ConfigMap', '', 'v1', ['cm']),     // has shortName
        createMockGVK('Namespace', '', 'v1', []),         // no shortName
        createMockGVK('Node', '', 'v1', []),              // no shortName
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      act(() => {
        result.current.setQuery('po');
      });

      // Pod should match (abbr="po" exact match)
      // Namespace and Node should NOT appear at top just because abbr is empty
      const kinds = result.current.filteredGVKs.map(r => r.gvk.kind);
      expect(kinds[0]).toBe('Pod');

      // Namespace and Node should only match if "po" fuzzy-matches their kind
      // which it doesn't for exact/prefix, so they should be lower or not present
    });

    it('should still match GVKs without shortNames by kind', () => {
      const gvks = [
        createMockGVK('Namespace', '', 'v1', []),  // no shortName
        createMockGVK('Pod', '', 'v1', ['po']),
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      act(() => {
        result.current.setQuery('name');
      });

      // Namespace should match via kind prefix
      const kinds = result.current.filteredGVKs.map(r => r.gvk.kind);
      expect(kinds).toContain('Namespace');
    });

    it('should not treat empty abbreviation as matching any query', () => {
      const gvks = [
        createMockGVK('Secret', '', 'v1', []),  // no shortName (abbr='')
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      act(() => {
        result.current.setQuery('xyz');
      });

      // 'xyz' should not match Secret at all
      // Secret has no abbr, kind doesn't match, group doesn't match
      expect(result.current.filteredGVKs.length).toBe(0);
    });
  });

  describe('favorites search', () => {
    it('should filter favorites by query', () => {
      const favorites = [
        createMockFavorite('1', 'my-deployment', 'Deployment', 'apps'),
        createMockFavorite('2', 'my-service', 'Service'),
        createMockFavorite('3', 'nginx-pod', 'Pod'),
      ];

      const { result } = renderHook(() => useCommandSearch(favorites, []));

      act(() => {
        result.current.setQuery('deploy');
      });

      expect(result.current.filteredFavorites.length).toBe(1);
      expect(result.current.filteredFavorites[0].favorite.name).toBe('my-deployment');
    });

    it('should return all favorites when query is empty', () => {
      const favorites = [
        createMockFavorite('1', 'my-deployment', 'Deployment', 'apps'),
        createMockFavorite('2', 'my-service', 'Service'),
      ];

      const { result } = renderHook(() => useCommandSearch(favorites, []));

      expect(result.current.filteredFavorites.length).toBe(2);
    });

    it('should include highlight indices for matched favorites', () => {
      const favorites = [
        createMockFavorite('1', 'my-deployment', 'Deployment', 'apps'),
      ];

      const { result } = renderHook(() => useCommandSearch(favorites, []));

      act(() => {
        result.current.setQuery('deploy');
      });

      expect(result.current.filteredFavorites[0].indices).not.toBeNull();
      expect(result.current.filteredFavorites[0].indices!.length).toBeGreaterThan(0);
    });
  });

  describe('sorting', () => {
    it('should sort core resources before non-core when scores are equal', () => {
      const gvks = [
        createMockGVK('Deployment', 'apps', 'v1', []),
        createMockGVK('Pod', '', 'v1', []),
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      // No query - all have same score (0)
      const kinds = result.current.filteredGVKs.map(r => r.gvk.kind);
      expect(kinds.indexOf('Pod')).toBeLessThan(kinds.indexOf('Deployment'));
    });

    it('should sort by version (semver descending) for same kind', () => {
      const gvks = [
        createMockGVK('NetworkPolicy', 'networking.k8s.io', 'v1alpha1', []),
        createMockGVK('NetworkPolicy', 'networking.k8s.io', 'v1', []),
        createMockGVK('NetworkPolicy', 'networking.k8s.io', 'v1beta1', []),
      ];

      const { result } = renderHook(() => useCommandSearch([], gvks));

      const versions = result.current.filteredGVKs.map(r => r.gvk.version);
      expect(versions).toEqual(['v1', 'v1beta1', 'v1alpha1']);
    });
  });
});
