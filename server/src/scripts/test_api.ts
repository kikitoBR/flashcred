
const API_URL = 'http://localhost:3001/api/clients';

async function testApi() {
    try {
        console.log(`Fetching ${API_URL}...`);
        const response = await fetch(API_URL);
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text}`);
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testApi();

export { };
