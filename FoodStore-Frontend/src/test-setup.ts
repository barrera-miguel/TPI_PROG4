import '@testing-library/jest-dom'

const OriginalWebSocket = globalThis.WebSocket

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = 0
  url = ''
  onopen: ((e: any) => void) | null = null
  onclose: ((e: any) => void) | null = null
  onmessage: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  send = vi.fn()
  close = vi.fn()
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
}

// Mock WebSocket para jsdom (evita errores de undici en tests)
globalThis.WebSocket = MockWebSocket as any
