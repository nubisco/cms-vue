# @nubisco/cms-vue

The shared kit for the Nubisco CMS. Framework-agnostic content model plus the
tools to render and gate it. Consumed by both the CMS editor and the sites it
edits, so the two never drift.

Status: early. This package currently ships the **contract** and the
**evaluator**; the Vue **render kit** (a `CmsZone` resolver and field primitives
with in-context edit hooks) follows.

## What's here

- **Content contract** (`content`): `Field`, `Block` (composed or coded), `Zone`,
  `PageDocument`. Localized strings are stored by reference (`{ $t }`) so
  translations stay in the app's i18n / Verba, not inlined.
- **Logic** (`logic`): a `Condition` (simple predicate, boolean tree, or a
  reference to a visual graph) and an extensible logic-input registry
  (`featureFlag`, `environment`, `auth`, `region`, ...). `resolveAt` marks whether
  a condition can be evaluated at build time or must run at the edge.
- **Evaluator** (`evaluate`, `graph`): evaluates a condition to a visibility
  boolean, including logic graphs, given a host-provided environment.

## Usage

```ts
import { evaluate, type Condition, type LogicEnv } from '@nubisco/cms-vue'

const env: LogicEnv = {
  featureFlag: (params) => flags[String(params?.flag)] === true,
  environment: (_p, op, value) => (op === 'not' ? currentEnv !== value : currentEnv === value),
}

const visible = evaluate(block.when, env)
```

## Develop

```
pnpm install
pnpm build       # tsc -> dist (js + d.ts)
pnpm types:check
```

Published to npm when ready; linked locally (`link:`) during development.
