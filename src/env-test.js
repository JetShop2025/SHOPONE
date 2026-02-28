// env-test.js - Validate environment configuration on app startup
console.log('=== ENVIRONMENT TEST ===');
console.log('API URL:', process.env.REACT_APP_API_URL || 'https://shopone.onrender.com/api');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('======================');
