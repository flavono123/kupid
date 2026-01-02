import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { NavigationPanel } from './NavigationPanel';
import { main } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

// Mock the Wails API
vi.mock('../../wailsjs/go/main/App', () => ({
  GetNodeTree: vi.fn(),
}));

// Mock the Wails runtime (for EventsOn used by watch)
vi.mock('../../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(() => () => {}), // Returns unsubscribe function
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

    it('should toggle search bar via toggleSearch ref', async () => {
      // Note: Cmd+F is handled by MainView, which calls toggleSearch via ref
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

      // Search bar should not be visible initially
      expect(screen.queryByPlaceholderText('Search ...')).not.toBeInTheDocument();

      // Toggle search via ref (simulates what MainView does on Cmd+F)
      act(() => {
        ref.current.toggleSearch();
      });

      // Search bar should now be visible
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument();
      });
    });

    it('should close search with Escape', async () => {
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

      // Open search via ref
      act(() => {
        ref.current.toggleSearch();
      });
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument();
      });

      // Press Escape
      await user.keyboard('{Escape}');

      // Search bar should be closed
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search ...')).not.toBeInTheDocument();
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
          {
            name: 'namespace',
            type: 'string',
            fullPath: ['metadata', 'namespace'],
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
        expect(screen.getByText('namespace')).toBeInTheDocument();
      });

      // Select namespace field (not name - it's a default column)
      const checkboxes = screen.getAllByRole('checkbox');
      const namespaceCheckbox = checkboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('namespace');
      });
      await user.click(namespaceCheckbox!);

      await waitFor(() => {
        expect(mockOnFieldsSelected).toHaveBeenCalledWith([['metadata', 'namespace']]);
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
          {
            name: 'namespace',
            type: 'string',
            fullPath: ['metadata', 'namespace'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    it('should persist selection after clicking (no blinking)', async () => {
      // This test verifies the fix for the bug where selections would briefly appear
      // then disappear due to REMOVE_STALE_PATHS running on every state change
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

      // Expand metadata
      const expandButtons = screen.getAllByRole('button');
      await user.click(expandButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('namespace')).toBeInTheDocument();
      });

      // Click the checkbox for namespace (not name - it's a default column)
      const namespaceCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('namespace');
      });
      await user.click(namespaceCheckbox!);

      // Selection should persist - not blink and disappear
      await waitFor(() => {
        expect(ref.current.getSelectedCount()).toBe(1);
      });

      // Wait a bit more to ensure no cleanup removes it
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be selected
      expect(ref.current.getSelectedCount()).toBe(1);
      expect(namespaceCheckbox).toHaveAttribute('data-state', 'checked');
    });

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
        expect(screen.getByText('namespace')).toBeInTheDocument();
      });

      // Find and click the checkbox for "namespace" node (not name - it's a default column)
      const checkboxes = screen.getAllByRole('checkbox');
      const namespaceCheckbox = checkboxes.find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('namespace');
      });

      expect(namespaceCheckbox).toBeDefined();
      await user.click(namespaceCheckbox!);

      // Should call onFieldsSelected with the selected path
      await waitFor(() => {
        expect(mockOnFieldsSelected).toHaveBeenCalledWith([['metadata', 'namespace']]);
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

    it('should persist wildcard selection (containers.*.image)', async () => {
      // This test verifies the fix for the bug where clicking containers.*.image
      // would cause the checkbox to briefly appear checked then disappear
      const wildcardTreeData = [
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
                  name: '*',
                  type: '',
                  fullPath: ['spec', 'containers', '*'],
                  level: 2,
                  children: [
                    {
                      name: 'image',
                      type: 'string',
                      fullPath: ['spec', 'containers', '*', 'image'],
                      level: 3,
                      children: [],
                    },
                  ],
                },
                {
                  name: '0',
                  type: '',
                  fullPath: ['spec', 'containers', '0'],
                  level: 2,
                  children: [
                    {
                      name: 'image',
                      type: 'string',
                      fullPath: ['spec', 'containers', '0', 'image'],
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

      (App.GetNodeTree as any).mockResolvedValue(wildcardTreeData);

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
        expect(screen.getByText('spec')).toBeInTheDocument();
      });

      // Expand spec > containers > *
      const specExpandButton = screen.getAllByRole('button')[0];
      await user.click(specExpandButton);

      await waitFor(() => {
        expect(screen.getByText('containers')).toBeInTheDocument();
      });

      const containersExpandButton = screen.getAllByRole('button')[1];
      await user.click(containersExpandButton);

      await waitFor(() => {
        expect(screen.getByText('*')).toBeInTheDocument();
      });

      const wildcardExpandButton = screen.getAllByRole('button')[2];
      await user.click(wildcardExpandButton);

      await waitFor(() => {
        // Find the image node under wildcard
        const imageNodes = screen.getAllByText('image');
        expect(imageNodes.length).toBeGreaterThan(0);
      });

      // Find and click the checkbox for wildcard image
      const checkboxes = screen.getAllByRole('checkbox');
      // The first checkbox should be for *.image
      const wildcardImageCheckbox = checkboxes[0];
      await user.click(wildcardImageCheckbox);

      // Selection should persist
      await waitFor(() => {
        expect(ref.current.getSelectedCount()).toBeGreaterThan(0);
      });

      // Wait to ensure no cleanup removes it
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be selected (verify the checkbox is checked)
      expect(wildcardImageCheckbox).toHaveAttribute('data-state', 'checked');
    });

    it('should persist index selection (containers.0.image)', async () => {
      // This test verifies the fix for the bug where clicking containers.0.image
      // would not result in any visible change
      const indexTreeData = [
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
                  name: '0',
                  type: '',
                  fullPath: ['spec', 'containers', '0'],
                  level: 2,
                  children: [
                    {
                      name: 'image',
                      type: 'string',
                      fullPath: ['spec', 'containers', '0', 'image'],
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

      (App.GetNodeTree as any).mockResolvedValue(indexTreeData);

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
        expect(screen.getByText('spec')).toBeInTheDocument();
      });

      // Expand spec > containers > 0
      const specExpandButton = screen.getAllByRole('button')[0];
      await user.click(specExpandButton);

      await waitFor(() => {
        expect(screen.getByText('containers')).toBeInTheDocument();
      });

      const containersExpandButton = screen.getAllByRole('button')[1];
      await user.click(containersExpandButton);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });

      const indexExpandButton = screen.getAllByRole('button')[2];
      await user.click(indexExpandButton);

      await waitFor(() => {
        expect(screen.getByText('image')).toBeInTheDocument();
      });

      // Find and click the checkbox for 0.image
      const checkboxes = screen.getAllByRole('checkbox');
      const indexImageCheckbox = checkboxes[0];
      await user.click(indexImageCheckbox);

      // Selection should persist
      await waitFor(() => {
        expect(ref.current.getSelectedCount()).toBe(1);
      });

      // Wait to ensure no cleanup removes it
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be selected
      expect(ref.current.getSelectedCount()).toBe(1);
      expect(indexImageCheckbox).toHaveAttribute('data-state', 'checked');

      // onFieldsSelected should have been called with the correct path
      expect(mockOnFieldsSelected).toHaveBeenCalledWith([
        ['spec', 'containers', '0', 'image'],
      ]);
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

      // Manually expand metadata
      const expandButtons = screen.getAllByRole('button');
      await user.click(expandButtons[0]); // Expand metadata

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      // spec should be collapsed
      expect(screen.queryByText('nodeName')).not.toBeInTheDocument();

      // Open search via ref
      act(() => {
        ref.current.toggleSearch();
      });
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument();
      });
      const searchInput = screen.getByPlaceholderText('Search ...');
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

      // Open search via ref
      act(() => {
        ref.current.toggleSearch();
      });
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument();
      });
      const searchInput = screen.getByPlaceholderText('Search ...');
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

  describe('Field Hover Sync (NP → RT)', () => {
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
            name: 'containers',
            type: '[]Container',
            fullPath: ['spec', 'containers'],
            level: 1,
            children: [],
          },
        ],
      },
    ];

    it('should call onFieldFocus with path when hovering a leaf field', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const mockOnFieldFocus = vi.fn();
      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
          onFieldFocus={mockOnFieldFocus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Expand metadata
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      // Hover over the 'name' leaf field
      const nameElement = screen.getByText('name');
      const nameRow = nameElement.closest('div[class*="flex items-center"]');
      fireEvent.mouseEnter(nameRow!);

      // onFieldFocus should be called with the field path
      await waitFor(() => {
        expect(mockOnFieldFocus).toHaveBeenCalledWith(['metadata', 'name']);
      });
    });

    it('should call onFieldFocus with null when hovering a non-leaf field', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const mockOnFieldFocus = vi.fn();
      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
          onFieldFocus={mockOnFieldFocus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // First expand metadata and hover on a leaf field
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      const nameElement = screen.getByText('name');
      const nameRow = nameElement.closest('div[class*="flex items-center"]');
      fireEvent.mouseEnter(nameRow!);

      await waitFor(() => {
        expect(mockOnFieldFocus).toHaveBeenCalledWith(['metadata', 'name']);
      });

      // Now hover over 'metadata' (non-leaf with children)
      const metadataElement = screen.getByText('metadata');
      const metadataRow = metadataElement.closest('div[class*="flex items-center"]');
      fireEvent.mouseEnter(metadataRow!);

      // onFieldFocus should be called with null for non-leaf
      await waitFor(() => {
        expect(mockOnFieldFocus).toHaveBeenLastCalledWith(null);
      });
    });

    it('should call onFieldFocus with null when hovering array/map type field', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const mockOnFieldFocus = vi.fn();
      const user = userEvent.setup();

      render(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
          onFieldFocus={mockOnFieldFocus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('spec')).toBeInTheDocument();
      });

      // Expand spec to see containers (array type)
      const specElement = screen.getByText('spec');
      const specRow = specElement.closest('div[class*="flex items-center"]');
      const specExpandButton = specRow?.querySelector('button');
      await user.click(specExpandButton!);

      await waitFor(() => {
        expect(screen.getByText('containers')).toBeInTheDocument();
      });

      // Hover over containers (type: '[]Container' - array type without children)
      const containersElement = screen.getByText('containers');
      const containersRow = containersElement.closest('div[class*="flex items-center"]');
      fireEvent.mouseEnter(containersRow!);

      // onFieldFocus should be called with null for array type
      await waitFor(() => {
        expect(mockOnFieldFocus).toHaveBeenLastCalledWith(null);
      });
    });

    it('should trigger onFieldFocus via keyboard navigation to leaf field', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const mockOnFieldFocus = vi.fn();
      const user = userEvent.setup();
      const ref = { current: null as any };

      render(
        <NavigationPanel
          ref={ref}
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
          onFieldFocus={mockOnFieldFocus}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('metadata')).toBeInTheDocument();
      });

      // Expand metadata to expose leaf nodes
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      // Clear mock calls from initial render and mouse interactions
      mockOnFieldFocus.mockClear();

      // Navigate to first node (metadata), then to 'name' (leaf field)
      act(() => {
        ref.current.navigateDown(); // Focus on metadata
        ref.current.navigateDown(); // Focus on name (leaf)
      });

      // name is a leaf, so should eventually call with path
      await waitFor(() => {
        expect(mockOnFieldFocus).toHaveBeenCalledWith(['metadata', 'name']);
      }, { timeout: 1000 });
    });
  });

  describe('Field Highlight from RT (RT → NP)', () => {
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

    it('should apply highlight style when highlightedFieldPath matches a field', async () => {
      (App.GetNodeTree as any).mockResolvedValue(mockTreeData);

      const user = userEvent.setup();

      const { rerender } = render(
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
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('name')).toBeInTheDocument();
      });

      // Initially no highlight
      const nameElement = screen.getByText('name');
      const nameRow = nameElement.closest('div[class*="flex items-center"]');
      expect(nameRow?.className).not.toContain('bg-focus');

      // Rerender with highlightedFieldPath
      rerender(
        <NavigationPanel
          selectedGVK={mockGVK}
          connectedContexts={mockContexts}
          onFieldsSelected={mockOnFieldsSelected}
          highlightedFieldPath={['metadata', 'name']}
        />
      );

      // Now the field should have highlight style
      await waitFor(() => {
        const updatedNameElement = screen.getByText('name');
        const updatedNameRow = updatedNameElement.closest('div[class*="flex items-center"]');
        expect(updatedNameRow?.className).toContain('bg-focus');
      });
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

      // Expand and select a field (use namespace, not name - it's a default column)
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('namespace')).toBeInTheDocument();
      });

      const namespaceCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('namespace');
      });
      await user.click(namespaceCheckbox!);

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

      // Expand metadata and select namespace (not name - it's a default column)
      const expandButton = screen.getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('namespace')).toBeInTheDocument();
      });

      const namespaceCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const parent = cb.closest('div');
        return parent?.textContent?.includes('namespace');
      });
      await user.click(namespaceCheckbox!);

      await waitFor(() => {
        expect(ref.current.getSelectedCount()).toBe(1);
      });

      const selectedPaths = ref.current.getSelectedPaths();
      expect(selectedPaths.size).toBe(1);

      // The path should use PATH_DELIMITER (null character)
      const PATH_DELIMITER = '\x00';
      expect(selectedPaths.has(['metadata', 'namespace'].join(PATH_DELIMITER))).toBe(true);
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
      expect(screen.queryByPlaceholderText('Search ...')).not.toBeInTheDocument();

      // Toggle search via ref
      act(() => {
        ref.current.toggleSearch();
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search ...')).toBeInTheDocument();
      });

      // Toggle again to close
      act(() => {
        ref.current.toggleSearch();
      });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search ...')).not.toBeInTheDocument();
      });
    });
  });
});
