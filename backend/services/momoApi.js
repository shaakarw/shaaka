// Payments removed: provide a stub MomoApi to avoid runtime errors if referenced elsewhere.
class MomoApi {
  constructor() {
    console.warn('MomoApi is disabled: payment features have been removed.');
  }

  async requestToPay() {
    throw new Error('Payments have been removed from this application.');
  }

  async getAccessToken() {
    throw new Error('Payments have been removed from this application.');
  }
}

module.exports = MomoApi;