const mongoose = require('mongoose');

const shouldLogPerformance = () => (
  process.env.NODE_ENV !== 'production' || process.env.PERF_LOGS === 'true'
);

mongoose.plugin(schema => {
  const readOperations = ['find', 'findOne', 'countDocuments', 'estimatedDocumentCount'];
  schema.pre(readOperations, function() {
    this._performanceStartedAt = process.hrtime.bigint();
  });
  schema.post(readOperations, function() {
    if (!shouldLogPerformance() || !this._performanceStartedAt) return;
    const durationMs = Number(process.hrtime.bigint() - this._performanceStartedAt) / 1e6;
    const collection = this.model?.collection?.name || 'unknown';
    console.info(`[Perf][DB] ${collection}.${this.op} ${durationMs.toFixed(1)}ms`);
  });
});

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined. Check backend/.env.');
  }

  try {
    await mongoose.connect(mongoUri, {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB Atlas connected');
    return mongoose.connection;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

module.exports = connectDB;