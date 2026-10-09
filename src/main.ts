import './style.css'
import { appName } from './app.ts'

// Placeholder until the first feature is implemented through the loop.
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <h1>${appName()}</h1>
  </main>
`
