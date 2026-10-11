import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readme = readFileSync('README.md', 'utf8')

function section(heading: string): string | undefined {
  const lines = readme.split('\n')
  const start = lines.indexOf(heading)
  if (start < 0) return undefined
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => l.startsWith('## '))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n')
}

describe('README', () => {
  it('nennt Rechtsvorbehalt mit Name und Jahr', () => {
    const line = readme.split('\n').find((l) => l.includes('Alle Rechte vorbehalten.'))
    expect(line).toBeDefined()
    expect(line).toContain('Fabian Imsiecke')
    expect(line).toMatch(/\b20\d{2}\b/)
  })

  it('hat den Abschnitt Feedback und Beiträge', () => {
    const body = section('## Feedback und Beiträge')
    expect(body).toBeDefined()
    expect(body).toContain('Formular')
    expect(body).toContain('Issues')
    expect(body).toContain('Pull Requests')
  })

  it('enthält keine Lizenzdatei im Wurzelverzeichnis', () => {
    expect(readdirSync('.').filter((f) => /^(license|licence|copying)/i.test(f))).toEqual([])
  })
})
