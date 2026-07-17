/**
 * Jest test runner that suppresses DEBUG=* from dotenv.
 * The root .env sets DEBUG=* which floods babel AST traces and OOMs jest.
 * This preloads the env, then clears DEBUG before running jest.
 */
const path = require('path');
require(path.join(__dirname, 'preload-root-env.cjs'));
delete process.env.DEBUG;
process.env.DEBUG = '';
require(path.join(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js'));
