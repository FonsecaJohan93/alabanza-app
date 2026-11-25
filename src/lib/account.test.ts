import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanEmail, maskEmail } from './account.ts'

test('correo válido, en minúsculas', () => {
  assert.equal(cleanEmail('  Ana.Bateria@Gmail.COM '), 'ana.bateria@gmail.com')
  assert.equal(cleanEmail('ana@gmail'), null)
  assert.equal(cleanEmail('ana gmail.com'), null)
  assert.equal(cleanEmail(''), null)
  assert.equal(cleanEmail(42), null)
})

test('correo enmascarado', () => {
  assert.equal(maskEmail('johan@gmail.com'), 'jo•••@gmail.com')
  assert.equal(maskEmail('a@x.co'), 'a•••@x.co')
})
