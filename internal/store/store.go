package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/flavono123/kattle/internal/config"
)

var (
	ErrDuplicateName = errors.New("a favorite with this name already exists for this GVK")
	ErrNotFound      = errors.New("favorite view not found")
)

// favoriteViewStore is the JSON file structure.
type favoriteViewStore struct {
	Views []FavoriteView `json:"views"`
}

// Store manages persistent storage for favorite views.
type Store struct {
	path string
	data *favoriteViewStore
	mu   sync.RWMutex
}

// StoreOptions configures the store.
type StoreOptions struct {
	DevMode bool
}

// NewStore creates a new store with the default path.
func NewStore(opts ...StoreOptions) (*Store, error) {
	var opt StoreOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	appDir := config.AppID
	if opt.DevMode {
		appDir = config.AppID + "-dev"
	}

	dir := filepath.Join(configDir, appDir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	return &Store{
		path: filepath.Join(dir, "favorite-views.json"),
		data: &favoriteViewStore{Views: []FavoriteView{}},
	}, nil
}

// Load reads the store from disk.
func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		s.data = &favoriteViewStore{Views: []FavoriteView{}}
		return nil
	}
	if err != nil {
		return err
	}

	var store favoriteViewStore
	if err := json.Unmarshal(data, &store); err != nil {
		// Backup corrupted file and start fresh
		backupPath := s.path + ".backup." + time.Now().Format("20060102150405")
		_ = os.WriteFile(backupPath, data, 0644)
		s.data = &favoriteViewStore{Views: []FavoriteView{}}
		return nil
	}

	s.data = &store
	return nil
}

// Save writes the store to disk.
func (s *Store) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.path, data, 0644)
}

// ListAll returns all favorite views.
func (s *Store) ListAll() []FavoriteView {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]FavoriteView, len(s.data.Views))
	copy(result, s.data.Views)
	return result
}

// ListByGVK returns favorite views for a specific GVK.
func (s *Store) ListByGVK(gvk GVKRef) []FavoriteView {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []FavoriteView
	for _, v := range s.data.Views {
		if v.GVK == gvk {
			result = append(result, v)
		}
	}
	return result
}

// Get returns a favorite view by ID.
func (s *Store) Get(id string) (*FavoriteView, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, v := range s.data.Views {
		if v.ID == id {
			return &v, nil
		}
	}
	return nil, ErrNotFound
}

// Create adds a new favorite view.
func (s *Store) Create(name string, gvk GVKRef, fields [][]string) (*FavoriteView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for duplicate name within same GVK
	for _, v := range s.data.Views {
		if v.GVK == gvk && v.Name == name {
			return nil, ErrDuplicateName
		}
	}

	now := time.Now()
	view := FavoriteView{
		ID:        uuid.New().String(),
		Name:      name,
		GVK:       gvk,
		Fields:    fields,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.data.Views = append(s.data.Views, view)
	return &view, nil
}

// Delete removes a favorite view by ID.
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, v := range s.data.Views {
		if v.ID == id {
			s.data.Views = append(s.data.Views[:i], s.data.Views[i+1:]...)
			return nil
		}
	}
	return ErrNotFound
}

// Rename updates the name of a favorite view.
func (s *Store) Rename(id string, newName string) (*FavoriteView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var target *FavoriteView
	var targetIdx int
	for i := range s.data.Views {
		if s.data.Views[i].ID == id {
			target = &s.data.Views[i]
			targetIdx = i
			break
		}
	}
	if target == nil {
		return nil, ErrNotFound
	}

	// Check for duplicate name within same GVK (excluding self)
	for _, v := range s.data.Views {
		if v.GVK == target.GVK && v.Name == newName && v.ID != id {
			return nil, ErrDuplicateName
		}
	}

	s.data.Views[targetIdx].Name = newName
	s.data.Views[targetIdx].UpdatedAt = time.Now()

	result := s.data.Views[targetIdx]
	return &result, nil
}
