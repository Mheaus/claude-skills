// Final gate before you tell the user the export is ready.
// Checks that every piece cited in the recap exists, that no file is orphan,
// that the recap totals match the amounts you pass, and that no .DS_Store stays.
//
// Env: MONTH, EXPORT, and STATEMENT_DEBIT / STATEMENT_CREDIT read from the
// statement PDF (decimal point or comma, both accepted).
// Exit code 1 when a check fails.

import { readFileSync, readdirSync, existsSync } from 'node:fs'

const { MONTH, EXPORT, STATEMENT_DEBIT, STATEMENT_CREDIT } = process.env
if (!MONTH || !EXPORT) throw new Error('MONTH and EXPORT are required')

const DIR = `${EXPORT}/justificatifs`
const fails = []

const have = new Set()
for (const sub of ['ventes', 'achats']) {
  if (!existsSync(`${DIR}/${sub}`)) continue
  for (const f of readdirSync(`${DIR}/${sub}`)) if (f !== '.DS_Store') have.add(`${sub}/${f}`)
}
const loose = readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name !== '.DS_Store')
  .map((d) => d.name)
if (loose.length) fails.push(`fichiers hors ventes/ et achats/ : ${loose.join(', ')}`)

const lines = readFileSync(`${EXPORT}/recap-${MONTH}.csv`, 'utf8')
  .replace(/^﻿/, '')
  .split('\r\n')
  .filter(Boolean)
const cell = (line, i) => (line.match(/"([^"]|"")*"/g) ?? [])[i]?.slice(1, -1) ?? ''

const cited = new Set()
const missing = []
let totalRow
for (const line of lines.slice(1)) {
  if (cell(line, 0) === 'TOTAUX') {
    totalRow = line
    continue
  }
  const files = cell(line, 9)
  if (!files) continue
  for (const f of files.split(' | ')) {
    cited.add(f)
    if (!have.has(f)) missing.push(f)
  }
}
if (missing.length) fails.push(`cites mais absents du disque : ${missing.join(', ')}`)
const orphans = [...have].filter((f) => !cited.has(f))
if (orphans.length) fails.push(`presents mais non cites : ${orphans.join(', ')}`)

const num = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.'))
if (totalRow && STATEMENT_DEBIT && STATEMENT_CREDIT) {
  const d = num(cell(totalRow, 3))
  const c = num(cell(totalRow, 4))
  if (Math.abs(d - num(STATEMENT_DEBIT)) > 0.005)
    fails.push(`sorties: recap ${d} vs releve ${num(STATEMENT_DEBIT)}`)
  if (Math.abs(c - num(STATEMENT_CREDIT)) > 0.005)
    fails.push(`entrees: recap ${c} vs releve ${num(STATEMENT_CREDIT)}`)
} else {
  fails.push('STATEMENT_DEBIT / STATEMENT_CREDIT non fournis : rapprochement non verifie')
}

for (const p of [EXPORT, DIR, `${DIR}/ventes`, `${DIR}/achats`]) {
  if (existsSync(`${p}/.DS_Store`)) fails.push(`.DS_Store a supprimer dans ${p}`)
}
if (!existsSync(`${EXPORT}/LISEZ-MOI.md`)) fails.push('LISEZ-MOI.md manquant')
const releve = existsSync(`${EXPORT}/releve`) ? readdirSync(`${EXPORT}/releve`) : []
if (!releve.some((f) => f.endsWith('.pdf'))) fails.push('releve/ ne contient aucun PDF')

console.log(`fichiers: ${have.size}   cites: ${cited.size}   lignes recap: ${lines.length - 2}`)
if (!fails.length) {
  console.log('OK : toutes les verifications passent.')
  process.exit(0)
}
console.error('\nECHECS :')
for (const f of fails) console.error(`  - ${f}`)
process.exit(1)
