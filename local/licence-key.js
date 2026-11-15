// The public key Cloak uses to check licences. Licences are signed with the
// matching private key, which never leaves the vendor and is never in this
// repository.
//
// THIS IS THE DEVELOPMENT KEY. Its private half was thrown away when it was
// made, so no licence can be issued for a copy built with it: such a copy
// always runs as an evaluation copy. Before building Cloak for sale, put the
// vendor's own public key here:
//
//   node tools/licence.mjs use-key <folder outside the repository>/cloak-licence-public.pem
//
// See docs/licence.md.

export const LICENCE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAodiWCn8QCY4qI0MFZjfF4jDmQezuyXrpfKGAzKCTGh0=
-----END PUBLIC KEY-----
`;
