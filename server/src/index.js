const dotenv = require('dotenv');
const app = require('./app');
const connectDB = require('./config/db');

dotenv.config();

const port = process.env.PORT || 5000;

const startServer = async () => {
  let isDbConnected = false;

  try {
    await connectDB();
    isDbConnected = true;
  } catch (error) {
    console.warn(`MongoDB unavailable at startup: ${error.message}`);
    console.warn('Starting API without database. Auth endpoints will return 503 until DB is available.');
  }

  app.listen(port, () => {
    const dbStatus = isDbConnected ? 'connected' : 'disconnected';
    console.log(`Server running on http://localhost:${port} (db: ${dbStatus})`);
  });
};

startServer();
