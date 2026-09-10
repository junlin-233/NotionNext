#!/usr/bin/env node

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const sourceExtensions = new Set([
  '.css',
  '.js',
  '.jsx',
  '.json',
  '.ts',
  '.tsx'
])

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .map(file => file.trim())
    .filter(Boolean)
}

function getChangedFiles() {
  const tracked = runGit([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    '--',
    '.'
  ])
  const untracked = runGit([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    '.'
  ])

  return [...new Set([...tracked, ...untracked])]
    .filter(file => sourceExtensions.has(path.extname(file)))
    .filter(file => fs.existsSync(file))
    .filter(file => !file.startsWith('node_modules/'))
    .filter(file => !file.startsWith('.next/'))
    .filter(
      file => !['quality-report.json', 'validation-report.json'].includes(file)
    )
    .sort()
}

const files = getChangedFiles()
const mode = process.argv.includes('--write') ? '--write' : '--check'

if (files.length === 0) {
  console.log('[format] No changed source files to check.')
  process.exit(0)
}

const prettierCli = require.resolve('prettier/bin/prettier.cjs')
execFileSync(process.execPath, [prettierCli, mode, ...files], {
  stdio: 'inherit'
})
