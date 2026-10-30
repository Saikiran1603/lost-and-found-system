import axios from 'axios';
import type { User } from './types';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');

export const api = axios.create({
  baseURL: configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3001' : undefined),
  timeout: 10000,
});

if (import.meta.env.PROD && !configuredApiUrl) {
  api.interceptors.request.use((config) => Promise.reject(
    new Error('VITE_API_URL is not configured. Set it to your deployed JSON Server URL and redeploy Netlify.')
  ));
}

export const now = () => new Date().toISOString();

export function errMsg(e: unknown): string {
  if (e instanceof Error && e.message.includes('VITE_API_URL')) return e.message;
  if (axios.isAxiosError(e)) {
    if (!e.response) return 'Cannot reach the server. Start JSON Server with "npm run server" and try again.';
    return `Request failed (${e.response.status}). Please try again.`;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export const log = (entityType: string, entityId: number, action: string, actorId: number, note = '') =>
  api.post('/activityLogs', { entityType, entityId, action, actorId, note, createdAt: now() });

export const notify = (userId: number, type: string, message: string, link = '') =>
  api.post('/notifications', { userId, type, message, link, read: false, createdAt: now() });

export async function notifyStaff(type: string, message: string, link = '') {
  const { data } = await api.get<User[]>('/users');
  await Promise.all(data.filter((u) => u.active && u.role !== 'user').map((u) => notify(u.id, type, message, link)));
}
