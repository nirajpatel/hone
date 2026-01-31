import React, { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface MachineStatus {
  serialNumber: string;
  name: string;
  modelName: string;
  connected: boolean;
  state: string;
  mode: string;
}

interface StreamUpdate {
  type: string;
  timestamp: string;
  state?: string;
  mode?: string;
  stateChanged?: boolean;
  modeChanged?: boolean;
  previousState?: string;
  previousMode?: string;
  brewingStartTime?: string;
  brewDuration?: number;
  brewWeight?: number;
}

export function LaMarzoccoStatus() {
  const [status, setStatus] = useState<MachineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [updates, setUpdates] = useState<StreamUpdate[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lamarzocco/status`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to fetch status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err: any) {
      // Silently handle errors - La Marzocco integration is optional
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = () => {
    if (eventSourceRef.current) {
      return; // Already streaming
    }

    setStreaming(true);
    setUpdates([]);
    setError(null);

    const eventSource = new EventSource(
      `https://${projectId}.supabase.co/functions/v1/make-server-23508aac/lamarzocco/stream`
    );

    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      setUpdates(prev => [...prev, { 
        type: 'connected', 
        timestamp: new Date().toISOString(),
        ...data 
      }]);
    });

    eventSource.addEventListener('update', (event) => {
      const update = JSON.parse(event.data);
      setUpdates(prev => [...prev, update]);

      // Update current status if available
      if (update.type === 'initial' || update.state) {
        setStatus(prevStatus => ({
          ...prevStatus,
          state: update.state || prevStatus?.state,
          mode: update.mode || prevStatus?.mode,
          connected: update.connected ?? prevStatus?.connected,
          serialNumber: update.serialNumber || prevStatus?.serialNumber,
          name: update.name || prevStatus?.name,
          modelName: update.modelName || prevStatus?.modelName,
        } as MachineStatus));
      }
    });

    eventSource.addEventListener('error', (event: any) => {
      // Silently handle stream errors
      if (event.data) {
        try {
          const errorData = JSON.parse(event.data);
          setError(errorData.error || 'Stream error occurred');
        } catch {
          setError('Stream error occurred');
        }
      }
    });

    eventSource.onerror = (err) => {
      // Silently handle connection errors
      setError('Stream connection lost');
      stopStreaming();
    };

    eventSourceRef.current = eventSource;
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'BREWING':
        return '☕';
      case 'POWERED_ON':
        return '✅';
      case 'STANDBY':
        return '💤';
      default:
        return '❓';
    }
  };

  const formatUpdate = (update: StreamUpdate) => {
    switch (update.type) {
      case 'initial':
        return `Initial status: ${update.state} (${update.mode})`;
      case 'connected':
      case 'websocket_connected':
        return 'WebSocket connected';
      case 'websocket_disconnected':
        return 'WebSocket disconnected';
      case 'brewing_started':
        return `☕ Brewing started at ${new Date(update.brewingStartTime!).toLocaleTimeString()}`;
      case 'brewing_complete':
        return `✅ Brew complete! Duration: ${update.brewDuration?.toFixed(1)}s, Weight: ${update.brewWeight ? update.brewWeight.toFixed(1) + 'g' : 'N/A'}`;
      case 'state_changed':
        return `State: ${update.previousState} → ${update.state}`;
      case 'mode_changed':
        return `Mode: ${update.previousMode} → ${update.mode}`;
      default:
        return JSON.stringify(update);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="mb-6">La Marzocco Machine Status</h1>

      <div className="flex gap-4 mb-6">
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Get Status'}
        </button>

        <button
          onClick={streaming ? stopStreaming : startStreaming}
          className={`px-4 py-2 rounded text-white ${
            streaming ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {streaming ? 'Stop Stream' : 'Start Stream'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {status && (
        <div className="mb-6 p-6 bg-white border border-gray-300 rounded-lg shadow-sm">
          <h2 className="mb-4">Current Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-600">Machine Name</div>
              <div>{status.name}</div>
            </div>
            <div>
              <div className="text-gray-600">Model</div>
              <div>{status.modelName}</div>
            </div>
            <div>
              <div className="text-gray-600">Serial Number</div>
              <div>{status.serialNumber}</div>
            </div>
            <div>
              <div className="text-gray-600">Connected</div>
              <div>{status.connected ? '✅ Yes' : '❌ No'}</div>
            </div>
            <div>
              <div className="text-gray-600">State</div>
              <div className="text-lg">
                {getStateIcon(status.state)} {status.state}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Mode</div>
              <div>{status.mode}</div>
            </div>
          </div>
        </div>
      )}

      {streaming && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <h2>Live Updates</h2>
          </div>
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
            {updates.length === 0 ? (
              <div className="text-gray-500 italic">Waiting for updates...</div>
            ) : (
              <div className="space-y-2">
                {updates.slice().reverse().map((update, idx) => (
                  <div key={idx} className="text-sm border-b border-gray-200 pb-2 last:border-0">
                    <div className="text-gray-500 text-xs">
                      {new Date(update.timestamp).toLocaleTimeString()}
                    </div>
                    <div>{formatUpdate(update)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="mb-2">Usage Instructions</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Get Status:</strong> Fetches the current machine status once</li>
          <li><strong>Start Stream:</strong> Opens a live connection to receive real-time updates</li>
          <li>The stream will notify you when brewing starts/stops and show brew details</li>
          <li>Try making an espresso to see live updates!</li>
        </ul>
      </div>
    </div>
  );
}
