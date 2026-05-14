import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { SiteVisit, VisitStatus } from '../models/site-visit.model';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from './api.config';
import { environment } from '../../../environments/environment';
import {
  Envelope,
  SiteVisitDto,
  mapSiteVisitFromDto,
  unwrapItem,
  unwrapList,
} from './adapters';

@Injectable({ providedIn: 'root' })
export class SiteVisitService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = inject(API_BASE_URL);

  list(opts?: { systemId?: string; status?: VisitStatus }): Observable<SiteVisit[]> {
    const orgId = this.auth.currentOrgId();
    if (!orgId) return throwError(() => new Error('No active organization'));
    if (environment.useStaticData) return of([]);
    let params = new HttpParams();
    if (opts?.systemId) params = params.set('system_id', opts.systemId);
    if (opts?.status) params = params.set('status', opts.status);
    return this.http
      .get<Envelope<SiteVisitDto[]>>(`${this.base}/organizations/${orgId}/site-visits`, { params })
      .pipe(unwrapList(mapSiteVisitFromDto));
  }

  get(id: string): Observable<SiteVisit> {
    const orgId = this.auth.currentOrgId();
    if (!orgId) return throwError(() => new Error('No active organization'));
    if (environment.useStaticData) return throwError(() => new Error('Site visits unavailable in pilot mode'));
    return this.http
      .get<Envelope<SiteVisitDto>>(`${this.base}/organizations/${orgId}/site-visits/${id}`)
      .pipe(unwrapItem(mapSiteVisitFromDto));
  }
}
