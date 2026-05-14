import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor, refreshInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { PilotDataService } from './core/services/pilot-data.service';
import { environment } from '../environments/environment';

/**
 * Block app bootstrap until the session is hydrated from localStorage. Prevents
 * a race where the router activates routes before AuthService has confirmed
 * whether the stored JWT is still valid — which would flash authenticated
 * users back to /login on refresh.
 *
 * In static-data mode, synthesize a session from the pilot dataset so all
 * org-scoped routes work without a backend.
 */
const PILOT_ROLE_KEY = 'accws_pilot_role';

function resolvePilotRole(): 'admin' | 'client' {
  // ?role=client|admin overrides and persists. Default is admin.
  const fromUrl = new URLSearchParams(window.location.search).get('role');
  if (fromUrl === 'client' || fromUrl === 'admin') {
    localStorage.setItem(PILOT_ROLE_KEY, fromUrl);
    return fromUrl;
  }
  const stored = localStorage.getItem(PILOT_ROLE_KEY);
  return stored === 'client' ? 'client' : 'admin';
}

function initAuthFactory(): () => Promise<void> {
  const auth = inject(AuthService);
  const pilot = inject(PilotDataService);
  return async () => {
    if (environment.useStaticData) {
      try {
        const memberships = await firstValueFrom(pilot.pilotMemberships());
        auth.pilotBootstrap(memberships, resolvePilotRole());
      } catch (err) {
        console.error('[pilot-mode] Failed to load /data/pilot-testers.json', err);
      }
      return;
    }
    if (!auth.token()) return;
    try {
      await firstValueFrom(auth.loadMe());
    } catch {
      // loadMe already clears the session on failure.
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
    { provide: APP_INITIALIZER, multi: true, useFactory: initAuthFactory },
  ],
};
