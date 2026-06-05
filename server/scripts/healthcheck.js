const http = require('http');

const PORT = process.env.PORT || 3001;
const URL = `http://localhost:${PORT}/api/health`;

const req = http.get(URL, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error(`Healthcheck failed: status code ${res.statusCode}`);
            process.exit(1);
        }

        try {
            const json = JSON.parse(data);
            const heapUsed = json.memory?.heapUsed || 0;
            const limit = 500 * 1024 * 1024; // 500 MB in bytes

            if (heapUsed > limit) {
                console.error(`Healthcheck failed: Heap used (${(heapUsed / 1024 / 1024).toFixed(2)} MB) exceeds limit of 500 MB`);
                process.exit(1);
            }

            console.log(`Healthcheck passed: Heap used: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`);
            process.exit(0);
        } catch (err) {
            console.error('Healthcheck failed: Error parsing response', err);
            process.exit(1);
        }
    });
});

req.on('error', (err) => {
    console.error('Healthcheck failed: Connection error', err);
    process.exit(1);
});

req.end();
