import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWSStore } from '../stores/wsStore'
import { useAdminOrdersStore } from '../stores/adminOrdersStore'
import type { WSEvent } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/api/v1/ws'
const MAX_RETRIES = 10
const BASE_DELAY = 1000

export function useAdminOrdersFeed() {
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { setConnecting, setConnected, setDisconnected, setLastEvent } = useWSStore()
  const { addUpdatedOrder } = useAdminOrdersStore()

  const connect = useCallback(() => {
    setConnecting()

    const wsInstance = new WebSocket(WS_URL)
    wsRef.current = wsInstance

    wsInstance.onopen = () => {
      retriesRef.current = 0
      setConnected()
    }

    wsInstance.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSEvent
        if (msg.event && msg.pedido_id && msg.estado_nuevo) {
          if (msg.event === 'CONNECTED') return
          const event: WSEvent = {
            event: msg.event,
            pedido_id: msg.pedido_id,
            estado_anterior: msg.estado_anterior ?? null,
            estado_nuevo: msg.estado_nuevo,
            usuario_id: msg.usuario_id ?? null,
            motivo: msg.motivo ?? null,
            timestamp: msg.timestamp ?? new Date().toISOString(),
          }
          setLastEvent(event)
          addUpdatedOrder(event.pedido_id, event.timestamp)
          qc.invalidateQueries({ queryKey: ['pedidos-admin'] })
        }
      } catch { /* parse error */ }
    }

    wsInstance.onclose = () => {
      setDisconnected()
      wsRef.current = null
      if (retriesRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retriesRef.current)
        retriesRef.current++
        timerRef.current = setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['pedidos-admin'] })
          connect()
        }, delay)
      }
    }

    wsInstance.onerror = () => {
      wsInstance.close()
    }
  }, [qc, setConnecting, setConnected, setDisconnected, setLastEvent, addUpdatedOrder])

  useEffect(() => {
    connect()
    return () => {
      const ws = wsRef.current
      if (ws) ws.close()
      if (timerRef.current) clearTimeout(timerRef.current)
      setDisconnected()
    }
  }, [connect, setDisconnected])
}
