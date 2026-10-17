import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const skipped = new Set(['package-lock.json'])
const controller = 'info@shipmap.de'
const reservedDomain = /(@(example\.(com|org|net))|\.(invalid|test))$/i

const githubToken = /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/
const privateKey = /-----BEGIN [A-Z ]*PRIVATE KEY-----/
const assignment = /[A-Za-z0-9_-]*(?:SECRET|TOKEN|PASSWORD|API_KEY)[A-Za-z0-9_-]*\s*[=:]\s*["']?([A-Za-z0-9_\-+/=.]{8,})/i
const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g

// Textual check per line; the public PostHog key (phc_) is not a secret pattern.
function findings(file: string, text: string): string[] {
  const found: string[] = []
  text.split('\n').forEach((line, index) => {
    const at = `${file}:${index + 1}`
    if (githubToken.test(line)) found.push(`${at}: GitHub-Token`)
    if (privateKey.test(line)) found.push(`${at}: Privater Schlüssel`)
    const value = assignment.exec(line)?.[1]
    if (value && !value.startsWith('process.')) found.push(`${at}: Geheimnis-Zuweisung`)
    for (const address of line.match(email) ?? []) {
      if (address !== controller && !reservedDomain.test(address)) found.push(`${at}: E-Mail`)
    }
  })
  return found
}

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter((name) => name && !skipped.has(name))
}

describe('secret scan', () => {
  it('finds no keys, tokens or user data in tracked files', () => {
    const found = trackedFiles().flatMap((name) => {
      const content = readFileSync(name)
      if (content.includes(0)) return []
      return findings(name, content.toString('utf8'))
    })
    expect(found).toEqual([])
  })

  it('flags a GitHub token with file and line', () => {
    const text = 'a\nx = ' + 'gh' + 'p_' + 'a'.repeat(36)
    expect(findings('f.ts', text)).toEqual(['f.ts:2: GitHub-Token'])
  })

  it('ignores a short ghp_ prefix', () => {
    expect(findings('f.ts', 'gh' + 'p_' + 'a'.repeat(5))).toEqual([])
  })

  it('flags a private key block', () => {
    const text = '-----' + 'BEGIN RSA PRIV' + 'ATE KEY-----'
    expect(findings('k.pem', text)).toEqual(['k.pem:1: Privater Schlüssel'])
  })

  it('ignores a public key block', () => {
    const text = '-----' + 'BEGIN PUB' + 'LIC KEY-----'
    expect(findings('k.pem', text)).toEqual([])
  })

  it('flags a secret assignment', () => {
    expect(findings('e.env', 'API_' + 'KEY=' + 'abcd1234efgh')).toEqual(['e.env:1: Geheimnis-Zuweisung'])
  })

  it('ignores references and short values in assignments', () => {
    const lines = [
      'API_' + 'KEY=' + '${{ vars.X }}',
      'API_' + 'KEY=' + '<your key>',
      'API_' + 'KEY=' + '{value}',
      'API_' + 'KEY=' + 'process.env.X',
      'TOK' + 'EN=' + 'short',
      'id-token: write',
    ]
    expect(findings('e.env', lines.join('\n'))).toEqual([])
  })

  it('flags an e-mail address', () => {
    expect(findings('d.md', 'Kontakt: ' + 'max' + '@' + 'beispiel.de')).toEqual(['d.md:1: E-Mail'])
  })

  it('ignores the controller and reserved domains', () => {
    const lines = [
      'info' + '@' + 'shipmap.de',
      'a' + '@' + 'example.com',
      'a' + '@' + 'example.org',
      'a' + '@' + 'example.net',
      'a' + '@' + 'host.invalid',
      'a' + '@' + 'host.test',
    ]
    expect(findings('d.md', lines.join('\n'))).toEqual([])
  })

  it('does not treat the public PostHog key as a secret', () => {
    const lines = ['phc_' + 'a'.repeat(30), 'VITE_POSTHOG_KEY: ' + '${{ vars.VITE_POSTHOG_KEY }}']
    expect(findings('c.yml', lines.join('\n'))).toEqual([])
  })
})
