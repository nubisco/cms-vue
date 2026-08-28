/**
 * The framework-agnostic core must stay framework-agnostic.
 *
 * These modules are the future `@nubisco/cms-core`: the link model, the richtext
 * model, the image model and the field contract. Today they ship inside
 * cms-vue, but nothing in them may import a framework, so extracting a core
 * package that cms-vue, cms-react and cms-svelte all depend on stays a move
 * rather than a rewrite.
 *
 * One stray `import { ref } from 'vue'` is all it takes to lose that, and it
 * would fail no other check, so it fails this one.
 */
import { readFileSync } from 'node:fs'

const CORE = ['src/link.ts', 'src/image.ts', 'src/richtext.ts', 'src/contract.ts', 'src/resolve.ts', 'src/evaluate.ts']
const FRAMEWORKS = ['vue', 'react', 'svelte', 'preact', '@vue/']

let bad = 0
let checked = 0
for (const file of CORE) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue // a core module that does not exist yet is not a violation
  }
  checked++
  for (const m of src.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1]
    if (FRAMEWORKS.some((f) => spec === f || spec.startsWith(f))) {
      console.error(`  ${file} imports "${spec}"`)
      bad++
    }
  }
}

if (bad) {
  console.error(`\ncore boundary violated: ${bad} framework import(s).`)
  console.error('These modules are the future @nubisco/cms-core. Framework code belongs in a .vue file or a composable.')
  process.exit(1)
}
console.log(`core boundary intact: ${checked} modules, no framework imports.`)
