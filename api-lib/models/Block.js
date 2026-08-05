import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['summary', 'experience', 'education', 'skills'] },
    // References to user's jobTypes dictionary by ID
    jobTypeIds: { type: [String], default: [] },
    // Resume-scoped variant: set when the block was saved as a variant of
    // another block for one specific resume. Variants never appear in the
    // block library and are cascade-deleted with their resume.
    resumeId: { type: String, default: null },
    variantOf: { type: String, default: null },
    // All content fields are stored flat at the top level via Mixed
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.models.Block || mongoose.model('Block', blockSchema);
