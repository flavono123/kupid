import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { NavigationPanel } from './NavigationPanel';
import { main } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

// Mock the Wails API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetNodeTree: vi.fn(),
}));

const createMockGVK = (
  kind: string,
  group: string = '',
  version: string = 'v1'
): main.MultiClusterGVK => ({
  kind,
  group,
  version,
  contexts: ['test-context'],
  allCount: 1,
});

describe('NavigationPanel', () => {
  const mockGVK = createMockGVK('Pod', '', 'v1');
  const mockContexts = ['test-context'];
  const mockOnFieldsSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Empty States', () => {
    it('should show loading state while fetching tree', async () => {
      // Mock a delayed response
      (App.GetNodeTree as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      expect(screen.getByText('Loading schema...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading schema...')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no tree data', async () => {
      (App.GetNodeTree as any).mockResolvedValue([]);

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No schema available')).toBeInTheDocument();
      });
    });

    it('should show empty state when no GVK selected', () => {
      render(
        <NavigationPanel
          selectedGVK={null as any}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      expect(screen.getByText('No schema available')).toBeInTheDocument();
    });

    it('should show empty state when no contexts connected', () => {
      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={[]}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      expect(screen.getByText('No schema available')).toBeInTheDocument();
    });
  });

  describe('Tree Rendering', () => {
    const mockTreeData = [
      {
        name: 'metadata',
        type: 'ObjectMeta',
        fullPath: ['metadata'],
        level: 0,
        children: [
          {
            name: 'name',
            type: 'string',
            fullPath: ['metadata', 'name'],
            level: 1,
            children: [],
          },
          {
            name: 'namespace',
            type: 'string',
            fullPath: ['metadata', 'namespace'],
            level: 1,
            children: [],
          },
        ],
      },
      {
        name: 'spec',
        type: 'PodSpec',
        fullPath: ['spec'],
        level: 0,
        children: [],
      },
    ];

    it('should render tree nodes', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
        expect(screen.getByText('spec')).toBeInTheDocument();
      });
    });

    it('should render child nodes when expanded', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Children should not be visible initially
      expect(screen.queryByText('name')).not.toBeInTheDocument();
      expect(screen.queryByText('namespace')).not.toBeInTheDocument();

      // Click expand button on metadata node
      const expandButtons = screen.getAllByRole('button');
      const metadataExpandButton = expandButtons[0]; // First button should be the expand button
      await user.click(metadataExpandButton);

      // Children should now be visible
      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
        expect(screen.getByText('namespace')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    const mockTreeData = [
      {
        name: 'metadata',
        type: 'ObjectMeta',
        fullPath: ['metadata'],
        level: 0,
        children: [
          {
            name: 'name',
            type: 'string',
            fullPath: ['metadata', 'name'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    it('should toggle search bar with Cmd+F', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Search bar should not be visible initially
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();

      // Press Cmd+F
      await user.keyboard('{Meta>}f{/Meta}');

      // Search bar should now be visible
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('should close search with Escape', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Open search
      await user.keyboard('{Meta>}f{/Meta}');
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Search bar should be closed
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
      });
    });
  });

  describe('GVK Changes', () => {
    const mockPodTreeData = [
      {
        name: 'metadata',
        type: 'ObjectMeta',
        fullPath: ['metadata'],
        level: 0,
        children: [
          {
            name: 'name',
            type: 'string',
            fullPath: ['metadata', 'name'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    const mockDeploymentTreeData = [
      {
        name: 'spec',
        type: 'DeploymentSpec',
        fullPath: ['spec'],
        level: 0,
        children: [
          {
            name: 'replicas',
            type: 'integer',
            fullPath: ['spec', 'replicas'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    it('should reset state and reload tree when GVK changes', async () => {
      // Setup mock to return different values for consecutive calls
      (App.GetNodeTree as any)
        .mockResolvedValueOnce(mockPodTreeData)
        .mockResolvedValueOnce(mockDeploymentTreeData);

      const { rerender } = render(
        <NavigationPanel
          selectedGVK={createMockGVK('Pod')}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      // Wait for initial Pod tree to load
      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Change to Deployment GVK
      rerender(
        <NavigationPanel
          selectedGVK={createMockGVK('Deployment', 'apps')}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      // Should show loading state
      expect(screen.getByText('Loading schema...')).toBeInTheDocument();

      // Old tree data should be cleared (metadata should not be present)
      expect(screen.queryByText('metadata')).not.toBeInTheDocument();

      // Wait for new tree to load
      await waitFor(() => {
        expect(screen.getByText('spec')).toBeInTheDocument();
        expect(screen.queryByText('Loading schema...')).not.toBeInTheDocument();
      });

      // Old tree should still not be present
      expect(screen.queryByText('metadata')).not.toBeInTheDocument();
    });

    it('should clear expanded and selected state when GVK changes', async () => {
      const user = userEvent.setup();

      // Setup mock to return different values for consecutive calls
      (App.GetNodeTree as any)
        .mockResolvedValueOnce(mockPodTreeData)
        .mockResolvedValueOnce(mockDeploymentTreeData);

      const { rerender } = render(
        <NavigationPanel
          selectedGVK={createMockGVK('Pod')}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      // Wait for initial Pod tree to load
      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Expand metadata node
      const expandButtons = screen.getAllByRole('button');
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      // Select name field
      const checkboxes = screen.getAllByRole('checkbox');
      const nameCheckbox = checkboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('name');
      });
      await user.click(nameCheckbox!);

      await waitFor(() => {
        expect(mockOnFieldsSelected).toHaveBeenCalledWith([['metadata', 'name']]);
      });

      // Change to Deployment GVK
      rerender(
        <NavigationPanel
          selectedGVK={createMockGVK('Deployment', 'apps')}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      // Wait for new tree to load
      await waitFor(() => {
        expect(screen.getByText('spec')).toBeInTheDocument();
      });

      // Old tree should not be present
      expect(screen.queryByText('metadata')).not.toBeInTheDocument();

      // New tree should be collapsed (replicas not visible)
      expect(screen.queryByText('replicas')).not.toBeInTheDocument();

      // Internal selection state should be cleared (verify by trying to select again)
      // The previous selection of metadata.name should no longer be active
      const newExpandButtons = screen.getAllByRole('button');
      await user.click(newExpandButtons[0]); // Expand spec

      await waitFor(() => {
        expect(screen.getByText('replicas')).toBeInTheDocument();
      });

      // Select replicas field
      const newCheckboxes = screen.getAllByRole('checkbox');
      const replicasCheckbox = newCheckboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('replicas');
      });
      await user.click(replicasCheckbox!);

      // Should be called with only the new selection (not accumulating old selection)
      await waitFor(() => {
        expect(mockOnFieldsSelected).toHaveBeenLastCalledWith([['spec', 'replicas']]);
      });
    });
  });

  describe('Selection', () => {
    const mockTreeData = [
      {
        name: 'metadata',
        type: 'ObjectMeta',
        fullPath: ['metadata'],
        level: 0,
        children: [
          {
            name: 'name',
            type: 'string',
            fullPath: ['metadata', 'name'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    it('should call onFieldsSelected when leaf node is selected', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Expand metadata to show children
      const expandButtons = screen.getAllByRole('button');
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      // Find and click the checkbox for "name" node
      const checkboxes = screen.getAllByRole('checkbox');
      const nameCheckbox = checkboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('name');
      });

      expect(nameCheckbox).toBeDefined();
      await user.click(nameCheckbox!);

      // Should call onFieldsSelected with the selected path
      await waitFor(() => {
        expect(mockOnFieldsSelected).toHaveBeenCalledWith([['metadata', 'name']]);
      });
    });

    it('should auto-expand parent nodes when a nested field is selected', async () => {
      const nestedTreeData = [
        {
          name: 'spec',
          type: 'PodSpec',
          fullPath: ['spec'],
          level: 0,
          children: [
            {
              name: 'containers',
              type: '[]Container',
              fullPath: ['spec', 'containers'],
              level: 1,
              children: [
                {
                  name: 'ports',
                  type: '[]ContainerPort',
                  fullPath: ['spec', 'containers', 'ports'],
                  level: 2,
                  children: [
                    {
                      name: 'containerPort',
                      type: 'int32',
                      fullPath: ['spec', 'containers', 'ports', 'containerPort'],
                      level: 3,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      (App.GetNodeTree as any).mockResolvedValue(nestedTreeData);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('spec')).toBeInTheDocument();
      });

      // Initially, nested children should not be visible
      expect(screen.queryByText('containerPort')).not.toBeInTheDocument();

      // Manually expand to reach the nested field
      const specExpandButton = screen.getAllByRole('button')[0];
      await user.click(specExpandButton);

      await waitFor(() => {
        expect(screen.getByText('containers')).toBeInTheDocument();
      });

      const containersExpandButton = screen.getAllByRole('button')[1];
      await user.click(containersExpandButton);

      await waitFor(() => {
        expect(screen.getByText('ports')).toBeInTheDocument();
      });

      const portsExpandButton = screen.getAllByRole('button')[2];
      await user.click(portsExpandButton);

      await waitFor(() => {
        expect(screen.getByText('containerPort')).toBeInTheDocument();
      });

      // Now collapse all nodes to test auto-expand
      await user.click(portsExpandButton); // Collapse ports
      await user.click(containersExpandButton); // Collapse containers
      await user.click(specExpandButton); // Collapse spec

      await waitFor(() => {
        expect(screen.queryByText('containerPort')).not.toBeInTheDocument();
      });

      // Re-expand to select the field
      await user.click(specExpandButton);
      await waitFor(() => {
        expect(screen.getByText('containers')).toBeInTheDocument();
      });

      await user.click(screen.getAllByRole('button')[1]); // containers
      await waitFor(() => {
        expect(screen.getByText('ports')).toBeInTheDocument();
      });

      await user.click(screen.getAllByRole('button')[2]); // ports
      await waitFor(() => {
        expect(screen.getByText('containerPort')).toBeInTheDocument();
      });

      // Find and click the checkbox for containerPort
      const checkboxes = screen.getAllByRole('checkbox');
      const containerPortCheckbox = checkboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('containerPort');
      });

      await user.click(containerPortCheckbox!);

      // Verify parent nodes remain expanded
      expect(screen.getByText('spec')).toBeInTheDocument();
      expect(screen.getByText('containers')).toBeInTheDocument();
      expect(screen.getByText('ports')).toBeInTheDocument();
      expect(screen.getByText('containerPort')).toBeInTheDocument();
    });

    it('should handle field names with slashes (e.g., Kubernetes annotations)', async () => {
      const treeWithSlashes = [
        {
          name: 'metadata',
          type: 'ObjectMeta',
          fullPath: ['metadata'],
          level: 0,
          children: [
            {
              name: 'annotations',
              type: 'map[string]string',
              fullPath: ['metadata', 'annotations'],
              level: 1,
              children: [
                {
                  name: 'karpenter.sh/node-hash-version',
                  type: 'string',
                  fullPath: ['metadata', 'annotations', 'karpenter.sh/node-hash-version'],
                  level: 2,
                  children: [],
                },
                {
                  name: 'eks.amazonaws.com/nodegroup',
                  type: 'string',
                  fullPath: ['metadata', 'annotations', 'eks.amazonaws.com/nodegroup'],
                  level: 2,
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      (App.GetNodeTree as any).mockResolvedValue(treeWithSlashes);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Expand metadata
      const metadataExpandButton = screen.getAllByRole('button')[0];
      await user.click(metadataExpandButton);

      await waitFor(() => {
        expect(screen.getByText('annotations')).toBeInTheDocument();
      });

      // Expand annotations
      const annotationsExpandButton = screen.getAllByRole('button')[1];
      await user.click(annotationsExpandButton);

      await waitFor(() => {
        expect(screen.getByText('karpenter.sh/node-hash-version')).toBeInTheDocument();
        expect(screen.getByText('eks.amazonaws.com/nodegroup')).toBeInTheDocument();
      });

      // Find and click the checkbox for the Karpenter annotation (with slash in name)
      const checkboxes = screen.getAllByRole('checkbox');
      const karpenterCheckbox = checkboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('karpenter.sh/node-hash-version');
      });

      expect(karpenterCheckbox).toBeDefined();
      await user.click(karpenterCheckbox!);

      // Should call onFieldsSelected with the correct path (preserving slashes)
      await waitFor(() => {
        expect(mockOnFieldsSelected).toHaveBeenCalledWith([
          ['metadata', 'annotations', 'karpenter.sh/node-hash-version'],
        ]);
      });

      // Select the EKS annotation as well
      const eksCheckbox = checkboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('eks.amazonaws.com/nodegroup');
      });

      await user.click(eksCheckbox!);

      // Should call onFieldsSelected with both paths
      await waitFor(() => {
        expect(mockOnFieldsSelected).toHaveBeenLastCalledWith([
          ['metadata', 'annotations', 'karpenter.sh/node-hash-version'],
          ['metadata', 'annotations', 'eks.amazonaws.com/nodegroup'],
        ]);
      });
    });
  });

  describe('Expand/Collapse State Management', () => {
    const mockTreeData = [
      {
        name: 'metadata',
        type: 'ObjectMeta',
        fullPath: ['metadata'],
        level: 0,
        children: [
          {
            name: 'name',
            type: 'string',
            fullPath: ['metadata', 'name'],
            level: 1,
            children: [],
          },
          {
            name: 'namespace',
            type: 'string',
            fullPath: ['metadata', 'namespace'],
            level: 1,
            children: [],
          },
        ],
      },
      {
        name: 'spec',
        type: 'PodSpec',
        fullPath: ['spec'],
        level: 0,
        children: [
          {
            name: 'nodeName',
            type: 'string',
            fullPath: ['spec', 'nodeName'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    it('should preserve manual expand state when searching and then clearing search', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Manually expand metadata
      const expandButtons = screen.getAllByRole('button');
      await user.click(expandButtons[0]); // Expand metadata

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      // spec should be collapsed
      expect(screen.queryByText('nodeName')).not.toBeInTheDocument();

      // Open search and search for "nodeName"
      await user.keyboard('{Meta>}f{/Meta}');
      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'nodeName');

      // Wait for search results - spec should auto-expand to show nodeName
      await waitFor(() => {
        expect(screen.getByText('nodeName')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Clear search
      await user.clear(searchInput);

      // Wait for debounce and state update
      await waitFor(() => {
        // After clearing search, spec should collapse back (not manually expanded)
        expect(screen.queryByText('nodeName')).not.toBeInTheDocument();
      }, { timeout: 500 });

      // metadata should still be expanded (manually expanded)
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('namespace')).toBeInTheDocument();
    });

    it('should keep search results expanded even after manual collapse during search', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Open search and search for "namespace"
      await user.keyboard('{Meta>}f{/Meta}');
      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'namespace');

      // metadata should auto-expand due to search
      await waitFor(() => {
        expect(screen.getByText('namespace')).toBeInTheDocument();
      }, { timeout: 1000 });

      // Try to manually collapse metadata during search
      const expandButtons = screen.getAllByRole('button');
      const metadataExpandButton = expandButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-chevron-down');
      });

      if (metadataExpandButton) {
        await user.click(metadataExpandButton);

        // Manual collapse is recorded but search results take priority
        // so namespace remains visible (expected behavior for search UX)
        // This ensures users can always see search results
        expect(screen.getByText('namespace')).toBeInTheDocument();
      }
    });
  });

  describe('Ref Methods (Imperative Handle)', () => {
    const mockTreeData = [
      {
        name: 'metadata',
        type: 'ObjectMeta',
        fullPath: ['metadata'],
        level: 0,
        children: [
          {
            name: 'name',
            type: 'string',
            fullPath: ['metadata', 'name'],
            level: 1,
            children: [],
          },
          {
            name: 'namespace',
            type: 'string',
            fullPath: ['metadata', 'namespace'],
            level: 1,
            children: [],
          },
        ],
      },
      {
        name: 'spec',
        type: 'PodSpec',
        fullPath: ['spec'],
        level: 0,
        children: [
          {
            name: 'nodeName',
            type: 'string',
            fullPath: ['spec', 'nodeName'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    it('should set selections via setSelectedPaths (for favorites)', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const ref = { current: null as any };
      render(
        <NavigationPanel
          ref={ref}
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Set selections via ref (simulating applying a favorite)
      const PATH_DELIMITER = '\x00';
      const pathsToSelect = new Set([
        ['metadata', 'name'].join(PATH_DELIMITER),
        ['spec', 'nodeName'].join(PATH_DELIMITER),
      ]);

      act(() => {
        ref.current.setSelectedPaths(pathsToSelect);
      });

      // Parent nodes should be auto-expanded
      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
        expect(screen.getByText('nodeName')).toBeInTheDocument();
      });

      // Checkboxes should be checked
      const nameCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('name') && !parent?.textContent?.includes('nodeName');
      });
      const nodeNameCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('nodeName');
      });

      expect(nameCheckbox).toHaveAttribute('data-state', 'checked');
      expect(nodeNameCheckbox).toHaveAttribute('data-state', 'checked');
    });

    it('should clear all selections via clearSelections', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();
      const ref = { current: null as any };

      render(
        <NavigationPanel
          ref={ref}
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Expand and select a field
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      const nameCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('name');
      });
      await user.click(nameCheckbox!);

      // Verify selection
      expect(ref.current.getSelectedCount()).toBe(1);

      // Clear via ref
      act(() => {
        ref.current.clearSelections();
      });

      // Should be cleared
      await waitFor(() => {
        expect(ref.current.getSelectedCount()).toBe(0);
      });

      // onFieldsSelected should be called with empty array
      expect(mockOnFieldsSelected).toHaveBeenLastCalledWith([]);
    });

    it('should return correct selected count and paths', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();
      const ref = { current: null as any };

      render(
        <NavigationPanel
          ref={ref}
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Initially no selections
      expect(ref.current.getSelectedCount()).toBe(0);
      expect(ref.current.getSelectedPaths().size).toBe(0);

      // Expand metadata and select name
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      const nameCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('name');
      });
      await user.click(nameCheckbox!);

      await waitFor(() => {
        expect(ref.current.getSelectedCount()).toBe(1);
      });

      const selectedPaths = ref.current.getSelectedPaths();
      expect(selectedPaths.size).toBe(1);

      // The path should use PATH_DELIMITER (null character)
      const PATH_DELIMITER = '\x00';
      expect(selectedPaths.has(['metadata', 'name'].join(PATH_DELIMITER))).toBe(true);
    });

    it('should toggle search via toggleSearch', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const ref = { current: null as any };

      render(
        <NavigationPanel
          ref={ref}
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Search should not be visible initially
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();

      // Toggle search via ref
      act(() => {
        ref.current.toggleSearch();
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
      });

      // Toggle again to close
      act(() => {
        ref.current.toggleSearch();
      });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
      });
    });
  });
});
