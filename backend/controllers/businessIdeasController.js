const BusinessIdea = require('../models/BusinessIdea');
const { normalizeRwandaPhone, isValidRwandaPhone } = require('../utils/phoneNormalizer');

// ================= PUBLIC =================

// GET /api/business-ideas/business-ideas
exports.getBusinessIdeas = async (req, res) => {
  try {
    const items = await BusinessIdea.find({
      category: { $nin: ['job', 'skill'] },
      published: { $ne: false },
    }).sort({ createdAt: -1 });
    res.json({ success: true, businessIdeas: items });
  } catch (err) {
    console.error('Get business ideas error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/business-ideas/job-openings
exports.getJobOpenings = async (req, res) => {
  try {
    const items = await BusinessIdea.find({ category: 'job' }).sort({ createdAt: -1 });
    res.json({ success: true, jobs: items });
  } catch (err) {
    console.error('Get job openings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/business-ideas/skill-courses
exports.getSkillCourses = async (req, res) => {
  try {
    const items = await BusinessIdea.find({ category: 'skill' }).sort({ createdAt: -1 });
    res.json({ success: true, skills: items });
  } catch (err) {
    console.error('Get skill courses error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/business-ideas/all
exports.getAllBusinessIdeas = async (req, res) => {
  try {
    const [businessIdeas, jobs, skills] = await Promise.all([
      BusinessIdea.find({ category: { $nin: ['job', 'skill'] }, published: { $ne: false } }).sort({ createdAt: -1 }),
      BusinessIdea.find({ category: 'job' }).sort({ createdAt: -1 }),
      BusinessIdea.find({ category: 'skill' }).sort({ createdAt: -1 }),
    ]);
    res.json({ success: true, businessIdeas, jobs, skills });
  } catch (err) {
    console.error('Get all business ideas error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ================= ADMIN CRUD =================

exports.createItem = async (req, res) => {
  try {
    const { type } = req.params; // 'jobs', 'skills', or 'business-ideas'
    let category = '';
    let payload = {};

    if (type === 'jobs') {
      const phone = req.body.phone || '';
      const whatsapp = req.body.whatsapp || '';
      if (phone && !isValidRwandaPhone(phone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid Rwanda phone number (e.g. 0781234567)' });
      }
      if (whatsapp && !isValidRwandaPhone(whatsapp)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid WhatsApp number or leave it empty' });
      }
      category = 'job';
      payload = {
        name: req.body.title,
        title: req.body.title,
        company: req.body.company,
        district: req.body.district,
        salary: req.body.salary,
        exp: req.body.exp,
        edu: req.body.edu,
        deadline: req.body.deadline,
        phone: req.body.phone ? normalizeRwandaPhone(req.body.phone) : '',
        whatsapp: req.body.whatsapp ? normalizeRwandaPhone(req.body.whatsapp) : '',
        email: req.body.email,
        website: req.body.website,
        linkedin: req.body.linkedin,
        category,
        createdBy: req.user.id,
      };
    } else if (type === 'skills') {
      const contactPhone = req.body.contactPhone || '';
      const contactWhatsapp = req.body.contactWhatsapp || '';
      if (contactPhone && !isValidRwandaPhone(contactPhone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid Rwanda phone number (e.g. 0781234567)' });
      }
      if (contactWhatsapp && !isValidRwandaPhone(contactWhatsapp)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid WhatsApp number or leave it empty' });
      }
      category = 'skill';
      payload = {
        name: req.body.name,
        level: req.body.level,
        duration: req.body.duration,
        cert: req.body.cert,
        type: req.body.type,
        contactPhone: req.body.contactPhone ? normalizeRwandaPhone(req.body.contactPhone) : '',
        contactWhatsapp: req.body.contactWhatsapp ? normalizeRwandaPhone(req.body.contactWhatsapp) : '',
        email: req.body.email,
        website: req.body.website,
        category,
        createdBy: req.user.id,
      };
    } else if (type === 'business-ideas') {
      payload = {
        name: req.body.name,
        category: 'business',
        businessCategory: req.body.businessCategory !== undefined
          ? req.body.businessCategory
          : req.body.category === 'business' ? '' : req.body.category || '',
        description: req.body.description || '',
        fullDescription: req.body.fullDescription || '',
        cost: req.body.cost,
        profit: req.body.profit,
        risk: req.body.risk,
        time: req.body.time,
        steps: req.body.steps || [],
        targetAudience: req.body.targetAudience || '',
        requiredSkills: req.body.requiredSkills || [],
        equipment: req.body.equipment || [],
        potentialCustomers: req.body.potentialCustomers || [],
        marketingStrategy: req.body.marketingStrategy || '',
        challenges: req.body.challenges || [],
        location: req.body.location || '',
        additionalInfo: req.body.additionalInfo || '',
        createdBy: req.user.id,
      };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    const newItem = new BusinessIdea(payload);
    await newItem.save();
    res.status(201).json({ success: true, item: newItem });
  } catch (err) {
    console.error('Admin createItem error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { type, id } = req.params;
    let updateFields = {};

    if (type === 'jobs') {
      updateFields = {
        name: req.body.title,
        title: req.body.title,
        company: req.body.company,
        district: req.body.district,
        salary: req.body.salary,
        exp: req.body.exp,
        edu: req.body.edu,
        deadline: req.body.deadline,
        phone: req.body.phone,
        whatsapp: req.body.whatsapp,
        email: req.body.email,
        website: req.body.website,
        linkedin: req.body.linkedin,
      };
    } else if (type === 'skills') {
      updateFields = {
        name: req.body.name,
        level: req.body.level,
        duration: req.body.duration,
        cert: req.body.cert,
        type: req.body.type,
        contactPhone: req.body.contactPhone,
        contactWhatsapp: req.body.contactWhatsapp,
        email: req.body.email,
        website: req.body.website,
      };
    } else if (type === 'business-ideas') {
      updateFields = {
        name: req.body.name,
        category: 'business',
        businessCategory: req.body.businessCategory !== undefined
          ? req.body.businessCategory
          : req.body.category === 'business' ? '' : req.body.category || '',
        description: req.body.description,
        fullDescription: req.body.fullDescription,
        cost: req.body.cost,
        profit: req.body.profit,
        risk: req.body.risk,
        time: req.body.time,
        steps: req.body.steps,
        targetAudience: req.body.targetAudience,
        requiredSkills: req.body.requiredSkills,
        equipment: req.body.equipment,
        potentialCustomers: req.body.potentialCustomers,
        marketingStrategy: req.body.marketingStrategy,
        challenges: req.body.challenges,
        location: req.body.location,
        additionalInfo: req.body.additionalInfo,
      };
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    const updatedItem = await BusinessIdea.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, item: updatedItem });
  } catch (err) {
    console.error('Admin updateItem error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedItem = await BusinessIdea.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    console.error('Admin deleteItem error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};