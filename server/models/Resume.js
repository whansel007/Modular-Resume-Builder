import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true, index: true },
    title: { type: String, default: 'My Resume' },
    templateId: { type: String, default: 'modern' },
    personalInfo: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
    },
    sectionOrder: { type: [String], default: [] },
    // sections is a free-form object: { "Summary": ["b1"], "Experience": ["b2", "b3"] }
    sections: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model('Resume', resumeSchema);
