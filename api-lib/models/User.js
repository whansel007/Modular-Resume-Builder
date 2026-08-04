import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Job types dictionary: { "jt1": "Software Development", "jt2": "Management", ... }
    jobTypes: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
