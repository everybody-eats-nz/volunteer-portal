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

// Mock locations module that uses top-level await
vi.mock('./locations', () => ({
  LOCATIONS: ['Auckland', 'Wellington'],
  LOCATION_ADDRESSES: {
    'Auckland': '123 Auckland St, Auckland',
    'Wellington': '456 Wellington St, Wellington',
  },
  DEFAULT_LOCATION: 'Wellington',
  getGoogleMapsUrl: (address: string) => `https://www.google.com/maps/search/?api=1&query=Everybody+Eats+${encodeURIComponent(address)}`,
  getLocationMapsUrl: (location: string) => `https://www.google.com/maps/search/?api=1&query=Everybody+Eats+${location}`,
}));
