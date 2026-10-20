import axios from 'axios';
import { BASE_URL } from '../constants';

export const fetchAllBusinessIdeas = async () => {
  const response = await axios.get(`${BASE_URL}/api/business-ideas/all`, { timeout: 5000 });
  return response.data;
};

export const fetchBusinessIdeas = async () => {
  const response = await axios.get(`${BASE_URL}/api/business-ideas/business-ideas`, {
    timeout: 5000,
    metadata: { disableOfflineFallback: true },
  });
  return response.data?.businessIdeas || [];
};

export const fetchJobOpenings = async () => {
  const response = await axios.get(`${BASE_URL}/api/business-ideas/job-openings`, { timeout: 5000 });
  return response.data?.jobs || [];
};

export const fetchSkillCourses = async () => {
  const response = await axios.get(`${BASE_URL}/api/business-ideas/skill-courses`, { timeout: 5000 });
  return response.data?.skills || [];
};
