import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true, index: true },
    title: { type: String, default: 'My Resume' },
    templateId: { type: String, default: 'classic' },
    personalInfo: { type: mongoose.Schema.Types.Mixed, default: () => ({ name: '', fields: [] }) },
    sectionOrder: { type: [String], default: [] },
    // sections is a free-form object: { "Summary": ["b1"], "Experience": ["b2", "b3"] }
    sections: { type: mongoose.Schema.Types.Mixed, default: {} },
    hiddenSections: { type: [String], default: [] },
    showLocations: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('Resume', resumeSchema);
