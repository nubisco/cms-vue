/**
 * The core does not live here any more.
 *
 * These modules moved to @nubisco/cms-core, which cms-vue now depends on. This
 * script used to prove they imported no framework, which is what made that move
 * a file move rather than a rewrite. That job now belongs to cms-core's own
 * scripts/check-no-framework.mjs.
 *
 * What remains worth guarding is the opposite direction: nobody re-creating a
 * local copy of a core module here, which is how two implementations of the link
 * model would drift apart and how a future @nubisco/cms-react would inherit the
 * mess. So this fails if a core module reappears in src/, or if the dependency
 * on the core is dropped.
 *
 * It deliberately does NOT pass by checking nothing: an empty check that reports
 * success is worse than no check, because it reads as a guarantee.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MOVED = ['link.ts', 'image.ts', 'richtext.ts', 'resolve.ts', 'evaluate.ts', 'graph.ts', 'contract']

const reappeared = MOVED.filter((m) => existsSync(join(root, 'src', m)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dep = pkg.dependencies?.['@nubisco/cms-core']

const problems = []
if (reappeared.length) {
  problems.push(
    `these belong to @nubisco/cms-core but exist again in src/: ${reappeared.join(', ')}.\n` +
      '  Import them from the package instead of re-implementing them here.',
  )
}
if (!dep) {
  problems.push('package.json no longer depends on @nubisco/cms-core, so the re-export in src/index.ts is broken.')
}

if (problems.length) {
  console.error('core boundary violated:')
  for (const p of problems) console.error(`- ${p}`)
  process.exit(1)
}

console.log(`core boundary intact: core lives in @nubisco/cms-core (${dep}), ${MOVED.length} modules not duplicated here.`)
