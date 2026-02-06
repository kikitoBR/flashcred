
const API_URL = 'http://localhost:3001/api/clients';

async function testCreate() {
    const payload = {
        name: "Test Client",
        cpf: "12345678900",
        email: "test@example.com",
        phone: "11999999999",
        income: 5000,
        score: 750,
        birthDate: "1990-01-01",
        address: {
            street: "Rua Teste",
            number: "123",
            neighborhood: "Bairro",
            city: "Cidade",
            zipCode: "12345-678"
        },
        cnh: {
            hasCnh: true,
            categories: ["A", "B"]
        }
    };

    try {
        console.log(`POSTing to ${API_URL}...`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Body: ${text}`);
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testCreate();

export { };
