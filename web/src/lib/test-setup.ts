import { vi } from 'vitest';

// Mock the Prisma client to prevent database connections during tests
vi.mock('./prisma', () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    location: {
      findMany: vi.fn().mockResolvedValue([
        { name: 'Auckland', address: '123 Auckland St, Auckland' },
        { name: 'Wellington', address: '456 Wellington St, Wellington' },
      ]),
    },
  },
}));

// Mock locations module (fresh DB-backed helpers)
const MOCK_LOCATION_ADDRESSES: Record<string, string> = {
  'Auckland': '123 Auckland St, Auckland',
  'Wellington': '456 Wellington St, Wellington',
};
vi.mock('./locations', () => ({
  DEFAULT_LOCATION: 'Wellington',
  getActiveLocationNames: vi.fn().mockResolvedValue(['Auckland', 'Wellington']),
  getLocationAddresses: vi.fn().mockResolvedValue(MOCK_LOCATION_ADDRESSES),
  getShiftLocationOptions: vi.fn().mockResolvedValue([]),
  getGoogleMapsUrl: (address: string) => `https://www.google.com/maps/search/?api=1&query=Everybody+Eats+${encodeURIComponent(address)}`,
}));
