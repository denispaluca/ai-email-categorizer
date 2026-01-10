import '@testing-library/jest-dom';

// Polyfill Request and Response for API route tests
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables for testing
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing-purposes';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-api-key';
process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project-id';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
  getSession: jest.fn(),
}));

// Suppress console output during tests to keep test output clean
const originalError = console.error;
const originalLog = console.log;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress all console.error calls during tests
  console.error = jest.fn();
  // Suppress all console.log calls during tests
  console.log = jest.fn();
  // Suppress all console.warn calls during tests
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.log = originalLog;
  console.warn = originalWarn;
});

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
