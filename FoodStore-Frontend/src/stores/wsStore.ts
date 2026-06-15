import { create } from 'zustand'
import type { ConnectionStatus, WSEvent } from '../types'

interface WSState {
  connectionStatus: ConnectionStatus
  lastEvent: WSEvent | null
  setConnecting: () => void
  setConnected: () => void
  setDisconnected: () => void
  setLastEvent: (event: WSEvent) => void
}

export const useWSStore = create<WSState>((set) => ({
  connectionStatus: 'disconnected',
  lastEvent: null,
  setConnecting: () => set({ connectionStatus: 'connecting' }),
  setConnected: () => set({ connectionStatus: 'connected' }),
  setDisconnected: () => set({ connectionStatus: 'disconnected' }),
  setLastEvent: (lastEvent) => set({ lastEvent }),
}))
