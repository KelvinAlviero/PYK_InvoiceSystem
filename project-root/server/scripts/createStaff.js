// Creates a staff account from the command line. This is how the very first admin
// gets made; after that, admins can create staff through POST /api/users.
//
//   npm run create-staff -- admin@pyk.example admin
//
// The password is read from STAFF_PASSWORD, or asked for interactively.
import readline from 'node:readline/promises';
import { pool } from '../db.js';
import { STAFF_ROLES } from '../lib/auth.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../lib/passwords.js';

const [email, role = 'admin'] = process.argv.slice(2);

if (!email || !STAFF_ROLES.includes(role)) {
    console.error(`Usage: npm run create-staff -- <email> <${STAFF_ROLES.join('|')}>`);
    process.exit(1);
}

let password = process.env.STAFF_PASSWORD;
if (!password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question(`Password for ${email}: `);
    rl.close();
}

if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
}

try {
    await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        [email.trim(), await hashPassword(password), role]
    );
    console.log(`Created ${role} account ${email}.`);
} catch (error) {
    console.error(error.code === '23505' ? 'An account with this email already exists.' : error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
