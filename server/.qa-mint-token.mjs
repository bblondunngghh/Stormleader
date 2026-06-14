import * as authService from './src/services/authService.js';
const r = await authService.login('waterlooconstruction1@gmail.com','2Wealth&health','waterloo');
process.stdout.write(JSON.stringify({ token: r.accessToken, refreshToken: r.refreshToken, user: r.user }));
process.exit(0);
