import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Organization } from '../models/organization.model';
import { API_BASE_URL } from './api.config';
import { environment } from '../../../environments/environment';
import { PilotDataService } from './pilot-data.service';
import {
  Envelope,
  OrganizationDto,
  mapOrganizationFromDto,
  unwrapItem,
  unwrapList,
} from './adapters';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private http = inject(HttpClient);
  private base = inject(API_BASE_URL);
  private pilot = inject(PilotDataService);

  /** Memberships for the authenticated user. */
  list(): Observable<Organization[]> {
    if (environment.useStaticData) return this.pilot.listOrganizations();
    return this.http
      .get<Envelope<OrganizationDto[]>>(`${this.base}/organizations`)
      .pipe(unwrapList(mapOrganizationFromDto));
  }

  get(id: string): Observable<Organization> {
    if (environment.useStaticData) return this.pilot.getOrganization(id);
    return this.http
      .get<Envelope<OrganizationDto>>(`${this.base}/organizations/${id}`)
      .pipe(unwrapItem(mapOrganizationFromDto));
  }

  /** Admin-only: every org in the system. */
  listAdmin(): Observable<Organization[]> {
    if (environment.useStaticData) return this.pilot.listOrganizations();
    return this.http
      .get<Envelope<OrganizationDto[]>>(`${this.base}/admin/organizations`)
      .pipe(unwrapList(mapOrganizationFromDto));
  }

  /** Admin-only: create an org. */
  create(body: { name: string; slug?: string }): Observable<Organization> {
    return this.http
      .post<Envelope<OrganizationDto>>(`${this.base}/admin/organizations`, body)
      .pipe(unwrapItem(mapOrganizationFromDto));
  }

  /** Admin-only: update an org. */
  update(
    id: string,
    body: Partial<{
      name: string;
      slug: string;
      type: string;
      status: string;
      contact_name: string;
      contact_email: string;
      contact_phone: string;
      address: string;
      province: string;
      notes: string;
    }>,
  ): Observable<Organization> {
    return this.http
      .patch<Envelope<OrganizationDto>>(`${this.base}/admin/organizations/${id}`, body)
      .pipe(unwrapItem(mapOrganizationFromDto));
  }

  /** Admin-only: delete an org (cascades). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/organizations/${id}`);
  }

  /**
   * List members of an organization. Backend endpoint TBD — expected shape:
   *   GET /api/organizations/{orgId}/members
   *   → { data: [{ id, name, email, role, joined_at }] }
   * Returns [] on 404/405 so the UI can render a graceful placeholder.
   */
  listMembers(orgId?: string): Observable<OrganizationMember[]> {
    const id = orgId ?? '';
    if (!id) return of([]);
    if (environment.useStaticData) return of([]);
    return this.http
      .get<Envelope<OrganizationMemberDto[]>>(`${this.base}/organizations/${id}/members`)
      .pipe(
        map((r) => r.data.map(mapOrganizationMemberFromDto)),
        catchError(() => of([] as OrganizationMember[])),
      );
  }
}

interface OrganizationMemberDto {
  id: number | string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joined_at?: string;
  avatar_url?: string | null;
  is_admin?: boolean;
}

export interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt?: string;
  avatarUrl?: string;
  isSystemAdmin?: boolean;
}

function mapOrganizationMemberFromDto(dto: OrganizationMemberDto): OrganizationMember {
  return {
    id: String(dto.id),
    name: dto.name,
    email: dto.email,
    role: dto.role,
    joinedAt: dto.joined_at,
    avatarUrl: dto.avatar_url ?? undefined,
    isSystemAdmin: dto.is_admin,
  };
}
