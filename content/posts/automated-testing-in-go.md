---
title: "Automated testing in Go"
date: 2024-11-20
draft: false
tags: ["programming", "testing", "golang"]
description: "Exploring the standard library's testing package and how to write effective unit tests in Go."
---

Testing is a first-class citizen in the Go ecosystem. The `testing` package provides all the tools you need to write robust tests.

## A Simple Test

To write a test, create a file ending in `_test.go` and use the `TestXxx` signature.

```go
func TestAdd(t *testing.T) {
    result := Add(1, 2)
    if result != 3 {
        t.Errorf("Expected 3, got %d", result)
    }
}
```

## Table-Driven Tests

Table-driven tests are the idiomatic way to test multiple scenarios.

```go
func TestSubtract(t *testing.T) {
    tests := []struct {
        a, b, expected int
    }{
        {5, 3, 2},
        {10, 5, 5},
        {0, 0, 0},
    }

    for _, tt := range tests {
        result := Subtract(tt.a, tt.b)
        if result != tt.expected {
            t.Errorf("Subtract(%d, %d) = %d; want %d", tt.a, tt.b, result, tt.expected)
        }
    }
}
```

## Conclusion

Writing tests in Go is straightforward and encourages better software design.
