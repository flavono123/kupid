package store

import "time"

// GVKRef identifies a Kubernetes GroupVersionKind.
type GVKRef struct {
	Group   string `json:"group"`
	Version string `json:"version"`
	Kind    string `json:"kind"`
}

// FavoriteView represents a saved field selection for a GVK.
type FavoriteView struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	GVK       GVKRef     `json:"gvk"`
	Fields    [][]string `json:"fields"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}
