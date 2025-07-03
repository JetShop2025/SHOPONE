console.log('🔍 Testing Render deployment...\n');

// Simple test using basic Node.js modules
const https = require('https');

function simpleTest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js Test Client'
            }
        };

        console.log(`Testing ${method} ${url}...`);
        
        const req = https.request(url, options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                console.log(`✅ Status: ${res.statusCode}`);
                console.log(`✅ Response: ${responseData}`);
                resolve({ status: res.statusCode, data: responseData });
            });
        });

        req.on('error', (error) => {
            console.log(`❌ Error: ${error.message}`);
            reject(error);
        });

        if (data) {
            req.write(data);
        }

        req.end();
    });
}

async function runTests() {
    try {
        // Test 1: Status
        await simpleTest('https://shopone.onrender.com/api/status');
        console.log('\n---\n');
        
        // Test 2: Login
        const loginData = JSON.stringify({ username: 'admin', password: 'admin' });
        await simpleTest('https://shopone.onrender.com/api/login', 'POST', loginData);
        console.log('\n---\n');
        
        console.log('🎉 All tests completed!');
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }
}

runTests();
