export const PRIVACY_TITLE = 'Datenschutzhinweis'

export const PRIVACY_ITEMS: ReadonlyArray<{ label: string; text: string }> = [
  {
    label: 'Verantwortlicher',
    text: 'Fabian Imsiecke, info@shipmap.de',
  },
  {
    label: 'Lokale Daten',
    text: 'Produkte und Listen liegen nur im Browser dieses Geräts (localStorage). Sie werden nicht übertragen und nicht gesichert; wer die Browserdaten löscht oder den Browser wechselt, verliert sie. Ebenfalls dort liegen die Wahl zur Einwilligung und, nach einer Einwilligung, ein Eintrag von PostHog mit dieser Wahl; Cookies setzt Shipmap nicht.',
  },
  {
    label: 'Empfänger',
    text: 'Nutzungsereignisse gehen nur nach deiner Einwilligung an PostHog (Serverstandort EU, eu.i.posthog.com).',
  },
  {
    label: 'Zweck',
    text: 'Zu prüfen, ob und wie Shipmap genutzt wird. Gesendet werden nur die Ereignisse Seite geöffnet, Produkt angelegt, Feature angelegt und Status geändert, ohne Namen, Titel oder Notizen.',
  },
  {
    label: 'Feedback',
    text: 'Was über „Feedback“ abgeschickt wird, geht als Text an PostHog (Serverstandort EU), auch ohne Einwilligung zur Nutzungsmessung; das Absenden ist die Einwilligung für diese Übertragung. Zweck: Hinweise zur Verbesserung von Shipmap. Speicherdauer wie bei den Ereignissen.',
  },
  {
    label: 'Speicherdauer',
    text: 'Ereignisse werden bei PostHog 12 Monate gespeichert und danach gelöscht.',
  },
  {
    label: 'Widerruf',
    text: 'Ohne Einwilligung wird nichts gesendet. Eine erteilte Einwilligung widerrufst du jederzeit unter „Einwilligung ändern“.',
  },
]
