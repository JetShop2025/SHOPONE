const fetch = require('node-fetch');

async function testEndpoint(url, options = {}) {
    try {
        const response = await fetch(url, {
            timeout: 10000,
            ...options
        });
        
        const text = await response.text();
        return {
            status: response.status,
            statusText: response.statusText,
            data: text
        };
    } catch (error) {
        throw error;
    }
}

async function runTests() {
    console.log('🔍 Testing Render deployment...\n');

    // Test 1: Status endpoint
    try {
        console.log('1️⃣ Testing /api/status...');
        const statusResult = await testEndpoint('https://shopone.onrender.com/api/status');
        console.log(`   Status: ${statusResult.status}`);
        console.log(`   Response: ${statusResult.data}\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }    // Test 2: Login endpoint
    try {
        console.log('2️⃣ Testing /api/login...');
        const loginResult = await testEndpoint('https://shopone.onrender.com/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin'
            })
        });
        console.log(`   Status: ${loginResult.status}`);
        console.log(`   Response: ${loginResult.data}\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Test 3: Trailers endpoint
    try {
        console.log('3️⃣ Testing /api/trailers...');
        const trailersResult = await testEndpoint('https://shopone.onrender.com/api/trailers');
        console.log(`   Status: ${trailersResult.status}`);
        console.log(`   Response length: ${trailersResult.data.length} characters\n`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }

    console.log('✅ Testing completed!');
}

runTests();
