import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { SampleRecord } from '../models/sampling.model';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from './api.config';
import { environment } from '../../../environments/environment';
import { PilotDataService } from './pilot-data.service';
import { Envelope, SampleDto, mapSampleFromDto, unwrapList } from './adapters';

@Injectable({ providedIn: 'root' })
export class SamplingService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = inject(API_BASE_URL);
  private pilot = inject(PilotDataService);

  list(opts?: { systemId?: string; type?: 'effluent' | 'sludge' | 'influent' }): Observable<SampleRecord[]> {
    const orgId = this.auth.currentOrgId();
    if (!orgId) return throwError(() => new Error('No active organization'));
    if (environment.useStaticData) return this.pilot.listSamples(orgId, opts);
    let params = new HttpParams();
    if (opts?.systemId) params = params.set('system_id', opts.systemId);
    if (opts?.type) params = params.set('type', opts.type);
    return this.http
      .get<Envelope<SampleDto[]>>(`${this.base}/organizations/${orgId}/sampling`, { params })
      .pipe(unwrapList(mapSampleFromDto));
  }
}
