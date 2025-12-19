/**
 * Test script to verify cookie parsing logic
 */

const testCookie = 'sessionId=abc123; Path=/; HttpOnly';

const sessionId = testCookie
  .split(';')
  .map(c => c.trim())
  .find(c => c.startsWith('sessionId='))
  ?.split('=')[1];

console.log('Test cookie:', testCookie);
console.log('Extracted sessionId:', sessionId);

// Test with multiple cookies
const multiCookie = 'foo=bar; sessionId=def456; baz=qux';
const sessionId2 = multiCookie
  .split(';')
  .map(c => c.trim())
  .find(c => c.startsWith('sessionId='))
  ?.split('=')[1];

console.log('\nMulti cookie:', multiCookie);
console.log('Extracted sessionId:', sessionId2);
