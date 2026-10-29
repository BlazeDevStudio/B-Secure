/* Browser-native PBKDF2. No third-party dependencies, remote calls, or plaintext storage. */
const LockCrypto = (() => {
  const iterations = 160000;
  const to64 = bytes => btoa(String.fromCharCode(...bytes));
  const from64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
  async function derive(password, salt, rounds) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt, iterations:rounds, hash:'SHA-256'}, key, 256);
    return new Uint8Array(bits);
  }
  async function create(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, iterations);
    return {v:2, algo:'PBKDF2-SHA256', iterations, salt:to64(salt), hash:to64(hash)};
  }
  async function verify(password, record) {
    if (!record || record.v !== 2 || record.algo !== 'PBKDF2-SHA256' || !Number.isSafeInteger(record.iterations) || record.iterations < 10000 || record.iterations > 2000000) return false;
    try {
      const salt = from64(record.salt), expected = from64(record.hash);
      if (salt.length !== 16 || expected.length !== 32) return false;
      const received = await derive(password, salt, record.iterations);
      let difference = 0;
      for (let i = 0; i < expected.length; i++) difference |= received[i] ^ expected[i];
      return difference === 0;
    } catch (_) { return false; }
  }
  return Object.freeze({create, verify});
})();
