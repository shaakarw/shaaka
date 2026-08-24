require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

const secondaryKey = process.env.SECONDARY_KEY;
const providerCallbackHost = process.env.PROVIDER_CALLBACK_HOST;

if (!secondaryKey || !providerCallbackHost) {
  console.error('❌ Missing SECONDARY_KEY or PROVIDER_CALLBACK_HOST in .env');
  process.exit(1);
}

function generateUuidV4() {
  return crypto.randomUUID();
}

async function createApiUser() {
  const referenceId = generateUuidV4();
  const url = `${BASE_URL}/v1_0/apiuser`;
  const payload = { providerCallbackHost };

  console.log('🆕 Creating API User with Reference ID:', referenceId);
  const response = await axios.post(url, payload, {
    headers: {
      'X-Reference-Id': referenceId,
      'Ocp-Apim-Subscription-Key': secondaryKey,
      'Content-Type': 'application/json'
    }
  });

  console.log('✅ API User created. Status:', response.status);
  return referenceId;
}

async function createApiKey(apiUser) {
  const url = `${BASE_URL}/v1_0/apiuser/${apiUser}/apikey`;
  console.log('🔑 Requesting API Key for user:', apiUser);

  const response = await axios.post(url, null, {
    headers: {
      'Ocp-Apim-Subscription-Key': secondaryKey,
      'Content-Type': 'application/json'
    }
  });

  console.log('✅ API Key obtained. Status:', response.status);
  return response.data;  // { apiKey: '...' }
}

async function setup() {
  try {
    const apiUser = await createApiUser();
    const keyData = await createApiKey(apiUser);

    console.log('\n🎉 Success! Add these to your .env file:');
    console.log(`API_USER=${apiUser}`);
    console.log(`API_KEY=${keyData.apiKey}`);
    console.log('\nThen restart your server (npm start).');
  } catch (error) {
    console.error('❌ Setup failed:', error.response?.data || error.message);
  }
}

setup();