// Collapse byte-identical justificatifs in a flat export folder.
// Run this after the download step and before split.mjs.
//
// One kept file can serve several transactions: Qonto attaches the same monthly
// invoice to every fee transaction. The script rewrites downloaded.tsv so the
// recap points to the kept name.
//
// The -1 / -2 suffix stays only when a transaction really keeps two different
// pieces. If deduplication leaves one piece, the suffix goes away.
//
// Env: WORK, EXPORT. Set DRY=1 to print the plan without any change.
// Optional $WORK/overrides.json -> { "canonical": { "<oldName>": "<newName>" } }

import { readFileSync, writeFileSync, readdirSync, renameSync, unlinkSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const { WORK, EXPORT, DRY } = process.env
if (!WORK || !EXPORT) throw new Error('WORK and EXPORT are required')
const DIR = `${EXPORT}/justificatifs`

const overrides = existsSync(`${WORK}/overrides.json`)
  ? JSON.parse(readFileSync(`${WORK}/overrides.json`, 'utf8'))
  : {}
const CANONICAL = overrides.canonical ?? {}

const log = readFileSync(`${WORK}/downloaded.tsv`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'))

const groups = new Map()
for (const f of readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name !== '.DS_Store')
  .map((d) => d.name)
  .sort()) {
  const h = createHash('md5').update(readFileSync(`${DIR}/${f}`)).digest('hex')
  if (!groups.has(h)) groups.set(h, [])
  groups.get(h).push(f)
}

const remap = new Map()
const toDelete = []
for (const files of groups.values()) {
  const keep =
    files.find((f) => !/-[12]\.[a-z]+$/i.test(f)) ??
    [...files].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
  for (const f of files) {
    remap.set(f, keep)
    if (f !== keep) toDelete.push(f)
  }
}

// Count the distinct survivors per transaction to know if a suffix is needed.
const perTx = new Map()
for (const [txId, name] of log) {
  const keep = remap.get(name) ?? name
  if (!perTx.has(txId)) perTx.set(txId, new Set())
  perTx.get(txId).add(keep)
}

const finalName = new Map()
for (const survivor of new Set(remap.values())) {
  if (CANONICAL[survivor]) {
    finalName.set(survivor, CANONICAL[survivor])
    continue
  }
  const owner = log.find(([, n]) => (remap.get(n) ?? n) === survivor)?.[0]
  const siblings = owner ? perTx.get(owner).size : 1
  finalName.set(survivor, siblings > 1 ? survivor : survivor.replace(/-1(\.[a-z]+)$/i, '$1'))
}

const toRename = [...finalName].filter(([a, b]) => a !== b)

console.log('--- renommages ---')
for (const [a, b] of toRename) console.log(`  ${a}\n    -> ${b}`)
console.log('--- suppressions (doublons stricts) ---')
for (const f of toDelete) console.log(`  ${f}  -> ${finalName.get(remap.get(f))}`)
console.log('--- paires conservees (2 pieces distinctes) ---')
for (const [txId, set] of perTx) {
  if (set.size > 1) console.log(`  ${txId}: ${[...set].map((s) => finalName.get(s)).join(' + ')}`)
}

if (DRY === '1') {
  console.log(`\nDRY RUN: ${toRename.length} renommages, ${toDelete.length} suppressions`)
  process.exit(0)
}

for (const f of toDelete) unlinkSync(`${DIR}/${f}`)
for (const [from, to] of toRename) renameSync(`${DIR}/${from}`, `${DIR}/${to}`)

const seen = new Set()
const lines = []
for (const c of log) {
  c[1] = finalName.get(remap.get(c[1]) ?? c[1]) ?? c[1]
  const key = `${c[0]}\t${c[1]}`
  if (seen.has(key)) continue
  seen.add(key)
  lines.push(c.join('\t'))
}
writeFileSync(`${WORK}/downloaded.tsv`, lines.join('\n') + '\n')

console.log(`\nfichiers restants: ${readdirSync(DIR).length}`)
console.log(`lignes downloaded.tsv: ${lines.length}`)
