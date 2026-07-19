const API = '';

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export interface Camera {
  name: string;
  ip: string;
  user: string;
  password: string;
  cloud_password: string;
  enabled: boolean;
  model: string;
  motion_detection?: boolean;
}

export interface WatchdogStatus {
  camera_id: number;
  kind: string;
  active: boolean;
  pid: number | null;
  healthy: boolean;
  recovering: boolean;
  black_detected: boolean;
  consecutive_failures: number;
  last_error: string;
}

export interface Preset {
  token: string;
  name: string;
}

export interface Recording {
  filename: string;
  size: number;
  modified: number;
  camera_id?: number | null;
  date?: string | null;
  hour?: number | null;
  type?: 'dvr' | 'manual';
}

export interface Snapshot {
  filename: string;
  size: number;
  modified: number;
}

export interface CalendarDay {
  date: string;
  count: number;
  total_size: number;
  hours: number[];
}

export interface HourSegment {
  hour: number;
  filename: string;
  size: number;
  modified: number;
}

export const api = {
  getCameras: () => request<Camera[]>('/api/cameras'),
  addCamera: (cam: Partial<Camera>) => request<{ cameras: Camera[] }>('/api/cameras', { method: 'POST', body: JSON.stringify(cam) }),
  updateCamera: (i: number, cam: Partial<Camera>) => request<{ cameras: Camera[] }>(`/api/cameras/${i}`, { method: 'PUT', body: JSON.stringify(cam) }),
  deleteCamera: (i: number) => request<{ cameras: Camera[] }>(`/api/cameras/${i}`, { method: 'DELETE' }),
  reorderCameras: (from: number, to: number) => request<{ cameras: Camera[] }>('/api/cameras/reorder', { method: 'PUT', body: JSON.stringify({ from_index: from, to_index: to }) }),
  getSettings: () => request<{ grid_size: number; theme: string; view_mode: string; main_camera: number }>('/api/cameras/settings'),
  updateSettings: (s: { grid_size?: number; theme?: string; view_mode?: string; main_camera?: number }) => request<{ grid_size: number; theme: string; view_mode: string; main_camera: number }>('/api/cameras/settings', { method: 'PUT', body: JSON.stringify(s) }),

  startStream: (id: number) => request(`/api/stream/${id}/start`, { method: 'POST' }),
  stopStream: (id: number) => request(`/api/stream/${id}/stop`, { method: 'POST' }),
  streamStatus: () => request<{ camera_id: number; active: boolean; pid: number | null }[]>('/api/stream/status'),

  connectPtz: (id: number) => request(`/api/ptz/${id}/connect`, { method: 'POST' }),
  ptzCommand: (id: number, cmd: Record<string, unknown>) => request(`/api/ptz/${id}/command`, { method: 'POST', body: JSON.stringify(cmd) }),
  getPresets: (id: number) => request<Preset[]>(`/api/ptz/${id}/presets`),
  ptzStatus: (id: number) => request<{ connected: boolean; led: string }>(`/api/ptz/${id}/status`),

  getRecordings: () => request<Recording[]>('/api/recordings'),
  startRecording: (id: number) => request(`/api/recordings/${id}/start`, { method: 'POST' }),
  stopRecording: (id: number) => request(`/api/recordings/${id}/stop`, { method: 'POST' }),
  recordingStatus: (id: number) => request<{ recording: boolean }>(`/api/recordings/${id}/status`),

  getDvrCalendar: (cameraId: number) => request<CalendarDay[]>(`/api/recordings/calendar/${cameraId}`),
  getDvrHours: (cameraId: number, date: string) => request<HourSegment[]>(`/api/recordings/hours/${cameraId}/${date}`),
  cleanupDvr: () => request<{ success: boolean; deleted: number; freed_bytes: number }>(`/api/recordings/cleanup`, { method: 'POST' }),

  recordingStreamUrl: (filename: string) => `/recordings/files/${filename}`,

  getSnapshots: () => request<Snapshot[]>('/api/snapshots'),
  takeSnapshot: (id: number) => request(`/api/snapshots/${id}`, { method: 'POST' }),

  health: () => request<{ status: string; streams: { camera_id: number; active: boolean; pid: number | null }[]; watchdog: WatchdogStatus[] }>('/api/health'),
};
