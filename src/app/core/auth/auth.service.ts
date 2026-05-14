import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { API_BASE_URL, JWT_STORAGE_KEY } from '../services/api.config';
import { User, UserRole } from '../models/user.model';
import { OrganizationMembership } from '../models/organization.model';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

export type AuthProvider = 'local' | 'google' | 'microsoft';

export interface LoginRequest {
  email: string;
  password: string;
}

const ORG_STORAGE_KEY = 'accws_org_id';
const PENDING_INVITE_KEY = 'accws_pending_invite_token';
const VIEW_AS_CLIENT_KEY = 'accws_view_as_client';

interface BackendUser {
  id: number | string;
  name: string;
  email: string;
  is_admin?: boolean;
  avatar_url?: string | null;
  phone?: string | null;
  title?: string | null;
}

interface BackendOrgMembership {
  id: number | string;
  name: string;
  slug?: string;
  role: 'owner' | 'member';
}

interface MeResponse {
  user: BackendUser;
  is_admin: boolean;
  two_factor_enabled?: boolean;
  organizations?: BackendOrgMembership[];
}

interface TokenResponse {
  token: string;
  user: BackendUser;
}

interface TwoFactorRequiredResponse {
  two_factor_required: true;
  challenge_token: string;
  /** Added by backend when the challenged user is a system admin. */
  is_admin?: boolean;
  /** Optional hint so the UI can show who's being challenged. */
  email?: string;
}

interface MustEnrollResponse {
  must_enroll_2fa: true;
  enroll_token: string;
  user: Partial<BackendUser>;
}

export type LoginResponse = TokenResponse | TwoFactorRequiredResponse | MustEnrollResponse;

export function isTokenResponse(r: LoginResponse): r is TokenResponse {
  return 'token' in r;
}
export function isTwoFactorRequired(r: LoginResponse): r is TwoFactorRequiredResponse {
  return 'two_factor_required' in r;
}
export function isMustEnroll(r: LoginResponse): r is MustEnrollResponse {
  return 'must_enroll_2fa' in r;
}

function mapMembership(m: BackendOrgMembership): OrganizationMembership {
  return { id: String(m.id), name: m.name, slug: m.slug, role: m.role };
}

