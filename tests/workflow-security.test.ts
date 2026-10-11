import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = '.github/workflows'

// Textual check without a YAML parser; comment lines are ignored.
function violations(file: string, text: string): string[] {
  const body = text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
  const found: string[] = []
  if (/\bpull_request_target\b/.test(body)) found.push(`${file}: pull_request_target`)
  const listensOnPullRequest = /(^|[\s[,])pull_request(?=\s*(:|,|\]|$))/m.test(body)
  if (listensOnPullRequest && (/\bsecrets\s*:\s*inherit\b/.test(body) || /\bsecrets\.[A-Za-z_]/.test(body))) {
    found.push(`${file}: secrets in pull_request workflow`)
  }
  return found
}

describe('workflow security', () => {
  it('has no pull_request_target and no secrets in pull_request workflows', () => {
    const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name))
    const found = files.flatMap((name) => violations(name, readFileSync(`${dir}/${name}`, 'utf8')))
    expect(found).toEqual([])
  })

  it('flags pull_request_target', () => {
    const text = 'on:\n  pull_request_target:\njobs:\n  a:\n    runs-on: ubuntu-latest\n'
    expect(violations('bad.yml', text)).toEqual(['bad.yml: pull_request_target'])
  })

  it('flags secrets: inherit in a pull_request workflow', () => {
    const text = 'on:\n  pull_request:\njobs:\n  a:\n    uses: ./.github/workflows/x.yml\n    secrets: inherit\n'
    expect(violations('bad.yml', text)).toEqual(['bad.yml: secrets in pull_request workflow'])
  })

  it('flags secrets.<NAME> in a pull_request workflow', () => {
    const text = 'on: [push, pull_request]\njobs:\n  a:\n    steps:\n      - run: echo ${{ secrets.TOKEN }}\n'
    expect(violations('bad.yml', text)).toEqual(['bad.yml: secrets in pull_request workflow'])
  })

  it('accepts vars in a pull_request workflow and ignores comment lines', () => {
    const text = 'on:\n  pull_request:\n# secrets.TOKEN\njobs:\n  a:\n    steps:\n      - run: echo ${{ vars.KEY }}\n'
    expect(violations('ok.yml', text)).toEqual([])
  })

  it('accepts secrets in a push-only workflow', () => {
    const text = 'on:\n  push:\njobs:\n  a:\n    steps:\n      - run: echo ${{ secrets.TOKEN }}\n'
    expect(violations('ok.yml', text)).toEqual([])
  })
})
