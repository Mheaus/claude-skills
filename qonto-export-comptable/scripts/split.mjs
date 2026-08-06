// Split the export justificatifs into ventes/ and achats/.
// Run this after dedupe.mjs and before recap.mjs. Safe to run twice.
//
// The bank side is not enough to classify a piece:
//  - a freelance-platform payout carries the client invoice (vente) AND the
//    platform commission invoice (achat) on the same credit transaction;
//  - a supplier credit note is a bank credit but stays an achat.
// So the file overrides win over the side of the transaction.
//
// Env: WORK, EXPORT. Set DRY=1 to print the plan without any change.
// Optional $WORK/overrides.json -> { "files": { "<name>": { "cat": "ventes",
//   "name": "<newName>" } } }
//
// The script stops when the plan does not cover the files on disk exactly.

import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, existsSync } from 'node:fs'

const { WORK, EXPORT, DRY } = process.env
if (!WORK || !EXPORT) throw new Error('WORK and EXPORT are required')
const SRC = `${EXPORT}/justificatifs`

const overrides = existsSync(`${WORK}/overrides.json`)
  ? JSON.parse(readFileSync(`${WORK}/overrides.json`, 'utf8'))
  : {}
const FILES = overrides.files ?? {}

const tx = JSON.parse(readFileSync(`${WORK}/tx.json`, 'utf8'))
const sideOf = new Map(tx.map((t) => [t.id, t.side]))

const tsv = (p) =>
  existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')) : []

const logs = [`${WORK}/downloaded.tsv`, `${WORK}/supplements.tsv`]
  .filter(existsSync)
  .map((path) => ({ path, rows: tsv(path) }))

const strip = (n) => n.replace(/^(ventes|achats)\//, '')

// A prefix already in the log is the record of an earlier run. Trust it, so a
// second run does not reclassify a file whose override key is its former name.
const plan = new Map()
for (const { rows } of logs) {
  for (const r of rows) {
    const old = strip(r[1])
    if (plan.has(old)) continue
    const done = r[1].match(/^(ventes|achats)\//)?.[1]
    if (done) {
      plan.set(old, { cat: done, name: old })
      continue
    }
    const o = FILES[old]
    const cat = o?.cat ?? (sideOf.get(r[0]) === 'credit' ? 'ventes' : 'achats')
    plan.set(old, { cat, name: o?.name ?? old })
  }
}

const onDisk = new Set()
for (const d of readdirSync(SRC, { withFileTypes: true })) {
  if (d.isFile() && d.name !== '.DS_Store') onDisk.add(d.name)
  if (d.isDirectory() && (d.name === 'ventes' || d.name === 'achats')) {
    for (const f of readdirSync(`${SRC}/${d.name}`)) if (f !== '.DS_Store') onDisk.add(f)
  }
}
// A file already moved and renamed by an earlier run counts as covered.
const planned = new Set([...plan.keys(), ...[...plan.values()].map((p) => p.name)])
const unplanned = [...onDisk].filter((f) => !planned.has(f))
const absent = [...plan.keys()].filter((f) => !onDisk.has(f) && !onDisk.has(plan.get(f).name))

const nVentes = [...plan.values()].filter((p) => p.cat === 'ventes').length
console.log('--- ventes ---')
for (const [old, p] of plan) if (p.cat === 'ventes') console.log(`  ventes/${p.name}${p.name !== old ? `   (etait ${old})` : ''}`)
console.log(`\nventes: ${nVentes}   achats: ${plan.size - nVentes}   total: ${plan.size}`)
if (unplanned.length) console.log(`!! sur le disque mais non classe: ${unplanned.join(', ')}`)
if (absent.length) console.log(`!! cite mais absent du disque: ${absent.join(', ')}`)

if (DRY === '1') {
  console.log('\nDRY RUN')
  process.exit(unplanned.length || absent.length ? 1 : 0)
}
if (unplanned.length || absent.length) {
  console.error('\nABANDON: le plan ne couvre pas exactement les fichiers presents.')
  process.exit(1)
}

mkdirSync(`${SRC}/ventes`, { recursive: true })
mkdirSync(`${SRC}/achats`, { recursive: true })
for (const [old, p] of plan) {
  const dest = `${SRC}/${p.cat}/${p.name}`
  if (existsSync(dest)) continue
  renameSync(`${SRC}/${old}`, dest)
}

for (const { path, rows } of logs) {
  const out = rows.map((r) => {
    const p = plan.get(strip(r[1]))
    r[1] = `${p.cat}/${p.name}`
    return r.join('\t')
  })
  writeFileSync(path, out.join('\n') + '\n')
}

console.log(`\nventes/: ${readdirSync(`${SRC}/ventes`).length} fichiers`)
console.log(`achats/: ${readdirSync(`${SRC}/achats`).length} fichiers`)
