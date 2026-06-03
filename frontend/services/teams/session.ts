import type { AppUser } from '../../types/domain';

export function readSessionUser(): AppUser | null {
  try {
    const raw = localStorage.getItem('liga360:user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return {
      id: String(user.id),
      fullName: user.username || `Usuario ${user.id}`,
      username: user.username,
      type: user.type,
    };
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: any) {
  localStorage.setItem('liga360:token', token);
  localStorage.setItem('liga360:user', JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem('liga360:user');
  localStorage.removeItem('liga360:token');
}
