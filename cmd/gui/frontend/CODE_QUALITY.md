# Frontend Code Quality Guidelines

This document defines the code quality standards for the frontend codebase. All code must adhere to these guidelines to ensure TypeScript type safety, React best practices, and code maintainability.

## Core Principles

- ✅ **No type assertions (`as`)**
- ✅ **Type safety first**
- ✅ **No unused imports**
- ✅ **Explicit type declarations**
- ✅ **React best practices**

---

## 1. Type Assertions

### Rule: Never Use Type Assertions

Type assertions (`as`) bypass TypeScript's type checking and should be avoided.

**❌ Don't:**
```tsx
const indices = [] as [number, number][];
const result = data as MyType;
```

**✅ Do:**
```tsx
const indices: [number, number][] = [];
const result: MyType = {
  // Explicit properties
};
```

**Rationale:**
- Type assertions hide type errors
- They reduce compile-time safety
- They make refactoring dangerous

---

## 2. Unused Imports

### Rule: Remove All Unused Imports

Every import must be used in the file.

**❌ Don't:**
```tsx
import { useState, useEffect, useMemo } from "react";
import { Helper1, Helper2, UnusedHelper } from "./utils";

// UnusedHelper is never used
```

**✅ Do:**
```tsx
import { useState, useEffect } from "react";
import { Helper1, Helper2 } from "./utils";
```

**Rationale:**
- Reduces bundle size
- Improves code clarity
- Prevents confusion about dependencies

---

## 3. Type Safety

### 3.1 Safe Array Access

Always check for undefined before accessing array elements.

**❌ Don't:**
```tsx
const item = items[index].property; // Could throw if undefined
```

**✅ Do:**
```tsx
const item = items[index];
if (item) {
  const property = item.property;
}
```

### 3.2 Explicit Type Annotations

Provide explicit types for complex structures.

**❌ Don't:**
```tsx
const results = useMemo(() => {
  return items.map(item => ({
    // Inferred type may be too loose
    id: item.id,
    name: item.name,
  }));
}, [items]);
```

**✅ Do:**
```tsx
interface Result {
  id: string;
  name: string;
}

const results = useMemo<Result[]>(() => {
  return items.map((item): Result => ({
    id: item.id,
    name: item.name,
  }));
}, [items]);
```

### 3.3 React Element Keys

All elements in arrays must have unique, stable keys.

**❌ Don't:**
```tsx
parts.push(text.substring(0, 5)); // No key
parts.push(<span>{text}</span>); // No key
indices.forEach(([start, end], idx) => {
  parts.push(<mark key={idx}>{text}</mark>); // Index as key
});
```

**✅ Do:**
```tsx
let keyCounter = 0;

parts.push(
  <span key={`text-${keyCounter++}`}>
    {text.substring(0, 5)}
  </span>
);
parts.push(
  <span key={`text-${keyCounter++}`}>{text}</span>
);
indices.forEach(([start, end]) => {
  parts.push(
    <mark key={`mark-${keyCounter++}`}>{text}</mark>
  );
});
```

---

## 4. React Best Practices

### 4.1 Function Memoization

Use `useCallback` for event handlers and functions passed to child components.

**❌ Don't:**
```tsx
const handleClick = (id: string) => {
  // Function recreated on every render
  setSelected(id);
};
```

**✅ Do:**
```tsx
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);

// Or with dependencies
const handleClick = useCallback((id: string) => {
  onSelect(id);
}, [onSelect]);
```

### 4.2 Functional State Updates

Use functional updates when new state depends on previous state.

**❌ Don't:**
```tsx
const handleToggle = (item: string) => {
  const newSet = new Set(selectedItems);
  if (newSet.has(item)) {
    newSet.delete(item);
  } else {
    newSet.add(item);
  }
  setSelectedItems(newSet);
};
```

**✅ Do:**
```tsx
const handleToggle = useCallback((item: string) => {
  setSelectedItems((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(item)) {
      newSet.delete(item);
    } else {
      newSet.add(item);
    }
    return newSet;
  });
}, []);
```

### 4.3 Complete Dependency Arrays

Include all dependencies in `useEffect` and `useCallback` dependency arrays.

**❌ Don't:**
```tsx
useEffect(() => {
  handleSearch(query); // Missing handleSearch in deps
}, [query]);
```

**✅ Do:**
```tsx
useEffect(() => {
  handleSearch(query);
}, [query, handleSearch]);
```

**Note:** This is why handlers should be memoized with `useCallback`.

---

## 5. Import Organization

### Rule: Import Only What You Need

**❌ Don't:**
```tsx
import * as React from "react";
import { FC, ReactNode, useState, useEffect, useMemo } from "react";
```

**✅ Do:**
```tsx
import { useState, useEffect, ReactNode } from "react";
```

### Import Order

1. External dependencies (React, libraries)
2. Internal dependencies (utils, components)
3. Type imports (if using `import type`)

```tsx
// External
import { useState, useCallback } from "react";
import fuzzysort from "fuzzysort";

// Internal
import { Button } from "./ui/button";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
```

---

## 6. Type Definitions

### 6.1 Interface vs Type

Use `interface` for object shapes, `type` for unions and complex types.

```tsx
// Interface for object shapes
interface User {
  id: string;
  name: string;
}

// Type for unions and complex types
type Status = "idle" | "loading" | "success" | "error";
type Result = User | null;
```

### 6.2 Readonly Types

Use `readonly` for props and data that shouldn't be mutated.

```tsx
interface Props {
  readonly items: readonly string[];
  readonly onSelect: (id: string) => void;
}
```

---

## 7. Testing

### Rule: Write Type-Safe Tests

Tests should also follow type safety rules.

```tsx
import { describe, it, expect } from 'vitest';
import { indexesToRanges } from './useFuzzySearch';

describe('indexesToRanges', () => {
  it('converts continuous indexes to a single range', () => {
    const input: readonly number[] = [0, 1, 2, 3];
    const expected: [number, number][] = [[0, 3]];
    expect(indexesToRanges(input)).toEqual(expected);
  });
});
```

---

## Enforcement

### Pre-commit Checks
- Type checking: `tsc --noEmit`
- Linting: `eslint .`
- Tests: `npm run test:run`

### Recommended TypeScript Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Recommended ESLint Rules

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/consistent-type-assertions": ["error", {
      "assertionStyle": "never"
    }],
    "react-hooks/exhaustive-deps": "error",
    "react/jsx-key": "error"
  }
}
```

---

## Quick Checklist

Before submitting code, verify:

- [ ] No type assertions (`as`)
- [ ] No unused imports
- [ ] All array accesses are safe
- [ ] Event handlers use `useCallback`
- [ ] State updates are functional when needed
- [ ] All dependencies are in dependency arrays
- [ ] All list items have unique keys
- [ ] Types are explicitly declared for complex structures
- [ ] Tests pass: `npm run test:run`

---

*These guidelines are mandatory for all frontend code.*
