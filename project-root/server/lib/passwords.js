import crypto from 'node:crypto';
import { promisify } from 'node:util';

// scrypt is built into Node, so there is no native module to compile on Railway.
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
const scrypt = promisify(crypto.scrypt);
const N = 16384;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, KEY_LENGTH, { N, r, p });
    return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
    const parts = String(stored).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
        return false;
    }

    const [, n, rr, pp, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
        N: Number(n), r: Number(rr), p: Number(pp)
    });

    return crypto.timingSafeEqual(actual, expected);
}

// Used when the email does not exist, so a wrong email takes as long as a wrong
// password and nobody can probe which emails are registered.
let dummyHash;
export async function burnPasswordCheck(password) {
    dummyHash ??= await hashPassword('dummy-password-for-timing');
    await verifyPassword(password, dummyHash);
}
