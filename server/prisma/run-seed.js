// Wrapper so Windows shells don't mangle ts-node quotes in package.json seed command
require('ts-node').register({ transpileOnly: true });
require('./seed.ts');
