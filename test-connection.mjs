// Test script para verificar conectividad con el backend
import fetch from 'node-fetch';
const API_URL = 'https://shopone.onrender.com';

async function testConnection() {
  console.log('Testing connection to:', API_URL);
  
  try {
    // Test health endpoint
    console.log('\n1. Testing /health endpoint...');
    const healthResponse = await fetch(`${API_URL}/health`);
    console.log('Health status:', healthResponse.status);
    console.log('Health headers:', Object.fromEntries(healthResponse.headers.entries()));
    const healthData = await healthResponse.json();
    console.log('Health data:', healthData);
    
    // Test work-orders endpoint
    console.log('\n2. Testing /work-orders endpoint...');
    const woResponse = await fetch(`${API_URL}/work-orders`);
    console.log('Work Orders status:', woResponse.status);
    console.log('Work Orders headers:', Object.fromEntries(woResponse.headers.entries()));
    
    if (woResponse.ok) {
      const woData = await woResponse.json();
      console.log('Work Orders count:', woData.length);
    } else {
      console.log('Work Orders error:', await woResponse.text());
    }
    
  } catch (error) {
    console.error('Connection error:', error);
  }
}

testConnection();
