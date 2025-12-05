# Go Code Quality Guidelines

## Mandatory Standards for Go Code

### 1. Error Handling

**ALWAYS check and handle errors explicitly**
```go
// ❌ BAD
data, _ := os.ReadFile(path)

// ✅ GOOD
data, err := os.ReadFile(path)
if err != nil {
    return fmt.Errorf("failed to read file %s: %w", path, err)
}
```

**Use %w for error wrapping (Go 1.13+)**
```go
// ❌ BAD
return fmt.Errorf("failed to create client: %v", err)

// ✅ GOOD
return fmt.Errorf("failed to create client: %w", err)
```

### 2. Exported vs Unexported Identifiers

**ONLY export what's needed by external packages**
```go
// ❌ BAD: Unnecessary export
func InternalHelper() {}  // Only used within package

// ✅ GOOD: Unexported
func internalHelper() {}

// ✅ GOOD: Exported (used by cmd/gui/app.go)
func ListContexts() ([]string, error) {}
```

**Check usage before exporting:**
- If only used within `internal/kube/`, use lowercase (unexported)
- If used by `cmd/`, use uppercase (exported)

### 3. Resource Management

**ALWAYS use defer for cleanup**
```go
// ❌ BAD
mu.Lock()
doWork()
mu.Unlock()

// ✅ GOOD
mu.Lock()
defer mu.Unlock()
doWork()
```

**Close resources in defer**
```go
// ✅ GOOD
f, err := os.Open(path)
if err != nil {
    return err
}
defer f.Close()
```

### 4. Concurrency Safety

**Use sync.RWMutex for read-heavy workloads**
```go
// ✅ GOOD: Read lock for reads
clientSetsMu.RLock()
cs, exists := clientSets[contextName]
clientSetsMu.RUnlock()

// ✅ GOOD: Write lock for writes
clientSetsMu.Lock()
defer clientSetsMu.Unlock()
clientSets[contextName] = cs
```

**Double-check pattern for cache**
```go
// ✅ GOOD: Prevent race conditions
mu.RLock()
if val, exists := cache[key]; exists {
    mu.RUnlock()
    return val, nil
}
mu.RUnlock()

mu.Lock()
defer mu.Unlock()

// Double-check after acquiring write lock
if val, exists := cache[key]; exists {
    return val, nil
}

// Create and cache
cache[key] = newValue
return newValue, nil
```

### 5. Context Handling

**Use context.Context for cancellation**
```go
// ✅ GOOD: Accept context parameter
func FetchData(ctx context.Context, url string) error {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    // ...
}
```

**Pass context down the call stack**
```go
// ❌ BAD: Creating new context
func handler() {
    ctx := context.Background()
    fetchData(ctx)
}

// ✅ GOOD: Using passed context
func handler(ctx context.Context) {
    fetchData(ctx)
}
```

### 6. Nil Checks

**Check for nil before dereferencing**
```go
// ❌ BAD
result := config.Clusters[name].Server

// ✅ GOOD
cluster, exists := config.Clusters[name]
if !exists || cluster == nil {
    return fmt.Errorf("cluster %s not found", name)
}
result := cluster.Server
```

### 7. Variable Naming

**Use short names for short scopes**
```go
// ✅ GOOD: Short variable in loop
for _, ctx := range contexts {
    processContext(ctx)
}

// ✅ GOOD: Descriptive name for longer scope
discoveryClient, err := DiscoveryClientForContext(contextName)
```

**Avoid redundant names**
```go
// ❌ BAD
userUser := GetUser()
contextContext := GetContext()

// ✅ GOOD
user := GetUser()
context := GetContext()
```

### 8. Function Organization

**Keep functions focused (single responsibility)**
```go
// ❌ BAD: Doing too much
func ProcessAndSave(data []byte) error {
    // Parse
    // Validate
    // Transform
    // Save to DB
    // Send notification
}

// ✅ GOOD: Separate concerns
func Parse(data []byte) (*Result, error) {}
func Validate(r *Result) error {}
func Save(r *Result) error {}
```

### 9. Testing

**Write table-driven tests**
```go
func TestIndexesToRanges(t *testing.T) {
    tests := []struct {
        name     string
        input    []int
        expected [][2]int
    }{
        {"empty", []int{}, [][2]int{}},
        {"single", []int{0}, [][2]int{{0, 0}}},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := indexesToRanges(tt.input)
            // assert result == tt.expected
        })
    }
}
```

### 10. Package Organization

**internal/ for non-exported packages**
```
internal/kube/     # Not importable by external projects
pkg/utils/         # Importable by external projects
cmd/               # Main applications
```

## Common Anti-Patterns to Avoid

### ❌ Ignoring errors
```go
_ = file.Close()
```

### ❌ Panic in library code
```go
// Only panic in main() or init(), never in library functions
if err != nil {
    panic(err)  // ❌ BAD
}
```

### ❌ Naked returns with named return values
```go
func bad() (result string, err error) {
    result = "value"
    return  // ❌ Unclear what's being returned
}
```

### ❌ Goroutine leaks
```go
// ❌ BAD: Goroutine never exits
go func() {
    for {
        doWork()
    }
}()

// ✅ GOOD: Use context for cancellation
go func(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        default:
            doWork()
        }
    }
}(ctx)
```

## Quick Checklist

Before committing Go code, verify:

- [ ] All errors are checked and wrapped with %w
- [ ] No unused exported functions (CapitalCase)
- [ ] defer used for all cleanup operations
- [ ] Mutex locks have corresponding defer unlock
- [ ] No race conditions in concurrent code
- [ ] Nil checks before pointer dereference
- [ ] context.Context passed down call stack
- [ ] No goroutine leaks
- [ ] Table-driven tests for complex logic
- [ ] gofmt and golint pass

## Enforcement

Run before commit:
```bash
# Format
go fmt ./...

# Lint
golangci-lint run

# Vet
go vet ./...

# Test
go test ./...
```
