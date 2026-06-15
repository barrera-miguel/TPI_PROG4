import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWSStore } from '../stores/wsStore'
import { useOrderStatusStore } from '../stores/orderStatusStore'
import type { WSEvent } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/api/v1/ws'
const MAX_RETRIES = 10
const BASE_DELAY = 1000

export function useOrderStatusWS(pedidoId: number | null) {
  const qc = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pedidoRef = useRef(pedidoId)
  pedidoRef.current = pedidoId

  const { setConnecting, setConnected, setDisconnected, setLastEvent } = useWSStore()
  const updateOrder = useOrderStatusStore((s) => s.updateOrder)

  const connect = useCallback(() => {
    if (!pedidoRef.current) return
    setConnecting()

    const wsInstance = new WebSocket(WS_URL)
    wsRef.current = wsInstance

    wsInstance.onopen = () => {
      retriesRef.current = 0
      setConnected()
      try {
        wsInstance.send(JSON.stringify({ action: 'subscribe-order', order_id: pedidoRef.current }))
      } catch { /* socket closed */ }
    }

    wsInstance.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSEvent
        if (msg.event && msg.pedido_id && msg.estado_nuevo) {
          if (msg.event === 'CONNECTED' || msg.event === 'SUBSCRIBED') return
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
          updateOrder(event.pedido_id, event.estado_nuevo, event.timestamp)
          qc.invalidateQueries({ queryKey: ['pedido', event.pedido_id] })
        }
      } catch { /* parse error */ }
    }

    wsInstance.onclose = () => {
      setDisconnected()
      wsRef.current = null
      const pid = pedidoRef.current
      if (pid && retriesRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retriesRef.current)
        retriesRef.current++
        timerRef.current = setTimeout(() => {
          if (pedidoRef.current) {
            qc.invalidateQueries({ queryKey: ['pedido', pid] })
            connect()
          }
        }, delay)
      }
    }

    wsInstance.onerror = () => {
      wsInstance.close()
    }
  }, [qc, setConnecting, setConnected, setDisconnected, setLastEvent, updateOrder])

  useEffect(() => {
    connect()
    return () => {
      const pid = pedidoRef.current
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ action: 'unsubscribe-order', order_id: pid })) } catch { /* */ }
        ws.close()
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      setDisconnected()
    }
  }, [connect, setDisconnected])
}
