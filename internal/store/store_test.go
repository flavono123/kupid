package store

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStore(t *testing.T) {
	// Use temp directory for tests
	tmpDir := t.TempDir()
	store := &Store{
		path: filepath.Join(tmpDir, "test-favorites.json"),
		data: &favoriteViewStore{Views: []FavoriteView{}},
	}

	gvk := GVKRef{Group: "", Version: "v1", Kind: "Pod"}
	fields := [][]string{{"metadata", "name"}, {"status", "phase"}}

	t.Run("Create", func(t *testing.T) {
		view, err := store.Create("Test View", gvk, fields)
		if err != nil {
			t.Fatalf("Create failed: %v", err)
		}
		if view.Name != "Test View" {
			t.Errorf("expected name 'Test View', got %q", view.Name)
		}
		if view.ID == "" {
			t.Error("expected non-empty ID")
		}
	})

	t.Run("DuplicateName", func(t *testing.T) {
		_, err := store.Create("Test View", gvk, fields)
		if err != ErrDuplicateName {
			t.Errorf("expected ErrDuplicateName, got %v", err)
		}
	})

	t.Run("SameNameDifferentGVK", func(t *testing.T) {
		otherGVK := GVKRef{Group: "apps", Version: "v1", Kind: "Deployment"}
		_, err := store.Create("Test View", otherGVK, fields)
		if err != nil {
			t.Fatalf("expected no error for same name in different GVK, got %v", err)
		}
	})

	t.Run("ListAll", func(t *testing.T) {
		all := store.ListAll()
		if len(all) != 2 {
			t.Errorf("expected 2 views, got %d", len(all))
		}
	})

	t.Run("ListByGVK", func(t *testing.T) {
		views := store.ListByGVK(gvk)
		if len(views) != 1 {
			t.Errorf("expected 1 view for Pod GVK, got %d", len(views))
		}
	})

	t.Run("Get", func(t *testing.T) {
		all := store.ListAll()
		view, err := store.Get(all[0].ID)
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if view.Name != all[0].Name {
			t.Errorf("expected name %q, got %q", all[0].Name, view.Name)
		}
	})

	t.Run("GetNotFound", func(t *testing.T) {
		_, err := store.Get("nonexistent")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("Rename", func(t *testing.T) {
		all := store.ListAll()
		view, err := store.Rename(all[0].ID, "Renamed View")
		if err != nil {
			t.Fatalf("Rename failed: %v", err)
		}
		if view.Name != "Renamed View" {
			t.Errorf("expected name 'Renamed View', got %q", view.Name)
		}
	})

	t.Run("SaveAndLoad", func(t *testing.T) {
		if err := store.Save(); err != nil {
			t.Fatalf("Save failed: %v", err)
		}

		// Create new store and load
		store2 := &Store{
			path: store.path,
			data: &favoriteViewStore{Views: []FavoriteView{}},
		}
		if err := store2.Load(); err != nil {
			t.Fatalf("Load failed: %v", err)
		}

		all := store2.ListAll()
		if len(all) != 2 {
			t.Errorf("expected 2 views after load, got %d", len(all))
		}
	})

	t.Run("Delete", func(t *testing.T) {
		all := store.ListAll()
		if err := store.Delete(all[0].ID); err != nil {
			t.Fatalf("Delete failed: %v", err)
		}
		remaining := store.ListAll()
		if len(remaining) != 1 {
			t.Errorf("expected 1 view after delete, got %d", len(remaining))
		}
	})

	t.Run("DeleteNotFound", func(t *testing.T) {
		err := store.Delete("nonexistent")
		if err != ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("LoadNonExistentFile", func(t *testing.T) {
		store3 := &Store{
			path: filepath.Join(tmpDir, "nonexistent.json"),
			data: &favoriteViewStore{Views: []FavoriteView{}},
		}
		if err := store3.Load(); err != nil {
			t.Fatalf("Load should not fail for non-existent file: %v", err)
		}
		if len(store3.ListAll()) != 0 {
			t.Error("expected empty views for non-existent file")
		}
	})

	t.Run("LoadCorruptedFile", func(t *testing.T) {
		corruptPath := filepath.Join(tmpDir, "corrupted.json")
		if err := os.WriteFile(corruptPath, []byte("not valid json"), 0644); err != nil {
			t.Fatalf("failed to write corrupted file: %v", err)
		}

		store4 := &Store{
			path: corruptPath,
			data: &favoriteViewStore{Views: []FavoriteView{}},
		}
		if err := store4.Load(); err != nil {
			t.Fatalf("Load should handle corrupted file gracefully: %v", err)
		}
		if len(store4.ListAll()) != 0 {
			t.Error("expected empty views after loading corrupted file")
		}
	})
}
