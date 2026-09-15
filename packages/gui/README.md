# @agile-sofl/gui

Restricted HTML5 GUI specification (`.gui.html`) parser, validator, patch, inventory, and scenario-animation helpers for Agile-SOFL Studio.

The source of truth is sanitized HTML using `as-*` classes and `data-screen` / `data-process` / `data-bind` / `data-nav`. Legacy YAML `.guispec` files are migrated on parse.

```typescript
import { parseGuiSpec, buildGuiModel, patchGui } from '@agile-sofl/gui'
```
