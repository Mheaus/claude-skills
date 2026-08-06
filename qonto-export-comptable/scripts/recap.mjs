// Build the accountant recap for one month.
// Run this after split.mjs. Safe to run twice.
//
// Output: $EXPORT/recap-$MONTH.csv, semicolon separated, UTF-8 BOM for Excel FR.
// One line per statement operation, plus a TOTAUX line.
//
// Env: MONTH (YYYY-MM), WORK, EXPORT.
// Optional $WORK/overrides.json -> { "categories": { "<txId>": "Produit financier" } }

import { readFileSync, existsSync, writeFileSync } from 'node:fs'

const { MONTH, WORK, EXPORT } = process.env
if (!MONTH || !WORK || !EXPORT) throw new Error('MONTH, WORK and EXPORT are required')

const overrides = existsSync(`${WORK}/overrides.json`)
  ? JSON.parse(readFileSync(`${WORK}/overrides.json`, 'utf8'))
  : {}
const CATEGORIE_TX = overrides.categories ?? {}

const tx = JSON.parse(readFileSync(`${WORK}/tx.json`, 'utf8'))

const tsv = (p) =>
  existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')) : []

const downloaded = new Map()
for (const [id, name] of tsv(`${WORK}/downloaded.tsv`)) {
  if (!downloaded.has(id)) downloaded.set(id, [])
  downloaded.get(id).push(name)
}

const supp = new Map()
for (const [id, name, , comment] of tsv(`${WORK}/supplements.tsv`)) {
  if (!supp.has(id)) supp.set(id, { files: [], comments: [] })
  supp.get(id).files.push(name)
  if (comment) supp.get(id).comments.push(comment)
}

const status = new Map(tsv(`${WORK}/statuses.tsv`).map(([id, s, c]) => [id, [s, c]]))

const fr = (n) => (n === null || n === undefined ? '' : n.toFixed(2).replace('.', ','))
const day = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`

const rows = []
let nOk = 0
let nMissing = 0

for (const t of tx) {
  const files = [...(downloaded.get(t.id) ?? []), ...(supp.get(t.id)?.files ?? [])]
  const [manualStatus, manualComment] = status.get(t.id) ?? []
  const comments = [...(supp.get(t.id)?.comments ?? [])]
  if (manualComment) comments.push(manualComment)

  const statut = manualStatus ?? (files.length ? 'OK' : 'MANQUANT')
  if (statut === 'OK') nOk++
  else if (statut !== 'RELEVE') nMissing++

  const cats = [...new Set(files.map((f) => f.split('/')[0]))]
  const categorie =
    CATEGORIE_TX[t.id] ??
    (cats.length
      ? cats.map((c) => (c === 'ventes' ? 'Vente' : 'Achat')).join(' + ')
      : t.side === 'credit'
        ? 'Vente'
        : 'Achat')

  rows.push([
    day(t.settled_at),
    day(t.emitted_at),
    t.side === 'debit' ? 'Débit' : 'Crédit',
    t.side === 'debit' ? fr(t.amount) : '',
    t.side === 'credit' ? fr(t.amount) : '',
    categorie,
    t.counterparty,
    t.label,
    t.operation_type,
    files.join(' | '),
    statut,
    comments.join(' ; '),
  ])
}

const header = [
  'Date de valeur',
  "Date d'opération",
  'Sens',
  'Débit EUR',
  'Crédit EUR',
  'Catégorie',
  'Contrepartie',
  'Libellé Qonto',
  'Type',
  'Justificatif (fichier)',
  'Statut',
  'Commentaire',
]

const credits = tx.filter((t) => t.side === 'credit').reduce((a, t) => a + t.amount, 0)
const debits = tx.filter((t) => t.side === 'debit').reduce((a, t) => a + t.amount, 0)

const csv = [
  header,
  ...rows,
  [],
  ['TOTAUX', '', '', fr(debits), fr(credits), '', `${tx.length} opérations`, '', '', '', '', ''],
]
  .map((r) => r.map(q).join(';'))
  .join('\r\n')

writeFileSync(`${EXPORT}/recap-${MONTH}.csv`, '﻿' + csv + '\r\n', 'utf8')

const pieces = (prefix) =>
  new Set(rows.flatMap((r) => r[9].split(' | ')).filter((f) => f.startsWith(prefix))).size

console.log(`lignes: ${rows.length}`)
console.log(
  `justifies: ${nOk}   releve seul: ${rows.filter((r) => r[10] === 'RELEVE').length}   restants: ${nMissing}`,
)
console.log(`debits: ${fr(debits)}   credits: ${fr(credits)}`)
console.log(`pieces ventes: ${pieces('ventes/')}   pieces achats: ${pieces('achats/')}`)
