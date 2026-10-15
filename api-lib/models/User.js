import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Tags dictionary: { "jt1": "Software Development", "jt2": "Management", ... }
    // New accounts start with no tags; the user adds them from the dashboard.
    tags: { type: Map, of: String, default: () => new Map() },
    // Marks whether an account was ever initialized. True by default so a
    // brand-new account (empty dictionary) is never backfilled with defaults.
    tagsInitialized: { type: Boolean, default: true },
    // Saved personal details used to prefill new resumes ("Save as Default" in
    // the builder, editable from the Dashboard account modal). Empty until set.
    defaultPersonalInfo: { type: mongoose.Schema.Types.Mixed, default: () => ({ name: '', fields: [] }) },
    resetCodeHash: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
    resetCodeAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
