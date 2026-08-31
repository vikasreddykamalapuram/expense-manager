/**
 * Turn a parsed utterance into the `/add` deep link that prefills the form.
 *
 * Kept separate from the UI so the mapping is unit-testable, and separate from
 * `shareParser.buildAddDeepLink` so extending voice can never alter the
 * behaviour of the OS share-target, which is a different contract.
 */

import type { ParsedVoiceTransaction } from '../../shared/services/voiceParser';

export function buildVoiceDeepLink(parsed: ParsedVoiceTransaction): string {
  const params = new URLSearchParams();
  params.set('type', parsed.type);
  if (parsed.amount != null) params.set('amount', String(parsed.amount));
  if (parsed.notes) params.set('note', parsed.notes);
  if (parsed.date) params.set('date', parsed.date);
  if (parsed.paymentMethod) params.set('method', parsed.paymentMethod);
  if (parsed.categoryId) params.set('category', parsed.categoryId);
  if (parsed.accountId) params.set('account', parsed.accountId);
  if (parsed.toAccountId) params.set('toAccount', parsed.toAccountId);
  if (parsed.suggestedAccountName) params.set('newAccount', parsed.suggestedAccountName);
  if (parsed.suggestedCategoryName) params.set('newCategory', parsed.suggestedCategoryName);
  return `/add?${params.toString()}`;
}
