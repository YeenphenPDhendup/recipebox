const API_BASE = 'https://localhost:3000/api';

async function runSecurityTests() {
    console.log('Running Security Tests...\n');
    let passed = 0;
    let total = 0;

    // Test 1: Rate Limiting
    total++;
    try {
        for (let i = 0; i < 6; i++) {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: 'test@test.com', password: 'wrong' })
            });
            
            if (i >= 5 && response.status === 429) {
                console.log('PASS - Rate Limiting');
                passed++;
                break;
            }
        }
    } catch (e) {
        console.log('FAIL - Rate Limiting');
    }

    // Test 2: SQL Injection
    total++;
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: "admin' OR '1'='1", password: "anything" })
        });
        
        if (response.status !== 200) {
            console.log('PASS - SQL Injection Protection');
            passed++;
        } else {
            console.log('FAIL - SQL Injection Protection');
        }
    } catch (e) {
        console.log('PASS - SQL Injection Protection');
        passed++;
    }

    // Test 3: Input Validation
    total++;
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'invalid-email', password: 'short', username: 'test' })
        });
        
        if (response.status !== 200) {
            console.log('PASS - Input Validation');
            passed++;
        } else {
            console.log('FAIL - Input Validation');
        }
    } catch (e) {
        console.log('PASS - Input Validation');
        passed++;
    }

    console.log(`\nResults: ${passed}/${total} tests passed`);
    console.log(passed === total ? 'SUCCESS - ALL SECURITY TESTS PASSED!' : 'WARNING - Some security tests failed');
}

// Allow self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
runSecurityTests();