const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');

require('dotenv').config();


// =====================================================
// ROUTES IMPORT
// =====================================================

const pdfRoutes = require('./routes/pdfRoutes');
const questionRoutes = require('./routes/questionRoutes');
const testRoutes = require('./routes/testRoutes');

// =====================================================
// EXPRESS APP
// =====================================================

const app = express();

const PORT = process.env.PORT || 5000;


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(bodyParser.json());

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);


// =====================================================
// SESSION
// =====================================================

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'exam-prep-hub-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false
    }
  })
);


// =====================================================
// MONGODB CONNECTION
// =====================================================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
  })
  .catch((err) => {
    console.error(
      '❌ MongoDB Connection Error:',
      err
    );
  });


// =====================================================
// API ROUTES
// =====================================================

app.use(
  '/api/pdf',
  pdfRoutes
);

app.use(
  '/api/questions',
  questionRoutes
);

app.use(
  '/api/tests',
  testRoutes
);


// =====================================================
// TEST ROUTE
// =====================================================

app.get('/', (req, res) => {

  res.send(
    '🏆 ExamPrepHub Backend is Running!'
  );

});


// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      `🚀 Server running on http://localhost:${PORT}`
    );

  }
);