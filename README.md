# Shipmap

Shipmap ist eine kleine Web-Anwendung für Menschen, die mit KI-Werkzeugen eigene Software bauen.
Je Produkt gibt es eine Liste von Features mit Status (Idee, geplant, in Arbeit, ausgeliefert) und
einfacher Priorität. Daten liegen in der ersten Fassung im `localStorage` des Browsers.

## Befehle

```bash
npm ci              # Abhängigkeiten
npm run dev         # Entwicklungsserver
npm test            # Logik-Tests (Vitest)
npm run build       # Typprüfung und Build nach dist/
npm run preview     # Build lokal ansehen
```

## Planung

Strategie, Flussregeln, Wissensbasis, Epics, Tasks und Gates liegen im Repo `shipmap-loop`.
Dieses Repo enthält nur Produktcode, Tests und CI. Pull Requests nennen die Task-ID aus dem Loop-Repo.

## Dokumente

- [Datenschutzhinweis (Entwurf)](docs/datenschutz.md)
