---
id: task-046
title: Image optimization + content-hashed artifacts
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [build, assets, phase-4]
milestone: "Phase 4 — Build pipeline & config"
dependencies: []
parent_task_id:
---

## Description

Optimize source images and emit them as content-hashed artifacts the host
references by stable path, so asset identity is reproducible and cache-safe.

## Acceptance Criteria

- [ ] #1 Source images are optimized (resized/compressed) into the configured output formats
- [ ] #2 Each emitted asset filename includes a content hash; identical input yields the identical name
- [ ] #3 A manifest maps logical asset ids to hashed filenames and is the only path the host consumes
- [ ] #4 Optimized output is excluded from VCS and produced by the build

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #1, #3 — a fixture image set produces optimized outputs and a resolvable manifest
- constraint/architecture (CI): #2 — re-running the pipeline yields identical hashed filenames

## Implementation Plan

`packages/build/src/optimize-images.ts`; emits hashed assets + a manifest consumed by the host.

## Implementation Notes

_None yet._
