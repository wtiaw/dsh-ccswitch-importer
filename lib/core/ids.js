import { createHash } from 'node:crypto'

function shortHash(input, length) {
  return createHash('sha256').update(input).digest('hex').slice(0, length)
}

function slugify(name) {
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'provider'
}

export function providerKey(profileId, profileName) {
  const slug = slugify(profileName)
  const hash = shortHash(`${profileId}::${profileName}`, 8)
  return `ccs-${slug}-${hash}`
}

export function credentialRefFor(providerKeyValue) {
  // provider key tail after the last dash is the 8-hex hash.
  const hash = providerKeyValue.split('-').pop()
  if (!/^[a-f0-9]{8}$/.test(hash)) {
    throw new Error(`credentialRefFor: expected an 8-hex hash tail, got "${hash}"`)
  }
  return `DSH_CCSWITCH_${hash.toUpperCase()}_API_KEY`
}

export function credentialRef(profileId, profileName) {
  return credentialRefFor(providerKey(profileId, profileName))
}

export function variantKey(baseKey, index) {
  return `${baseKey}-${shortHash(`${baseKey}::${index}`, 4)}`
}
