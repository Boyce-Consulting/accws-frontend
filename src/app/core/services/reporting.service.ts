import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from './api.config';
import { environment } from '../../../environments/environment';
import { PilotDataService } from './pilot-data.service';
import {
  ActivityItem,
  ActivityItemDto,
  AlertItem,
  AlertItemDto,
  DashboardSummary,
  DashboardSummaryDto,
  Envelope,
  mapActivityFromDto,
  mapAlertFromDto,
  mapDashboardFromDto,
  unwrapItem,
  unwrapList,
} from './adapters';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = inject(API_BASE_URL);
  private pilot = inject(PilotDataService);

  private scopedUrl(path: string): string | null {
    const id = this.auth.currentOrgId();
    return id ? `${this.base}/organizations/${id}/reporting/${path}` : null;
  }

  dashboard(): Observable<DashboardSummary> {
    if (environment.useStaticData) return this.staticDashboard();
    const url = this.scopedUrl('dashboard');
    if (!url) return throwError(() => new Error('No active organization'));
    return this.http
      .get<Envelope<DashboardSummaryDto>>(url)
      .pipe(unwrapItem(mapDashboardFromDto));
  }

  activity(limit = 10): Observable<ActivityItem[]> {
    if (environment.useStaticData) return of([]);
    const url = this.scopedUrl('activity');
    if (!url) return throwError(() => new Error('No active organization'));
    return this.http
      .get<Envelope<ActivityItemDto[]>>(`${url}?limit=${limit}`)
      .pipe(unwrapList(mapActivityFromDto));
  }

  alerts(): Observable<AlertItem[]> {
    if (environment.useStaticData) return of([]);
    const url = this.scopedUrl('alerts');
    if (!url) return throwError(() => new Error('No active organization'));
    return this.http.get<Envelope<AlertItemDto[]>>(url).pipe(unwrapList(mapAlertFromDto));
  }

  private staticDashboard(): Observable<DashboardSummary> {
    const orgId = this.auth.currentOrgId();
    if (!orgId) return throwError(() => new Error('No active organization'));
    return forkJoin({
      systems: this.pilot.listSystems(orgId),
      treatments: this.pilot.listTreatments(orgId),
      samples: this.pilot.listSamples(orgId),
    }).pipe(
      map(({ systems, treatments, samples }) => {
        const byStatus: Record<string, number> = {
          healthy: 0,
          attention: 0,
          critical: 0,
          offline: 0,
        };
        for (const s of systems) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
        return {
          systemsTotal: systems.length,
          systemsByStatus: byStatus,
          treatmentPlansActive: treatments.filter((t) => t.status === 'active' || t.status === 'draft').length,
          visitsLast30Days: 0,
          samplesLast30Days: samples.length,
          followUpsOpen: 0,
        };
      }),
    );
  }
}
