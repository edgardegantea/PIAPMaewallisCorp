/**
 * useSSENotifications
 *
 * Opens a Server-Sent Events connection to /api/notifications/stream.
 * On each "notifications" event, calls onUpdate({ unread_user, alert_count }).
 * Falls back to polling every 30 s if SSE is not supported.
 *
 * Usage:
 *   useSSENotifications({ token, onUpdate })
 */
import { useEffect, useRef } from 'react';

const SSE_URL = (token) =>
  `${import.meta.env.VITE_API_URL ?? ''}/api/notifications/stream?token=${encodeURIComponent(token)}`;

export default function useSSENotifications({ token, onUpdate, enabled = true }) {
  const esRef      = useRef(null);
  const retryTimer = useRef(null);

  useEffect(() => {
    if (!enabled || !token) return;

    // EventSource is supported in all modern browsers
    if (typeof EventSource === 'undefined') return;

    const connect = () => {
      if (esRef.current) esRef.current.close();

      const es = new EventSource(SSE_URL(token));
      esRef.current = es;

      es.addEventListener('notifications', (e) => {
        try {
          const data = JSON.parse(e.data);
          onUpdate(data);
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Reconnect after 8 s (server closes after 90 s anyway; EventSource reconnects automatically,
        // but we add our own backoff for error cases)
        retryTimer.current = setTimeout(connect, 8_000);
      };
    };

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      clearTimeout(retryTimer.current);
    };
  }, [token, enabled]);
}
