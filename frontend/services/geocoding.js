import axios from 'axios';

const OPENCAGE_API_KEY = 'YOUR_OPENCAGE_API_KEY';

export const searchInRwanda = async (query) => {
  try {
    const response = await axios.get(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query + ', Rwanda')}&key=${OPENCAGE_API_KEY}&countrycode=rw&limit=10`
    );
    
    return response.data.results.filter(
      result => result.components.country === 'Rwanda'
    );
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPENCAGE_API_KEY}`
    );
    return response.data.results[0]?.formatted || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};