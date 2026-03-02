async function test() {
    try {
        const res = await fetch('https://server-tan-iota-18.vercel.app/api/health');
        const text = await res.text();
        console.log('STATUS:', res.status);
        console.log('HEADERS:', Object.fromEntries(res.headers.entries()));
        console.log('BODY:', text);
    } catch (err) {
        console.error('FETCH ERROR:', err);
    }
}
test();
