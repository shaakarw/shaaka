import axios from 'axios';
import { BASE_URL } from '../constants';

// Mock data for offline/demo mode
const mockBusinessIdeas = [
  {
    id: 1,
    name: 'Clothing Boutique',
    cost: '$500-1,000',
    profit: '$200-500/month',
    risk: 'Medium',
    time: '2-3 weeks',
    steps: ['Source suppliers', 'Set up shop location', 'Create inventory', 'Market to customers', 'Manage sales'],
  },
  {
    id: 2,
    name: 'Mobile Phone Repair',
    cost: '$1,000-2,000',
    profit: '$300-800/month',
    risk: 'Medium',
    time: '1-2 weeks',
    steps: ['Learn repair skills', 'Get tools and parts', 'Set up workspace', 'Get customer leads', 'Scale operations'],
  },
  {
    id: 3,
    name: 'Online Reselling',
    cost: '$200-500',
    profit: '$100-400/month',
    risk: 'Low',
    time: '3-5 days',
    steps: ['Find reliable suppliers', 'Create online listings', 'Set up payment system', 'Handle shipping', 'Build customer base'],
  },
];

const mockJobOpenings = [
  {
    id: 1,
    title: 'Junior Developer',
    company: 'Tech Startup',
    district: 'Kigali',
    salary: '$300-500/month',
    exp: '1-2 years',
    edu: 'High School or Certificate',
    deadline: '2026-09-30',
    phone: '+250788123456',
    whatsapp: '+250788123456',
    email: 'jobs@techstartup.rw',
    website: 'https://techstartup.rw',
    linkedin: 'https://linkedin.com/company/techstartup',
  },
  {
    id: 2,
    title: 'Sales Representative',
    company: 'Retail Company',
    district: 'Huye',
    salary: '$250-400/month',
    exp: '6 months',
    edu: 'High School',
    deadline: '2026-09-15',
    phone: '+250790654321',
    whatsapp: '+250790654321',
    email: 'hr@retailcorp.rw',
    website: null,
    linkedin: null,
  },
  {
    id: 3,
    title: 'Customer Service Officer',
    company: 'Call Center',
    district: 'Kigali',
    salary: '$200-350/month',
    exp: 'No experience',
    edu: 'Secondary School',
    deadline: '2026-10-05',
    phone: '+250788555666',
    whatsapp: '+250788555666',
    email: 'apply@callcenter.rw',
    website: 'https://callcenter.rw',
    linkedin: null,
  },
];

const mockSkillCourses = [
  {
    id: 1,
    name: 'Web Development with React',
    level: 'Intermediate',
    duration: '8 weeks',
    cert: 'Yes',
    type: 'Paid',
    contactPhone: '+250788111222',
    contactWhatsapp: '+250788111222',
    email: 'info@techacademy.rw',
    website: 'https://techacademy.rw/react',
  },
  {
    id: 2,
    name: 'Digital Marketing Basics',
    level: 'Beginner',
    duration: '4 weeks',
    cert: 'Yes',
    type: 'Free',
    contactPhone: '+250790333444',
    contactWhatsapp: '+250790333444',
    email: 'courses@marketing.rw',
    website: 'https://marketing.rw/basics',
  },
  {
    id: 3,
    name: 'Mobile App Development',
    level: 'Advanced',
    duration: '12 weeks',
    cert: 'Yes',
    type: 'Paid',
    contactPhone: '+250788555777',
    contactWhatsapp: '+250788555777',
    email: 'support@appdev.rw',
    website: 'https://appdev.rw/mobile',
  },
];

/**
 * Fetch all business ideas, jobs, and skill courses
 * Tries to fetch from backend API first, falls back to mock data
 */
export const fetchAllBusinessIdeas = async () => {
  try {
    // Try to fetch from backend API
    const response = await axios.get(`${BASE_URL}/api/business-ideas`, {
      timeout: 5000, // 5 second timeout
    });

    if (response.data?.success) {
      return {
        success: true,
        businessIdeas: response.data.businessIdeas || [],
        jobs: response.data.jobs || [],
        skills: response.data.skills || [],
      };
    }

    // Fallback to mock data if response is invalid
    return {
      success: true,
      businessIdeas: mockBusinessIdeas,
      jobs: mockJobOpenings,
      skills: mockSkillCourses,
    };
  } catch (error) {
    console.warn('API call failed, using mock data:', error?.message || error);
    
    // Return mock data when API is unavailable
    return {
      success: true,
      businessIdeas: mockBusinessIdeas,
      jobs: mockJobOpenings,
      skills: mockSkillCourses,
    };
  }
};

/**
 * Fetch only business ideas
 */
export const fetchBusinessIdeas = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/business-ideas/ideas`, {
      timeout: 5000,
    });

    return response.data?.businessIdeas || mockBusinessIdeas;
  } catch (error) {
    console.warn('Business ideas fetch failed:', error?.message || error);
    return mockBusinessIdeas;
  }
};

/**
 * Fetch only job openings
 */
export const fetchJobOpenings = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/business-ideas/jobs`, {
      timeout: 5000,
    });

    return response.data?.jobs || mockJobOpenings;
  } catch (error) {
    console.warn('Job openings fetch failed:', error?.message || error);
    return mockJobOpenings;
  }
};

/**
 * Fetch only skill courses
 */
export const fetchSkillCourses = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/business-ideas/skills`, {
      timeout: 5000,
    });

    return response.data?.skills || mockSkillCourses;
  } catch (error) {
    console.warn('Skill courses fetch failed:', error?.message || error);
    return mockSkillCourses;
  }
};
