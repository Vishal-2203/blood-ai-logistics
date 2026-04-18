import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('socket.io-client', () => ({
  __esModule: true,
  io: jest.fn(() => {
    const socket = {
      on: jest.fn((eventName, handler) => {
        if (eventName === 'connect') {
          handler();
        }

        return socket;
      }),
      emit: jest.fn(),
      disconnect: jest.fn()
    };

    return socket;
  })
}));

jest.mock('leaflet', () => {
  class Icon {
    constructor(options) {
      this.options = options;
    }
  }

  const api = {
    Icon,
    divIcon: jest.fn((options) => ({ options })),
    latLngBounds: jest.fn(() => ({
      isValid: () => true
    }))
  };

  return {
    __esModule: true,
    default: api,
    ...api
  };
});

jest.mock('react-leaflet', () => {
  const React = require('react');

  const passthrough = ({ children, ...props }) => <div data-testid="leaflet-node" {...props}>{children}</div>;

  return {
    __esModule: true,
    MapContainer: ({ children, ...props }) => <div data-testid="leaflet-map" {...props}>{children}</div>,
    TileLayer: passthrough,
    Marker: passthrough,
    Popup: passthrough,
    Circle: passthrough,
    Polyline: passthrough,
    useMap: () => ({
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
      getZoom: jest.fn(() => 12)
    }),
    useMapEvents: () => null
  };
});

function createJsonResponse(data) {
  return Promise.resolve({
    ok: true,
    json: async () => data
  });
}

function createMockInsights() {
  return {
    insights: [
      {
        type: 'warning',
        icon: 'drop',
        title: 'Critical Stock Alert',
        description: 'O- is at 2/25 units and needs replenishment.',
        priority: 'high'
      },
      {
        type: 'info',
        icon: 'navigation',
        title: 'Top Donor Match',
        description: 'Ravi leads the match list with score 0.91 at approximately 1.40 km.',
        priority: 'medium'
      },
      {
        type: 'success',
        icon: 'check',
        title: 'System Health',
        description: 'Fallback pipeline is active and healthy.',
        priority: 'low'
      },
      {
        type: 'insight',
        icon: 'clock',
        title: 'Decision Summary',
        description: 'Routing the closest eligible donor first.',
        priority: 'medium'
      }
    ]
  };
}

function createMockSession(overrides = {}) {
  return {
    token: 'test-auth-token',
    user: {
      id: 'hospital-1',
      email: 'hospital@bloodagent.demo',
      role: 'hospital',
      name: 'Hospital Ops'
    },
    requests: [
      {
        id: 'REQ-1011',
        patient: 'Anjali Verma',
        blood: 'O-',
        units: 4,
        fulfilled: 1,
        urgency: 'Critical',
        status: 'In Transit',
        donorStatus: 'accepted',
        location: 'AIIMS Emergency Wing',
        lat: 28.567,
        lng: 77.21,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'REQ-1012',
        patient: 'Rajesh Khanna',
        blood: 'B-',
        units: 2,
        fulfilled: 0,
        urgency: 'High',
        status: 'Matching',
        donorStatus: 'pending',
        location: 'North Block Coordination Hub',
        lat: 28.617,
        lng: 77.213,
        updatedAt: new Date().toISOString()
      }
    ],
    donors: [
      { id: 'donor-ravi', name: 'Ravi Kumar', blood: 'O-', lat: 28.545, lng: 77.19, eta: 14, status: 'Ready' },
      { id: 'donor-priya', name: 'Priya Rangan', blood: 'O-', lat: 28.59, lng: 77.23, eta: 22, status: 'Preparing' }
    ],
    stock: [
      { type: 'A+', units: 42, min: 50 },
      { type: 'O-', units: 2, min: 25 }
    ],
    ...overrides
  };
}

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();

  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  global.fetch = jest.fn((url) => {
    if (url.endsWith('/login')) {
      return createJsonResponse(createMockSession());
    }

    if (url.endsWith('/session/bootstrap')) {
      return createJsonResponse(createMockSession());
    }

    if (url.endsWith('/ai-insights')) {
      return createJsonResponse(createMockInsights());
    }

    if (url.endsWith('/request-blood')) {
      return createJsonResponse({
        request: {
          id: 'REQ-9001',
          patient: 'Maya Singh',
          blood: 'O-',
          units: 2,
          fulfilled: 0,
          urgency: 'Critical',
          status: 'Matching',
          donorStatus: 'pending',
          location: 'AIIMS Emergency Wing',
          lat: 28.567,
          lng: 77.21,
          updatedAt: new Date().toISOString(),
          ai_data: {
            top_3_donors: [
              { name: 'Ravi', score: 0.91, distance: 1.4, eta: 8 },
              { name: 'Meena', score: 0.83, distance: 2.1, eta: 11 },
              { name: 'Pooja', score: 0.78, distance: 2.8, eta: 14 }
            ],
            system_health: {
              alert_status: 'WARNING',
              public_message: 'Fallback pipeline is active and healthy.'
            },
            decision: {
              selected_donor: 'Ravi',
              reason: 'Routing the closest eligible donor first.'
            }
          }
        }
      });
    }

    return Promise.reject(new Error(`Unhandled fetch request for ${url}`));
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
  window.localStorage.clear();
});

