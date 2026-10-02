// Create a staff login for Cloak.
//
//   npm run add-user            (asks for a user name and password)
//   npm run add-user -- jane    (asks for jane's password)
//
// Prints a line to add to the CLOAK_USERS setting on the server. The password
// itself is never stored, only a salted scrypt hash of it.

import readline from 'node:readline';
import crypto from 'node:crypto';
import { hashPassword } from '../server/auth.js';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the question, then stop echoing what is typed.
      rl._writeToOutput = (s) => { if (!rl.muted) rl.output.write(s); };
      rl.output.write(question);
      rl.muted = true;
      rl.question('', (answer) => { rl.output.write('\n'); rl.close(); resolve(answer); });
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

const name = (process.argv[2] || await ask('User name (e.g. jane or nkearney): ')).trim().toLowerCase();
if (!/^[a-z0-9._-]{1,40}$/.test(name)) {
  console.error('User names can use letters, numbers, dots, dashes and underscores only.');
  process.exit(1);
}
const password = await ask(`Password for ${name} (at least 12 characters): `, { hidden: true });
if (password.length < 12) {
  console.error('Please use a password of at least 12 characters.');
  process.exit(1);
}
const again = await ask('Type it again: ', { hidden: true });
if (again !== password) {
  console.error('The passwords did not match.');
  process.exit(1);
}

console.log(`
Add this to the CLOAK_USERS setting on the server (separate several people with commas):

${name}:${hashPassword(password)}

If you have not set CLOAK_SECRET yet, you can use this random value:

${crypto.randomBytes(32).toString('hex')}
`);
