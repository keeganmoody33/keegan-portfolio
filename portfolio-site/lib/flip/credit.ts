/** Public attribution is a separate, explicit choice from private contact. */
export function validatePublicCredit(input: { creditOptIn?: unknown; publicName?: unknown }):
  | { ok: true; creditOptIn: boolean; publicName: string | null }
  | { ok: false; error: string } {
  if (input.creditOptIn !== true) return { ok: true, creditOptIn: false, publicName: null }
  const name = typeof input.publicName === 'string' ? input.publicName.trim().replace(/\s+/g, ' ') : ''
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
    return { ok: false, error: 'add a public name between 1 and 60 characters, or leave the credit box unchecked.' }
  }
  return { ok: true, creditOptIn: true, publicName: name }
}
