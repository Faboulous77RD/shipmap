import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const viteConfig = readFileSync('vite.config.ts', 'utf8')

// Text of the top-level job `name`, up to the next top-level job or the end.
function job(name: string): string {
  const match = workflow.match(new RegExp(`^  ${name}:\\n((?:(?!  \\S).*\\n?)*)`, 'm'))
  expect(match, `job ${name} exists`).not.toBeNull()
  return match![1]
}

describe('ci workflow', () => {
  it('runs the dist e2e step after test:e2e and before build and upload in job build', () => {
    const build = job('build')
    const order = [
      'run: npm run test:e2e\n',
      'run: npm run test:e2e:dist\n',
      'run: npm run build\n',
      'uses: actions/upload-pages-artifact',
    ].map((needle) => build.indexOf(needle))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('triggers on push to main', () => {
    expect(workflow).toMatch(/^on:\n  push:\n    branches: \[main\]/m)
  })

  it('publishes only on push to main with pages and id-token permissions', () => {
    const deploy = job('deploy')
    expect(deploy).toContain('uses: actions/deploy-pages')
    expect(deploy).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/main'")
    expect(deploy).toMatch(/permissions:\n\s+pages: write\n\s+id-token: write/)
  })

  it('uploads dist as the pages artifact', () => {
    expect(job('build')).toMatch(/upload-pages-artifact@v\d+\n\s+with:\n\s+path: dist/)
  })
})

describe('vite config', () => {
  it('sets base to the repo name', () => {
    expect(viteConfig).toMatch(/base:\s*'\/shipmap\/'/)
  })
})
