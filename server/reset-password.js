// One-off: reset kit@catship.nya password. Value passed via env, never printed.
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from './models/User.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const EMAIL = process.env.RESET_EMAIL;
const NEW_PASSWORD = process.env.RESET_PASSWORD;
if (!EMAIL || !NEW_PASSWORD) {
  console.error('RESET_EMAIL / RESET_PASSWORD env vars required');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const user = await User.findOne({ email: EMAIL.toLowerCase() });
if (!user) {
  console.error(`User "${EMAIL}" not found`);
  await mongoose.disconnect();
  process.exit(1);
}
user.passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
await user.save();
await mongoose.disconnect();
console.log(`Password reset for "${EMAIL}" — done`);
