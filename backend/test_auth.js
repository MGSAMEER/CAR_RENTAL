const API_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('--- STARTING API TESTS ---');
  let token = '';
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'password123';

  // 1. Missing fields check
  console.log('\n[1] Testing Missing Fields (Register)...');
  let res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User' }) // Missing email and password
  });
  let data = await res.json();
  console.log('Response:', data);
  if (data.message !== 'All fields are required') throw new Error('Failed missing fields test');

  // 2. Successful Registration
  console.log('\n[2] Testing Successful Registration...');
  res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: testEmail, password: testPassword })
  });
  data = await res.json();
  console.log('Response:', data);
  if (!data.success) throw new Error('Registration failed');

  // 3. Duplicate Registration
  console.log('\n[3] Testing Duplicate Registration...');
  res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: testEmail, password: testPassword })
  });
  data = await res.json();
  console.log('Response:', data);
  if (data.message !== 'User already exists') throw new Error('Duplicate check failed');

  // 4. Invalid Login
  console.log('\n[4] Testing Invalid Login...');
  res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'wrongpassword' })
  });
  data = await res.json();
  console.log('Response:', data);
  if (data.message !== 'Invalid credentials') throw new Error('Invalid login check failed');

  // 5. Successful Login
  console.log('\n[5] Testing Successful Login...');
  res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  data = await res.json();
  console.log('Response:', data);
  if (!data.success) throw new Error('Login failed');
  token = data.data.accessToken;

  // 6. Fetch Profile (Protected Route)
  console.log('\n[6] Testing Protected Profile Fetch...');
  res = await fetch(`${API_URL}/auth/me`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  data = await res.json();
  console.log('Response:', data);
  if (!data.success) throw new Error('Fetch profile failed');

  console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => console.error('\n❌ TEST FAILED:', err.message));
