import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifyEmailPath, isEmailVerified, requiresVerifiedEmailPath, safeNextPath } from '@/lib/auth';
import { createEmptyPhoneValue, formatPhoneValue, phoneValueFromStored, validatePhoneValue } from '@/lib/phone';

test('safeNextPath keeps only internal paths', () => {
  assert.equal(safeNextPath('/messages', '/dashboard'), '/messages');
  assert.equal(safeNextPath('https://evil.example.com', '/dashboard'), '/dashboard');
  assert.equal(safeNextPath('//evil.example.com', '/dashboard'), '/dashboard');
});

test('requiresVerifiedEmailPath only protects sensitive routes', () => {
  assert.equal(requiresVerifiedEmailPath('/messages'), true);
  assert.equal(requiresVerifiedEmailPath('/messages/abc'), true);
  assert.equal(requiresVerifiedEmailPath('/missions/new'), true);
  assert.equal(requiresVerifiedEmailPath('/profile'), true);
  assert.equal(requiresVerifiedEmailPath('/dashboard'), true);
  assert.equal(requiresVerifiedEmailPath('/skippers'), false);
});

test('buildVerifyEmailPath preserves email and internal next path', () => {
  assert.equal(buildVerifyEmailPath('hello@example.com', '/messages'), '/verify-email?email=hello%40example.com&next=%2Fmessages');
});

test('isEmailVerified reads email confirmation state', () => {
  assert.equal(isEmailVerified({ email_confirmed_at: '2026-09-07T00:00:00.000Z' }), true);
  assert.equal(isEmailVerified({ email_confirmed_at: null }), false);
});

test('phone helpers keep france default and validate per country', () => {
  const empty = createEmptyPhoneValue();
  assert.equal(empty.country, 'FR');

  const french = formatPhoneValue('0612345678', 'FR');
  assert.equal(french.isValid, true);
  assert.equal(french.e164, '+33612345678');

  const invalidUs = formatPhoneValue('0612345678', 'US');
  assert.equal(validatePhoneValue(invalidUs, true).length > 0, true);

  const parsed = phoneValueFromStored('+33612345678');
  assert.equal(parsed.country, 'FR');
  assert.equal(parsed.isValid, true);
});