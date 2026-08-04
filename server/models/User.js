import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Job types dictionary: { "jt1": "Software Development", "jt2": "Management", ... }
    // New users get these defaults on insert; deleting all job types stays deleted.
    jobTypes: {
      type: Map,
      of: String,
      default: {
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
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