test('hospital users can log in, create a request, and open the live tracker', async () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /hospital staff/i }));
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'hospital@bloodagent.demo' }
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'hospital123' }
  });
  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

  expect(await screen.findByText(/facility command/i)).toBeInTheDocument();
  expect(screen.getByText(/monitoring 2 live requests across the network/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /new request/i }));
  fireEvent.change(screen.getByLabelText(/patient full name/i), {
    target: { value: 'Maya Singh' }
  });
  fireEvent.click(screen.getByRole('button', { name: /broadcast emergency/i }));

  expect(await screen.findByText(/broadcast created for o-/i)).toBeInTheDocument();
  expect(await screen.findByText(/live donor tracking for maya singh/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /open request tracker/i }));

  expect(await screen.findByText(/tracking maya singh/i)).toBeInTheDocument();
  expect(screen.getByText(/status: matching/i)).toBeInTheDocument();
});

test('the app restores an authenticated requestor session from persistent storage', async () => {
  const restoredSession = createMockSession({
    user: {
      id: 'requestor-1',
      email: 'requestor@bloodagent.demo',
      role: 'requestor',
      name: 'Request Desk'
    },
    requests: [
      {
        id: 'REQ-9001',
        patient: 'Restored Patient',
        blood: 'AB-',
        units: 2,
        fulfilled: 1,
        urgency: 'Critical',
        status: 'In Transit',
        donorStatus: 'accepted',
        location: 'AIIMS Emergency Wing',
        lat: 28.567,
        lng: 77.21,
        updatedAt: new Date().toISOString(),
        ai_data: {
          decision: {
            reason: 'Restored request state is available.'
          },
          top_3_donors: [
            { name: 'Ravi', score: 0.88, distance: 1.9, eta: 9 }
          ],
          system_health: {
            alert_status: 'WARNING',
            public_message: 'Restored request state is available.'
          }
        }
      }
    ],
    stock: [
      { type: 'O-', units: 3, min: 25 }
    ]
  });

  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/session/bootstrap')) {
      return createJsonResponse(restoredSession);
    }

    return Promise.reject(new Error(`Unhandled fetch request for ${url}`));
  });

  window.localStorage.setItem('blood-agent-auth-v1', JSON.stringify({
    token: 'persisted-token',
    user: restoredSession.user
  }));

  window.localStorage.setItem('blood-agent-state-v1', JSON.stringify({
    activeRequestId: 'REQ-9001',
    stock: restoredSession.stock,
    donors: restoredSession.donors,
    requests: restoredSession.requests
  }));

  render(<App />);

  expect(await screen.findByText(/track your request/i)).toBeInTheDocument();
  expect(screen.getByText(/tracking restored patient/i)).toBeInTheDocument();
  expect(screen.getByText(/current stage: in transit\. 1\/2 units secured\./i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /view full details/i }));

  await waitFor(() => {
    expect(screen.getByText(/restored request state is available\./i)).toBeInTheDocument();
  });
});
