import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['summary', 'experience', 'education', 'skills'] },
    // References to user's jobTypes dictionary by ID
    jobTypeIds: { type: [String], default: [] },
    // All content fields are stored flat at the top level via Mixed
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model('Block', blockSchema);
