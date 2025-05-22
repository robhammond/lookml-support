// Test setup file
// Add any global test configuration here

// Increase timeout for longer-running tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
});
