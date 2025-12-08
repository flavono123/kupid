import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
      expect(screen.queryByPlaceholderText('Search fields and types...')).not.toBeInTheDocument();

      // Press Cmd+F
      await user.keyboard('{Meta>}f{/Meta}');

      // Search bar should now be visible
      expect(screen.getByPlaceholderText('Search fields and types...')).toBeInTheDocument();
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
      expect(screen.getByPlaceholderText('Search fields and types...')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Search bar should be closed
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search fields and types...')).not.toBeInTheDocument();
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
  });
});
