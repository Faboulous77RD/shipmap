import { consentEnabled } from './consent.ts'

export type FeedbackSender = (text: string) => Promise<void>

export function feedbackEnabled(key: string | undefined): boolean {
  return consentEnabled(key)
}

export async function submitFeedback(
  text: string,
  send: FeedbackSender,
): Promise<'sent' | 'empty'> {
  if (text.trim() === '') return 'empty'
  await send(text)
  return 'sent'
}
