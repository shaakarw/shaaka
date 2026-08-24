// models/BusinessIdea.js
const mongoose = require('mongoose');

const BusinessIdeaSchema = new mongoose.Schema(
  {
    // ---- Common fields ----
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 800,
    },

    // ---- Business idea specific ----
    cost: {
      type: String,
      default: '',
      trim: true,
    },
    profit: {
      type: String,
      default: '',
      trim: true,
    },
    risk: {
      type: String,
      default: '',
      trim: true,
    },
    time: {
      type: String,
      default: '',
      trim: true,
    },
    steps: {
      type: [String],
      default: [],
    },

    // ---- Job specific ----
    title: {
      type: String,
      default: '',
      trim: true,
    },
    company: {
      type: String,
      default: '',
      trim: true,
    },
    district: {
      type: String,
      default: '',
      trim: true,
    },
    salary: {
      type: String,
      default: '',
      trim: true,
    },
    exp: {
      type: String,
      default: '',
      trim: true,
    },
    edu: {
      type: String,
      default: '',
      trim: true,
    },
    deadline: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    whatsapp: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    website: {
      type: String,
      default: '',
      trim: true,
    },
    linkedin: {
      type: String,
      default: '',
      trim: true,
    },

    // ---- Skill specific ----
    level: {
      type: String,
      default: '',
      trim: true,
    },
    duration: {
      type: String,
      default: '',
      trim: true,
    },
    cert: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      default: '',
      trim: true,
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true,
    },
    contactWhatsapp: {
      type: String,
      default: '',
      trim: true,
    },

    // ---- Creator ----
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BusinessIdea', BusinessIdeaSchema);