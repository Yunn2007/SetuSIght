/**
 * SetuSight: Smart Bridge Health Monitoring & Asset Management System
 * Node.js + Express Server Entry Point
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const bridgeRoutes = require('./routes/bridgeRoutes');
const inspectionRoutes = require('./routes/inspectionRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const contractorRoutes = require('./routes/contractorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');

const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const { checkSupabaseHealth, isConfigured: isSupabaseConfigured } = require('./config/supabase');
const { checkCloudinaryHealth, isConfigured: isCloudinaryConfigured } = require('./config/cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bridges', bridgeRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

// Health Check API
app.get('/api/health', async (req, res) => {
  const supabaseHealth = await checkSupabaseHealth();
  const cloudinaryHealth = await checkCloudinaryHealth();

  const isHealthy = supabaseHealth.ok;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      supabase_postgresql: {
        configured: isSupabaseConfigured(),
        status: supabaseHealth.ok ? 'connected' : 'unavailable',
        message: supabaseHealth.message
      },
      cloudinary_storage: {
        configured: isCloudinaryConfigured(),
        status: cloudinaryHealth.ok ? 'connected' : (isCloudinaryConfigured() ? 'unavailable' : 'not_configured'),
        message: cloudinaryHealth.message
      }
    }
  });
});

// HTML Page Route Handlers for clean URLs
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '../public/admin.html')));
app.get('/inspector', (req, res) => res.sendFile(path.join(__dirname, '../public/inspector.html')));
app.get('/contractor', (req, res) => res.sendFile(path.join(__dirname, '../public/contractor.html')));
app.get('/bridge-details', (req, res) => res.sendFile(path.join(__dirname, '../public/bridge-details.html')));
app.get('/report-view', (req, res) => res.sendFile(path.join(__dirname, '../public/report-view.html')));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(`🌉 SetuSight Infrastructure Platform running on http://localhost:${PORT}`);
    console.log(`   Database: Supabase PostgreSQL (${isSupabaseConfigured() ? 'Configured' : 'Missing credentials in .env'})`);
    console.log(`   Image Storage: Cloudinary (${isCloudinaryConfigured() ? 'Configured' : 'Missing credentials in .env'})`);
    console.log(`=============================================================`);
  });
}

module.exports = app;
