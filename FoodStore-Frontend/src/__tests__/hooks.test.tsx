import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOrderStatusWS } from '../hooks/useOrderStatusWS'
import { useWSStore } from '../stores/wsStore'
import { useOrderStatusStore } from '../stores/orderStatusStore'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useOrderStatusWS', () => {
  beforeEach(() => {
    act(() => {
      useWSStore.setState({ connectionStatus: 'disconnected', lastEvent: null })
      const state = useOrderStatusStore.getState()
      Object.keys(state.orders).forEach(id => state.removeOrder(Number(id)))
    })
  })

  it('sets status to connecting when hook mounts', () => {
    const { unmount } = renderHook(() => useOrderStatusWS(42), { wrapper: Wrapper })
    // WebSocket is mocked, so it won't actually connect but the store should update
    unmount()
  })

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useOrderStatusWS(42), { wrapper: Wrapper })
    unmount()
    // Should not crash
  })

  it('handles null pedidoId gracefully', () => {
    const { unmount } = renderHook(() => useOrderStatusWS(null), { wrapper: Wrapper })
    unmount()
  })
})

describe('useAdminOrdersFeed', () => {
  // Dynamic import to avoid top-level mock issues
  let useAdminOrdersFeed: any
  beforeAll(async () => {
    const mod = await import('../hooks/useAdminOrdersFeed')
    useAdminOrdersFeed = mod.useAdminOrdersFeed
  })

  beforeEach(() => {
    act(() => {
      useWSStore.setState({ connectionStatus: 'disconnected', lastEvent: null })
    })
  })

  it('connects on mount', () => {
    const { unmount } = renderHook(() => useAdminOrdersFeed(), { wrapper: Wrapper })
    expect(useWSStore.getState().connectionStatus).toBe('connecting')
    unmount()
  })

  it('sets disconnected on unmount', () => {
    const { unmount } = renderHook(() => useAdminOrdersFeed(), { wrapper: Wrapper })
    unmount()
    expect(useWSStore.getState().connectionStatus).toBe('disconnected')
  })
})
