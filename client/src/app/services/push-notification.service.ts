import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private apiUrl = 'http://localhost:2000/api/notifications';

  permissionState = signal<NotificationPermission>('default');
  isSupported = signal<boolean>('serviceWorker' in navigator && 'PushManager' in window);
  isSubscribed = signal<boolean>(false);

  constructor(private http: HttpClient) {
    if ('Notification' in window) {
      this.permissionState.set(Notification.permission);
    }
    this.initServiceWorker();
  }

  /**
   * Register service worker on startup
   */
  private async initServiceWorker(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      this.isSubscribed.set(!!sub);
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }

  /**
   * Helper to convert Base64 VAPID Key to Uint8Array required by PushManager
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Request user permission and subscribe device to Push Notifications
   */
  async requestPermissionAndSubscribe(userName: string): Promise<boolean> {
    if (!('Notification' in window)) {
      alert('Push notifications are not supported by your current browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionState.set(permission);

      if (permission !== 'granted') {
        return false;
      }

      // Get VAPID Public Key from Backend
      const res = await this.http.get<{ publicKey: string }>(`${this.apiUrl}/vapid-key`).toPromise();
      if (!res?.publicKey) return false;

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        const convertedKey = this.urlBase64ToUint8Array(res.publicKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as any
        });
      }

      const deviceInfo = `${navigator.platform} - ${navigator.userAgent.substring(0, 80)}`;

      // Post subscription to backend
      await this.http.post(`${this.apiUrl}/subscribe`, {
        userName: userName || 'Staff',
        subscription: subscription.toJSON(),
        deviceInfo
      }).toPromise();

      this.isSubscribed.set(true);
      this.playChimeSound();
      return true;

    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      return false;
    }
  }

  /**
   * Send a test push notification to current user
   */
  sendTestNotification(userName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/test`, { userName }).pipe(
      map(res => {
        this.playChimeSound();
        return res;
      }),
      catchError(err => {
        console.error('Test push error:', err);
        return of(null);
      })
    );
  }

  /**
   * Play audio chime sound for in-app alert
   */
  playChimeSound(): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // Audio context might be restricted before interaction
    }
  }
}
