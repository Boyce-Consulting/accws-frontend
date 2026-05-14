import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { TreatmentPlan } from '../models/treatment.model';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from './api.config';
import { environment } from '../../../environments/environment';
import { PilotDataService } from './pilot-data.service';
import {
  Envelope,
  TreatmentPlanDto,
  UpcomingTask,
  UpcomingTaskDto,
  mapTreatmentFromDto,
  mapUpcomingFromDto,
  unwrapItem,
  unwrapList,
} from './adapters';

@Injectable({ providedIn: 'root' })
export class TreatmentService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = inject(API_BASE_URL);
  private pilot = inject(PilotDataService);

  list(opts?: { year?: number; systemId?: string }): Observable<TreatmentPlan[]> {
    const orgId = this.auth.currentOrgId();
    if (!orgId) return throwError(() => new Error('No active organization'));
    if (environment.useStaticData) return this.pilot.listTreatments(orgId, opts);
    let params = new HttpParams();
    if (opts?.year) params = params.set('year', opts.year);
    if (opts?.systemId) params = params.set('system_id', opts.systemId);
    return this.http
      .get<Envelope<TreatmentPlanDto[]>>(`${this.base}/organizations/${orgId}/treatments`, { params })
      .pipe(unwrapList(mapTreatmentFromDto));
  }

  get(id: string): Observable<TreatmentPlan> {
    const orgId = this.auth.currentOrgId();
    if (!orgId) return throwError(() => new Error('No active organization'));
    if (environment.useStaticData) return this.pilot.getTreatment(orgId, id);
    return this.http
      .get<Envelope<TreatmentPlanDto>>(`${this.base}/organizations/${orgId}/treatments/${id}`)
      .pipe(unwrapItem(mapTreatmentFromDto));
  }

  upcoming(month: number, year: number): Observable<UpcomingTask[]> {
    const orgId = this.auth.currentOrgId();
    if (!orgId) return throwError(() => new Error('No active organization'));
    if (environment.useStaticData) return this.pilot.upcoming(orgId, month, year);
    const params = new HttpParams().set('month', month).set('year', year);
    return this.http
      .get<Envelope<UpcomingTaskDto[]>>(
        `${this.base}/organizations/${orgId}/treatments/upcoming`,
        { params },
      )
      .pipe(unwrapList(mapUpcomingFromDto));
  }
}