function mapUser(u: BackendUser, extras: Partial<User> = {}): User {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: (u.is_admin ? 'admin' : 'client') as UserRole,
    avatar: u.avatar_url ?? undefined,
    phone: u.phone ?? undefined,
    title: u.title ?? undefined,
    ...extras,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = inject(API_BASE_URL);

  private _token = signal<string | null>(localStorage.getItem(JWT_STORAGE_KEY));
  private _currentUser = signal<User | null>(null);
  private _organizations = signal<OrganizationMembership[]>([]);
  private _currentOrgId = signal<string | null>(localStorage.getItem(ORG_STORAGE_KEY));
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);
  private _pendingChallenge = signal<LoginResponse | null>(null);
  private _viewAsClient = signal<boolean>(localStorage.getItem(VIEW_AS_CLIENT_KEY) === '1');

  readonly token = this._token.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly organizations = this._organizations.asReadonly();
  readonly currentOrgId = this._currentOrgId.asReadonly();
  readonly currentOrg = computed(() => {
    const id = this._currentOrgId();
    return id ? this._organizations().find((o) => o.id === id) ?? null : null;
  });
  readonly isAuthenticated = computed(() => !!this._token());
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingChallenge = this._pendingChallenge.asReadonly();
  readonly viewAsClient = this._viewAsClient.asReadonly();
  /** Effective UI role: actual admin AND not currently viewing-as-client. */
  readonly uiShowsAdmin = computed(() => this.isAdmin() && !this._viewAsClient());

  constructor() {
    // Session hydration happens in APP_INITIALIZER (see app.config.ts) so that
    // routing waits for /me to resolve before activating any guards.
    effect(() => {
      const id = this._currentOrgId();
      if (id) localStorage.setItem(ORG_STORAGE_KEY, id);
      else localStorage.removeItem(ORG_STORAGE_KEY);
    });
  }

  login(email: string, password: string): Observable<LoginResponse> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap((res) => {
        if (isTokenResponse(res)) {
          this.applyToken(res.token, res.user);
        }
        this._isLoading.set(false);
      }),
      catchError((err) => {
        this._error.set(err?.error?.message ?? 'Login failed');
        this._isLoading.set(false);
        return throwError(() => err);
      }),
    );
  }

  verifyTwoFactor(challengeToken: string, code: string): Observable<TokenResponse> {
    this._isLoading.set(true);
    this._error.set(null);
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/two-factor/verify`, {
        challenge_token: challengeToken,
        code,
      })
      .pipe(
        tap((res) => {
          this.applyToken(res.token, res.user);
          this._isLoading.set(false);
        }),
        catchError((err) => {
          this._error.set(err?.error?.message ?? 'Invalid or expired code.');
          this._isLoading.set(false);
          return throwError(() => err);
        }),
      );
  }

  enrollStart(enrollToken: string, phone: string): Observable<{ enroll_token: string }> {
    this._isLoading.set(true);
    this._error.set(null);
    return this.http
      .post<{ enroll_token: string }>(`${this.apiUrl}/auth/two-factor/enroll/start`, {
        enroll_token: enrollToken,
        phone,
      })
      .pipe(
        tap(() => this._isLoading.set(false)),
        catchError((err) => {
          this._error.set(err?.error?.message ?? 'Could not send SMS.');
          this._isLoading.set(false);
          return throwError(() => err);
        }),
      );
  }

  enrollConfirm(enrollToken: string, code: string): Observable<TokenResponse> {
    this._isLoading.set(true);
    this._error.set(null);
    return this.http
      .post<TokenResponse>(`${this.apiUrl}/auth/two-factor/enroll/confirm`, {
        enroll_token: enrollToken,
        code,
      })
      .pipe(
        tap((res) => {
          this.applyToken(res.token, res.user);
          this._isLoading.set(false);
        }),
        catchError((err) => {
          this._error.set(err?.error?.message ?? 'Invalid or expired code.');
          this._isLoading.set(false);
          return throwError(() => err);
        }),
      );
  }

  /**
   * Synthesize a session in static-data mode (no backend). Pulls memberships
   * from the pilot dataset so org-scoped routes work. Idempotent.
   *
   * Role defaults to 'admin' so the "View as client" toggle is available.
   * Pass 'client' to mimic a real client login (no admin UI at all). The
   * choice can also be overridden at runtime via the ?role=client|admin URL
   * query param (persisted to localStorage).
   */
  pilotBootstrap(memberships: OrganizationMembership[], role: UserRole = 'admin'): void {
    const isAdmin = role === 'admin';
    const fakeUser: User = {
      id: isAdmin ? 'pilot-admin' : 'pilot-client',
      name: isAdmin ? 'Pilot Tester' : 'Pilot Client',
      email: isAdmin ? 'pilot@accws.local' : 'client@accws.local',
      role,
      organizations: memberships,
      clientId: memberships[0]?.id,
    };
    this._token.set('pilot-mode-token');
    localStorage.setItem(JWT_STORAGE_KEY, 'pilot-mode-token');
    this._currentUser.set(fakeUser);
    this._organizations.set(memberships);
    this.reconcileCurrentOrg(memberships);
    // The "View as client" toggle only makes sense for actual admins.
    // Clear it when bootstrapping as a real client so the UI doesn't show
    // the "Admin (viewing as client)" badge.
    if (!isAdmin) this.setViewAsClient(false);
  }

  loadMe(): Observable<User | null> {
    if (environment.useStaticData) {
      // In static mode, /me is not available. Return the cached user (or null).
      return of(this._currentUser());
    }
    return this.http.get<MeResponse>(`${this.apiUrl}/me`).pipe(
      map((res) => {
        const memberships = (res.organizations ?? []).map(mapMembership);
        const user = mapUser(
          { ...res.user, is_admin: res.is_admin },
          {
            organizations: memberships,
            twoFactorEnabled: res.two_factor_enabled,
            clientId: memberships[0]?.id,
          },
        );
        this._currentUser.set(user);
        this._organizations.set(memberships);
        this.reconcileCurrentOrg(memberships);
        return user;
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  refresh(): Observable<string> {
    return this.http.post<{ token: string }>(`${this.apiUrl}/auth/refresh`, {}).pipe(
      map((res) => {
        this._token.set(res.token);
        localStorage.setItem(JWT_STORAGE_KEY, res.token);
        return res.token;
      }),
    );
  }

  logout(): void {
    if (this._token()) {
      this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    this._token.set(null);
    this._currentUser.set(null);
    this._organizations.set([]);
    this._currentOrgId.set(null);
    localStorage.removeItem(JWT_STORAGE_KEY);
  }

  setCurrentOrg(orgId: string | null): void {
    this._currentOrgId.set(orgId);
  }

  setViewAsClient(on: boolean): void {
    this._viewAsClient.set(on);
    if (on) localStorage.setItem(VIEW_AS_CLIENT_KEY, '1');
    else localStorage.removeItem(VIEW_AS_CLIENT_KEY);
  }

  loginWithOAuth(provider: AuthProvider): void {
    if (provider === 'google') {
      this.loginWithGoogle();
      return;
    }
    this._error.set('OAuth sign-in is not configured yet.');
  }

  private loginWithGoogle(): void {
    const clientId = environment.googleClientId;
    if (!clientId) {
      this._error.set('Google sign-in is not configured: missing client ID.');
      return;
    }
    const gsi = window.google?.accounts?.oauth2;
    if (!gsi) {
      this._error.set('Google sign-in is not available (script failed to load).');
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);

    const tokenClient = gsi.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (resp) => {
        if (!resp.access_token) {
          this._error.set(resp.error ?? 'Google sign-in was cancelled.');
          this._isLoading.set(false);
          return;
        }
        this.exchangeGoogleToken(resp.access_token);
      },
      error_callback: (err: unknown) => {
        this._error.set((err as { message?: string })?.message ?? 'Google sign-in failed.');
        this._isLoading.set(false);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  }

  exchangeGoogleToken(accessToken: string): Observable<LoginResponse> {
    this._isLoading.set(true);
    this._error.set(null);
    const req$ = this.http.post<LoginResponse>(`${this.apiUrl}/auth/google/exchange`, {
      access_token: accessToken,
    });
    req$.subscribe({
      next: (res) => {
        if (isTokenResponse(res)) {
          this.applyToken(res.token, res.user);
        } else {
          this._pendingChallenge.set(res);
        }
        this._isLoading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Google sign-in failed.');
        this._isLoading.set(false);
      },
    });
    return req$;
  }

  consumePendingChallenge(): void {
    this._pendingChallenge.set(null);
  }

  // --- Phone sign-in (STUBBED) ---------------------------------------------
  phoneStart(phone: string): Observable<{ challenge_token: string }> {
    this._isLoading.set(true);
    this._error.set(null);
    return new Observable((sub) => {
      const t = setTimeout(() => {
        this._isLoading.set(false);
        sub.next({ challenge_token: `stub-phone-${phone}` });
        sub.complete();
      }, 500);
      return () => clearTimeout(t);
    });
  }

  phoneVerify(_challengeToken: string, code: string): Observable<TokenResponse> {
    this._isLoading.set(true);
    this._error.set(null);
    return new Observable<TokenResponse>((sub) => {
      const t = setTimeout(() => {
        if (!/^\d{6}$/.test(code)) {
          this._error.set('Invalid or expired code.');
          this._isLoading.set(false);
          sub.error({ error: { message: 'Invalid code' } });
          return;
        }
        const fake: TokenResponse = {
          token: 'stub-phone-jwt',
          user: {
            id: 'stub-phone',
            name: 'Phone User',
            email: 'phone@stub.local',
            is_admin: false,
          },
        };
        this.applyToken(fake.token, fake.user);
        this._isLoading.set(false);
        sub.next(fake);
        sub.complete();
      }, 500);
      return () => clearTimeout(t);
    });
  }

  /**
   * Public entry point used by invite-register flows where the token and user
   * come back from a non-login endpoint. Equivalent to applyToken + navigate.
   */
  consumeLogin(token: string, backendUser: BackendUser): void {
    this.applyToken(token, backendUser);
  }

  private applyToken(token: string, backendUser: BackendUser): void {
    this._token.set(token);
    localStorage.setItem(JWT_STORAGE_KEY, token);
    this._currentUser.set(mapUser(backendUser));
    // Hydrate orgs + route post-login.
    this.loadMe().subscribe({
      next: () => this.postLoginNavigate(),
      error: () => this.postLoginNavigate(),
    });
  }

  private postLoginNavigate(): void {
    const pendingInvite = localStorage.getItem(PENDING_INVITE_KEY);
    if (pendingInvite) {
      this.router.navigate(['/invitations', pendingInvite]);
      return;
    }
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
    this.router.navigateByUrl(returnUrl || '/dashboard');
  }

  private reconcileCurrentOrg(memberships: OrganizationMembership[]): void {
    const stored = this._currentOrgId();
    const storedStillValid = stored && memberships.some((m) => m.id === stored);
    if (storedStillValid) return;
    if (memberships.length === 1) {
      this._currentOrgId.set(memberships[0].id);
    } else if (memberships.length > 1) {
      this._currentOrgId.set(memberships[0].id);
    } else {
      this._currentOrgId.set(null);
    }
  }
}
