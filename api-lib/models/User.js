import mongoose from 'mongoose';

// Default job types seeded for new accounts (schema default) and backfilled
// once for pre-existing accounts that never received them.
// IMPORTANT: Keep in sync with server/models/User.js and src/utils/constants.js (DEFAULT_JOB_TYPES_MAP).
export const DEFAULT_JOB_TYPES = {
  jt1: 'Software Development',
  jt2: 'Management',
  jt3: 'Technical Skills',
  jt4: 'Design',
  jt5: 'Product Management',
  jt6: 'Data Science',
  jt7: 'Marketing',
  jt8: 'Sales',
  jt9: 'Operations',
  jt10: 'Research',
};

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Job types dictionary: { "jt1": "Software Development", "jt2": "Management", ... }
    // New users get these defaults on insert; deleting all job types stays deleted.
    jobTypes: { type: Map, of: String, default: DEFAULT_JOB_TYPES },
    // Set to true once an account has received its default job types, so the
    // one-time backfill never re-runs (including after the user deletes them all).
    jobTypesInitialized: { type: Boolean, default: false },
    // Saved personal details used to prefill new resumes ("Save as Default" in
    // the builder, editable from the Dashboard account modal). Empty until set.
    defaultPersonalInfo: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
    },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
