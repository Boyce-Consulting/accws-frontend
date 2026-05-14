import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string; // SVG path d attribute
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

// Shared icon paths
const ICONS = {
  dashboard: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  map: 'M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z',
  clients: 'M18 18.72a9.094 9.094 0 0 0 3.741-2.106 9.093 9.093 0 0 0-3.741-2.106m0 4.212a9.12 9.12 0 0 1-.162-.034m.162.034a9.025 9.025 0 0 1-3.84-.778m3.84.778-1.14-3.422a9.003 9.003 0 0 0-3.18-4.074M18 18.72A9.118 9.118 0 0 0 21 12c0-4.97-4.03-9-9-9s-9 4.03-9 9a9.118 9.118 0 0 0 3 6.72m0 0a9.025 9.025 0 0 0 3.84.778M6 18.72l1.14-3.422a9.003 9.003 0 0 1 3.18-4.074M12 6.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Z',
  systems: 'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.653-4.655m5.976-.814L17.09 8.03c.252-.504.307-1.085.168-1.633a3.776 3.776 0 0 0-.84-1.68L12.2 0 8.065 4.134a3.78 3.78 0 0 0-.84 1.68 1.886 1.886 0 0 0 .168 1.633l2.28 3.764',
  siteVisits: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z',
  sampling: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
  treatments: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  proposals: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  reports: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  account: 'M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="fixed left-0 top-0 bottom-0 w-64 bg-primary-800 text-white flex flex-col z-40">
      <!-- Logo -->
      <div class="h-14 flex items-center px-5 border-b border-primary-700">
        <img src="logo-white.png" alt="ACCWS" class="h-7 w-auto" />
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-4 px-3">
        @for (section of navSections; track section.heading) {
          <div class="mb-4">
            @if (section.heading) {
              <h3 class="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-400">{{ section.heading }}</h3>
            }
            <ul class="space-y-0.5">
              @for (item of section.items; track item.route) {
                <li>
                  <a
                    [routerLink]="item.route"
                    routerLinkActive="bg-primary-700/60 text-white"
                    [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
                    class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-200 hover:bg-primary-700/40 hover:text-white transition-colors">
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
                    </svg>
                    {{ item.label }}
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>

      <!-- View-as-client toggle (admin-only) -->
      @if (auth.isAdmin()) {
        <div class="px-4 py-2 border-t border-primary-700">
          @if (auth.viewAsClient()) {
            <button (click)="auth.setViewAsClient(false)"
              class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-medium hover:bg-amber-500/30 transition-colors">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Viewing as client — Exit
            </button>
          } @else {
            <button (click)="auth.setViewAsClient(true)"
              class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-700/50 hover:bg-primary-700/70 text-primary-200 hover:text-white text-xs font-medium transition-colors">
              View as client
            </button>
          }
        </div>
      }

      <!-- User section at bottom — click to open /account -->
      <a routerLink="/account"
        class="p-4 border-t border-primary-700 flex items-center gap-3 hover:bg-primary-700/40 transition-colors cursor-pointer">
        <div class="w-8 h-8 bg-accent-500 rounded-full flex items-center justify-center text-xs font-semibold">
          {{ getInitials() }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ auth.currentUser()?.name }}</p>
          <p class="text-xs text-primary-300 truncate">
            @if (auth.viewAsClient()) { Admin (viewing as client) }
            @else if (auth.isAdmin()) { Administrator }
            @else { Client }
          </p>
        </div>
      </a>
    </aside>
  `,
})
export class SidebarComponent {
  auth = inject(AuthService);

  private adminSections: NavSection[] = [
    {
      heading: 'Operations',
      items: [
        { label: 'Dashboard', route: '/dashboard', icon: ICONS.dashboard },
        { label: 'Map', route: '/map', icon: ICONS.map },
        { label: 'Organizations', route: '/organizations', icon: ICONS.clients },
      ],
    },
    {
      heading: 'Field Work',
      items: [
        { label: 'Site Visits', route: '/site-visits', icon: ICONS.siteVisits },
        { label: 'Sampling', route: '/sampling', icon: ICONS.sampling },
        { label: 'Treatments', route: '/treatments', icon: ICONS.treatments },
      ],
    },
    {
      heading: 'Catalog',
      items: [
        { label: 'Systems', route: '/systems', icon: ICONS.systems },
        { label: 'Products', route: '/products', icon: ICONS.treatments },
      ],
    },
    {
      heading: 'Organization',
      items: [
        { label: 'People', route: '/people', icon: ICONS.clients },
        { label: 'Reports', route: '/reports', icon: ICONS.reports },
      ],
    },
    {
      heading: 'ACCWS',
      items: [
        { label: 'Overview', route: '/admin/overview', icon: ICONS.dashboard },
        { label: 'System Admins', route: '/admin/system-admins', icon: ICONS.clients },
      ],
    },
  ];

  private clientSections: NavSection[] = [
    {
      heading: '',
      items: [
        { label: 'Dashboard', route: '/dashboard', icon: ICONS.dashboard },
        { label: 'Treatments', route: '/treatments', icon: ICONS.treatments },
      ],
    },
    {
      heading: 'Collect Data',
      items: [
        { label: 'Sampling', route: '/sampling', icon: ICONS.sampling },
        { label: 'Site Visits', route: '/site-visits', icon: ICONS.siteVisits },
      ],
    },
    {
      heading: 'Reference',
      items: [
        { label: 'Products', route: '/products', icon: ICONS.treatments },
      ],
    },
  ];

  get navSections(): NavSection[] {
    return this.auth.uiShowsAdmin() ? this.adminSections : this.clientSections;
  }

  getInitials(): string {
    const name = this.auth.currentUser()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
