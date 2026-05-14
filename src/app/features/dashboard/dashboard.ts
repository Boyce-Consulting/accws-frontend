import { Component, inject, computed, effect, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ReportingService } from '../../core/services/reporting.service';
import { TreatmentService } from '../../core/services/treatment.service';
import { SystemService } from '../../core/services/system.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  ActivityItem,
  AlertItem,
  DashboardSummary,
  UpcomingTask,
} from '../../core/services/adapters';
import { WastewaterSystem } from '../../core/models/system.model';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatCardComponent, PageHeaderComponent, StatusBadgeComponent, TitleCasePipe, DatePipe],
  template: `
    <app-page-header [title]="greeting()" [subtitle]="auth.currentOrg()?.name ?? ''" />

    @if (!auth.currentOrgId()) {
      <div class="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
        Select an organization to view its dashboard.
      </div>
    } @else if (!auth.uiShowsAdmin()) {
      <!-- Client dashboard: upcoming dosing focus -->
      <div class="space-y-6 max-w-3xl">
        @if (nextTask(); as t) {
          <div class="bg-white rounded-xl border-2 border-accent-500 p-6">
            <p class="text-xs uppercase tracking-wider text-accent-700 font-semibold mb-2">Next Treatment</p>
            <h2 class="text-2xl font-bold text-gray-900 mb-1">{{ t.zone }}</h2>
            <p class="text-gray-700 mb-1">
              <span class="font-semibold">{{ t.productName }}</span>
              <span class="text-gray-500"> · {{ t.systemName }}</span>
            </p>
            <p class="text-sm text-gray-600 mb-5">{{ t.quantityLbs }} lbs · {{ t.frequency }} · {{ currentMonthLabel() }}</p>
            <a [routerLink]="['/treatments', t.treatmentPlanId]" [queryParams]="{ start: 1 }"
               class="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors">
              Start Treatment
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        } @else {
          <div class="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
            No treatments scheduled this month.
          </div>
        }

        @if (lastTask(); as t) {
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Last Treatment</p>
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="font-semibold text-gray-900 truncate">{{ t.zone }} — {{ t.productName }}</p>
                <p class="text-sm text-gray-600">{{ t.quantityLbs }} lbs · {{ t.frequency }} · {{ lastMonthLabel() }}</p>
              </div>
              <a [routerLink]="['/treatments', t.treatmentPlanId]"
                 class="shrink-0 text-sm text-accent-600 hover:text-accent-700 font-medium whitespace-nowrap">View details →</a>
            </div>
          </div>
        }

        @if (remainingTasks().length > 0) {
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">Also coming up this month</h3>
            <div class="divide-y divide-gray-100">
              @for (task of remainingTasks(); track task.treatmentPlanId + task.zone + task.productId) {
                <a [routerLink]="['/treatments', task.treatmentPlanId]"
                   class="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ task.zone }} — {{ task.productName }}</p>
                    <p class="text-xs text-gray-500">{{ task.frequency }}</p>
                  </div>
                  <p class="text-sm font-medium text-gray-700 shrink-0">{{ task.quantityLbs }} lbs</p>
                </a>
              }
            </div>
          </div>
        }
      </div>
    } @else if (summary(); as s) {
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Active Systems" [value]="s.systemsTotal" iconBgClass="bg-accent-100 text-accent-600">
          <svg icon class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281" />
          </svg>
        </app-stat-card>
        <app-stat-card label="Active Treatments" [value]="s.treatmentPlansActive" iconBgClass="bg-green-100 text-green-600">
          <svg icon class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </app-stat-card>
        <app-stat-card label="Visits (30d)" [value]="s.visitsLast30Days" iconBgClass="bg-primary-100 text-primary-600">
          <svg icon class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </app-stat-card>
        <app-stat-card label="Open Follow-ups" [value]="s.followUpsOpen" iconBgClass="bg-amber-100 text-amber-600">
          <svg icon class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </app-stat-card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Column 1: System Health -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-gray-900">System Health</h2>
            <a routerLink="/systems" class="text-sm text-accent-600 hover:text-accent-700 font-medium">View all</a>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="text-center p-3 bg-green-50 rounded-lg">
              <p class="text-2xl font-bold text-green-600">{{ s.systemsByStatus['healthy'] || 0 }}</p>
              <p class="text-xs text-green-700 font-medium mt-1">Healthy</p>
            </div>
            <div class="text-center p-3 bg-amber-50 rounded-lg">
              <p class="text-2xl font-bold text-amber-600">{{ s.systemsByStatus['attention'] || 0 }}</p>
              <p class="text-xs text-amber-700 font-medium mt-1">Attention</p>
            </div>
            <div class="text-center p-3 bg-red-50 rounded-lg">
              <p class="text-2xl font-bold text-red-600">{{ s.systemsByStatus['critical'] || 0 }}</p>
              <p class="text-xs text-red-700 font-medium mt-1">Critical</p>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-lg">
              <p class="text-2xl font-bold text-gray-500">{{ s.systemsByStatus['offline'] || 0 }}</p>
              <p class="text-xs text-gray-600 font-medium mt-1">Offline</p>
            </div>
          </div>
          <div class="space-y-2">
            @for (sys of systems(); track sys.id) {
              <a [routerLink]="['/systems', sys.id]" class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-2.5 h-2.5 rounded-full shrink-0" [class]="statusDotClass(sys.status)"></div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ sys.name }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ sys.type | titlecase }} &bull; {{ sys.province }}</p>
                  </div>
                </div>
                <app-status-badge [label]="sys.status | titlecase" [color]="statusColor(sys.status)" />
              </a>
            }
          </div>
        </div>

        <!-- Column 2: What's Coming Up -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-gray-900">What's Coming Up</h2>
            <a routerLink="/treatments" class="text-sm text-accent-600 hover:text-accent-700 font-medium">View all</a>
          </div>
          @if (upcomingTasks().length > 0) {
            <div class="space-y-2">
              @for (task of upcomingTasks(); track task.treatmentPlanId + task.zone + task.productId) {
                <a [routerLink]="['/treatments', task.treatmentPlanId]" class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ task.systemName }} &mdash; {{ task.zone }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ task.productName }}</p>
                  </div>
                  <div class="text-right shrink-0 ml-3">
                    <p class="text-sm font-medium text-gray-700">{{ task.quantityLbs }} lbs</p>
                    <p class="text-xs text-gray-500">{{ task.frequency }}</p>
                  </div>
                </a>
              }
            </div>
          } @else {
            <p class="text-sm text-gray-400 text-center py-4">No upcoming treatments this month</p>
          }
        </div>

        <!-- Column 3: Alerts + Recent Activity -->
        <div class="space-y-6">
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h2 class="text-base font-semibold text-gray-900 mb-4">Alerts</h2>
            <div class="space-y-3">
              @for (alert of alerts(); track alert.id) {
                <div class="flex items-start gap-3 p-3 rounded-lg" [class]="alertBgClass(alert.level)">
                  <div>
                    <p class="text-sm text-gray-800 font-medium">{{ alert.title }}</p>
                    @if (alert.detail) { <p class="text-xs text-gray-600 mt-0.5">{{ alert.detail }}</p> }
                    <p class="text-xs text-gray-500 mt-1">{{ alert.timestamp | date:'mediumDate' }}</p>
                  </div>
                </div>
              } @empty {
                <p class="text-sm text-gray-400 text-center py-4">No alerts</p>
              }
            </div>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h2 class="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div class="space-y-4">
              @for (item of activity(); track item.id) {
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gray-100 text-gray-600">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm text-gray-800">{{ item.title }}</p>
                    @if (item.detail) { <p class="text-xs text-gray-500">{{ item.detail }}</p> }
                    <p class="text-xs text-gray-500 mt-0.5">{{ item.timestamp | date:'short' }}</p>
                  </div>
                </div>
              } @empty {
                <p class="text-sm text-gray-400 text-center py-4">No recent activity</p>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardComponent {
  auth = inject(AuthService);
  private reporting = inject(ReportingService);
  private treatmentService = inject(TreatmentService);
  private systemService = inject(SystemService);

  summary = signal<DashboardSummary | null>(null);
  activity = signal<ActivityItem[]>([]);
  alerts = signal<AlertItem[]>([]);
  upcomingTasks = signal<UpcomingTask[]>([]);
  lastMonthTasks = signal<UpcomingTask[]>([]);
  systems = signal<WastewaterSystem[]>([]);

  greeting = computed(() => {
    const name = this.auth.currentUser()?.name?.split(' ')[0] ?? '';
    return name ? `Welcome back, ${name}` : 'Welcome back';
  });

  nextTask = computed(() => this.upcomingTasks()[0] ?? null);
  remainingTasks = computed(() => this.upcomingTasks().slice(1));
  lastTask = computed(() => this.lastMonthTasks()[0] ?? null);

  private monthName(month: number): string {
    return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' });
  }
  currentMonthLabel = computed(() => {
    const now = new Date();
    return `${this.monthName(now.getMonth() + 1)} ${now.getFullYear()}`;
  });
  lastMonthLabel = computed(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${this.monthName(prev.getMonth() + 1)} ${prev.getFullYear()}`;
  });

  constructor() {
    effect(() => {
      const orgId = this.auth.currentOrgId();
      if (!orgId) {
        this.summary.set(null);
        this.activity.set([]);
        this.alerts.set([]);
        this.upcomingTasks.set([]);
        this.lastMonthTasks.set([]);
        this.systems.set([]);
        return;
      }
      this.reporting.dashboard().subscribe({ next: (s) => this.summary.set(s) });
      this.reporting.activity(10).subscribe({ next: (a) => this.activity.set(a) });
      this.reporting.alerts().subscribe({ next: (a) => this.alerts.set(a) });
      this.systemService.list().subscribe({
        next: (list) => this.systems.set(list.slice(0, 8)),
      });
      const now = new Date();
      this.treatmentService.upcoming(now.getMonth() + 1, now.getFullYear()).subscribe({
        next: (tasks) => this.upcomingTasks.set(tasks.slice(0, 6)),
      });
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      this.treatmentService.upcoming(prev.getMonth() + 1, prev.getFullYear()).subscribe({
        next: (tasks) => this.lastMonthTasks.set(tasks),
      });
    });
  }

  statusDotClass(status: string): string {
    const m: Record<string, string> = {
      healthy: 'bg-green-500',
      attention: 'bg-amber-500',
      critical: 'bg-red-500',
      offline: 'bg-gray-400',
    };
    return m[status] ?? 'bg-gray-400';
  }

  statusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' {
    const m: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
      healthy: 'green',
      attention: 'yellow',
      critical: 'red',
      offline: 'gray',
    };
    return m[status] ?? 'gray';
  }

  alertBgClass(level: string): string {
    return level === 'critical' ? 'bg-red-50' : 'bg-amber-50';
  }
}
