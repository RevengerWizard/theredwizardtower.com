---
title: "Structured search and sorting"
date: 2024-11-18
draft: false
tags: ["programming", "algorithms", "golang"]
description: "A test article with code blocks, tables, and a slightly longer narrative to validate the content layout."
---

This post is intentionally more complex than the existing ones so you can test headings, code blocks, lists, and inline formatting on the site.

## Overview

When I structure a search problem, I usually start by defining:

1. The input shape
2. The expected output
3. The invariants I can depend on
4. The failure modes I need to handle

That keeps the implementation small and the tests focused.

## Example

```go
package main

import (
    "fmt"
    "sort"
)

type Item struct {
    Name  string
    Score int
}

func topItems(items []Item, limit int) []Item {
    cloned := append([]Item(nil), items...)

    sort.SliceStable(cloned, func(i, j int) bool {
        if cloned[i].Score == cloned[j].Score {
            return cloned[i].Name < cloned[j].Name
        }
        return cloned[i].Score > cloned[j].Score
    })

    if limit > len(cloned) {
        limit = len(cloned)
    }
    return cloned[:limit]
}

func main() {
    items := []Item{
        {Name: "alpha", Score: 10},
        {Name: "beta", Score: 15},
        {Name: "gamma", Score: 15},
    }

    fmt.Println(topItems(items, 2))
}
```

## Sorting Strategy

The important detail is to make the tie-breaker explicit. If two records have the same primary score, the result should still be deterministic.

### Data Table

| Name | Score | Notes |
| --- | ---: | --- |
| alpha | 10 | baseline |
| beta | 15 | best score |
| gamma | 15 | same score, alphabetic tie-break |

> Use deterministic ordering when the UI needs repeatable output.

## Follow-up

After this file renders properly, the next thing I would test is a fenced block inside a nested section, plus a long excerpt on the list page.
