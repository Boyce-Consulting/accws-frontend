import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay, throwError } from 'rxjs';
import { Organization } from '../models/organization.model';
import { Cell, WastewaterSystem } from '../models/system.model';
import { DosingSchedule, TreatmentPlan } from '../models/treatment.model';
import { EffluentParameters, SampleRecord, SludgeSurvey } from '../models/sampling.model';
import { Product, ProductCategory } from '../models/product.model';
import { UpcomingTask } from './adapters';

interface PilotProduct {
  sku: string;
  name: string;
  category: string;
  season: string;
  form: string;
  description: string;
}

interface PilotCell {
  name: string;
  area_acres?: number;
  area_m2?: number;
  volume_m3?: number;
  function: Cell['function'];
  retention_days?: number;
  sludge_volume_m3?: number;
  notes?: string;
}

interface PilotSystem {
  slug: string;
  name: string;
  type: string;
  status: string;
  population?: number;
  flow_m3_per_day?: number;
  commissioned_year?: number;
  cells?: PilotCell[];
  notes?: string;
}

interface PilotEffluentSample {
  date: string;
  type: 'effluent' | 'influent' | 'sludge';
  ph?: number;
  tss?: number;
  bod?: number;
  cbod?: number | null;
  cod?: number;
  ammonia_total?: number;
  ammonia_unionized?: number;
  nitrogen_total?: number;
  phosphorus_total?: number;
  notes?: string;
}

interface PilotSludgeSurvey {
  cell?: string;
  year?: number;
  volume_m3?: number;
}

interface PilotDosingSchedule {
  zone: string;
  product_sku: string;
  quantity_lbs?: number;
  quantity_liters?: number;
  quantity_ml?: number;
  quantity_gallons?: number;
  quantity_units?: number;
  frequency: string;
  months: number[];
  notes?: string;
}

interface PilotTier {
  name: string;
  dosing_schedules?: PilotDosingSchedule[];
  pricing?: Array<{ description: string; unit_price: number; qty: number; subtotal: number }>;
  subtotal?: number;
  gst?: number;
  total?: number;
  currency?: string;
}

interface PilotTreatmentPlan {
  slug: string;
  system_slug: string;
  year: number;
  status: TreatmentPlan['status'];
  prepared_for?: string;
  prepared_by?: string;
  plan_date?: string;
  executive_summary?: string;
  objectives?: string[];
  effluent_samples?: PilotEffluentSample[];
  sludge_surveys?: PilotSludgeSurvey[];
  tiers?: PilotTier[];
}

interface PilotOrganization {
  slug: string;
  name: string;
  type: Organization['type'];
  status: Organization['status'];
  province?: string;
  contact_name?: string;
  systems?: PilotSystem[];
  treatment_plans?: PilotTreatmentPlan[];
}

interface PilotDataset {
  $schema_version: string;
  generated_at: string;
  products: PilotProduct[];
  organizations: PilotOrganization[];
}

const PRODUCT_CATEGORY_MAP: Record<string, ProductCategory> = {
  'sludge-reduction': 'carbon-oxygen',
  'bioaugmentation': 'cold-weather',
  'oxygenation': 'carbon-oxygen',
  'enzyme': 'specialty',
  'lift-station': 'collection-odor',
  'polishing': 'specialty',
  'equipment': 'specialty',
};

const SYSTEM_TYPE_MAP: Record<string, WastewaterSystem['type']> = {
  'lagoon': 'lagoon',
  'lift-station': 'lift-station',
  'wwtp': 'wwtp',
};

const SYSTEM_STATUS_MAP: Record<string, WastewaterSystem['status']> = {
  'healthy': 'healthy',
  'attention': 'attention',
  'critical': 'critical',
  'offline': 'offline',
};

@Injectable({ providedIn: 'root' })
export class PilotDataService {
  private http = inject(HttpClient);
  private dataset$?: Observable<PilotDataset>;

  load(): Observable<PilotDataset> {
    if (!this.dataset$) {
      this.dataset$ = this.http
        .get<PilotDataset>('/data/pilot-testers.json')
        .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.dataset$;
  }

  // ---------- Organizations ----------

  listOrganizations(): Observable<Organization[]> {
    return this.load().pipe(
      map((ds) => ds.organizations.map((o) => mapOrg(o))),
    );
  }

  getOrganization(id: string): Observable<Organization> {
    return this.load().pipe(
      map((ds) => {
        const o = ds.organizations.find((x) => x.slug === id);
        if (!o) throw new Error(`Organization not found: ${id}`);
        return mapOrg(o);
      }),
    );
  }

  // ---------- Systems ----------

  listSystems(orgId: string): Observable<WastewaterSystem[]> {
    return this.load().pipe(
      map((ds) => {
        const o = ds.organizations.find((x) => x.slug === orgId);
        return (o?.systems ?? []).map((s) => mapSystem(s, orgId, o!.province));
      }),
    );
  }

  getSystem(orgId: string, systemId: string): Observable<WastewaterSystem> {
    return this.load().pipe(
      map((ds) => {
        const o = ds.organizations.find((x) => x.slug === orgId);
        const s = o?.systems?.find((x) => x.slug === systemId);
        if (!o || !s) throw new Error(`System not found: ${orgId}/${systemId}`);
        return mapSystem(s, orgId, o.province);
      }),
    );
  }

  // ---------- Treatments ----------

  listTreatments(
    orgId: string,
    opts?: { year?: number; systemId?: string },
  ): Observable<TreatmentPlan[]> {
    return this.load().pipe(
      map((ds) => {
        const o = ds.organizations.find((x) => x.slug === orgId);
        if (!o) return [];
        const productByName = productLookupByName(ds.products);
        let plans = (o.treatment_plans ?? []).map((p) => mapPlan(p, orgId, productByName));
        if (opts?.year) plans = plans.filter((p) => p.year === opts.year);
        if (opts?.systemId) plans = plans.filter((p) => p.systemId === opts.systemId);
        return plans;
      }),
    );
  }

  getTreatment(orgId: string, id: string): Observable<TreatmentPlan> {
    return this.load().pipe(
      map((ds) => {
        const o = ds.organizations.find((x) => x.slug === orgId);
        const p = o?.treatment_plans?.find((x) => x.slug === id);
        if (!o || !p) throw new Error(`Treatment plan not found: ${orgId}/${id}`);
        return mapPlan(p, orgId, productLookupByName(ds.products));
      }),
    );
  }

  upcoming(orgId: string, month: number, _year: number): Observable<UpcomingTask[]> {
    return this.load().pipe(
      map((ds) => {
        const o = ds.organizations.find((x) => x.slug === orgId);
        if (!o) return [];
        const productByName = productLookupByName(ds.products);
        const tasks: UpcomingTask[] = [];
        for (const p of o.treatment_plans ?? []) {
          const sys = o.systems?.find((s) => s.slug === p.system_slug);
          const recommended = (p.tiers ?? []).find((t) => t.name === 'recommended') ?? p.tiers?.[0];
          for (const d of recommended?.dosing_schedules ?? []) {
            if (!d.months.includes(month)) continue;
            tasks.push({
              treatmentPlanId: p.slug,
              systemId: p.system_slug,
              systemName: sys?.name ?? p.system_slug,
              zone: d.zone,
              productId: d.product_sku,
              productName: productByName.get(d.product_sku)?.name ?? d.product_sku,
              quantityLbs: dosingQuantityLbs(d),
              frequency: d.frequency,
            });
          }
        }
        return tasks;
      }),
    );
  }

  // ---------- Sampling ----------

  listSamples(
    orgId: string,
    opts?: { systemId?: string; type?: SampleRecord['type'] },
  ): Observable<SampleRecord[]> {
    return this.load().pipe(
      map((ds) => {
        const o = ds.organizations.find((x) => x.slug === orgId);
        if (!o) return [];
        const out: SampleRecord[] = [];
        for (const p of o.treatment_plans ?? []) {
          if (opts?.systemId && p.system_slug !== opts.systemId) continue;
          const sys = o.systems?.find((s) => s.slug === p.system_slug);
          (p.effluent_samples ?? []).forEach((s, i) => {
            if (opts?.type && s.type !== opts.type) return;
            out.push(mapSample(s, p, i));
          });
          (p.sludge_surveys ?? []).forEach((ss, i) => {
            if (opts?.type && opts.type !== 'sludge') return;
            out.push(mapSludgeAsSample(ss, p, sys, i));
          });
        }
        return out;
      }),
    );
  }

  // ---------- Products ----------

  listProducts(category?: ProductCategory): Observable<Product[]> {
    return this.load().pipe(
      map((ds) => {
        const all = ds.products.map(mapProduct);
        return category ? all.filter((p) => p.category === category) : all;
      }),
    );
  }

  getProduct(id: string): Observable<Product> {
    return this.load().pipe(
      map((ds) => {
        const p = ds.products.find((x) => x.sku === id);
        if (!p) throw new Error(`Product not found: ${id}`);
        return mapProduct(p);
      }),
    );
  }

  // ---------- Static-mode helpers consumed by AuthService ----------

  /** Returns a synthetic membership list built from the JSON's organizations. */
  pilotMemberships(): Observable<Array<{ id: string; name: string; slug: string; role: 'owner' }>> {
    return this.load().pipe(
      map((ds) =>
        ds.organizations.map((o) => ({ id: o.slug, name: o.name, slug: o.slug, role: 'owner' as const })),
      ),
    );
  }
}

// ----------------- mappers -----------------

function mapOrg(o: PilotOrganization): Organization {
  return {
    id: o.slug,
    slug: o.slug,
    name: o.name,
    type: o.type,
    status: o.status,
    contactName: o.contact_name,
    province: o.province,
  };
}

function mapSystem(s: PilotSystem, orgSlug: string, province?: string): WastewaterSystem {
  return {
    id: s.slug,
    clientId: orgSlug,
    name: s.name,
    type: SYSTEM_TYPE_MAP[s.type] ?? 'lagoon',
    status: SYSTEM_STATUS_MAP[s.status] ?? 'attention',
    location: { lat: 0, lng: 0 },
    province: province ?? '',
    commissioned: s.commissioned_year,
    population: s.population,
    flowRate: s.flow_m3_per_day,
    cells: (s.cells ?? []).map((c, i) => mapCell(c, s.slug, i)),
    description: s.notes,
  };
}

function mapCell(c: PilotCell, systemSlug: string, idx: number): Cell {
  return {
    id: `${systemSlug}-cell-${idx}`,
    name: c.name,
    areaAcres: c.area_acres ?? 0,
    areaM2: c.area_m2 ?? 0,
    volumeM3: c.volume_m3 ?? 0,
    function: c.function,
    retentionTimeDays: c.retention_days,
    sludgeVolumeM3: c.sludge_volume_m3,
  };
}

function mapPlan(
  p: PilotTreatmentPlan,
  orgSlug: string,
  productByName: Map<string, PilotProduct>,
): TreatmentPlan {
  const recommended = (p.tiers ?? []).find((t) => t.name === 'recommended') ?? p.tiers?.[0];
  const dosingSchedules: DosingSchedule[] = (recommended?.dosing_schedules ?? []).map((d, i) => ({
    id: `${p.slug}-dose-${i}`,
    zone: d.zone,
    productId: d.product_sku,
    productName: productByName.get(d.product_sku)?.name ?? d.product_sku,
    quantityLbs: dosingQuantityLbs(d),
    frequency: d.frequency,
    months: d.months,
    notes: d.notes,
  }));

  return {
    id: p.slug,
    systemId: p.system_slug,
    clientId: orgSlug,
    year: p.year,
    status: p.status,
    dosingSchedules,
    totalCost: recommended?.total,
    createdAt: p.plan_date ?? `${p.year}-01-01`,
  };
}

function mapSample(s: PilotEffluentSample, plan: PilotTreatmentPlan, idx: number): SampleRecord {
  const params: EffluentParameters = {
    bod: s.bod ?? s.cbod ?? undefined,
    tss: s.tss,
    ammonia: s.ammonia_total,
    phosphorus: s.phosphorus_total,
    cod: s.cod,
    ph: s.ph,
  };
  return {
    id: `${plan.slug}-sample-${idx}`,
    systemId: plan.system_slug,
    date: s.date,
    type: s.type,
    parameters: params,
    notes: s.notes,
  };
}

function mapSludgeAsSample(
  ss: PilotSludgeSurvey,
  plan: PilotTreatmentPlan,
  sys: PilotSystem | undefined,
  idx: number,
): SampleRecord {
  const survey: SludgeSurvey = {
    cellId: ss.cell ? `${plan.system_slug}-cell-${(sys?.cells ?? []).findIndex((c) => c.name === ss.cell)}` : '',
    cellName: ss.cell ?? '',
    year: ss.year ?? 0,
    volumeM3: ss.volume_m3 ?? 0,
  };
  return {
    id: `${plan.slug}-sludge-${idx}`,
    systemId: plan.system_slug,
    date: ss.year ? `${ss.year}-06-01` : `${plan.year}-06-01`,
    type: 'sludge',
    parameters: {},
    sludgeSurvey: survey,
  };
}

function mapProduct(p: PilotProduct): Product {
  return {
    id: p.sku,
    name: p.name,
    category: PRODUCT_CATEGORY_MAP[p.category] ?? 'specialty',
    description: p.description,
    unit: p.form,
    price: 0,
    applications: [],
    temperatureRange: p.season,
  };
}

function productLookupByName(products: PilotProduct[]): Map<string, PilotProduct> {
  return new Map(products.map((p) => [p.sku, p]));
}

function dosingQuantityLbs(d: PilotDosingSchedule): number {
  return (
    d.quantity_lbs ??
    d.quantity_liters ??
    d.quantity_gallons ??
    d.quantity_ml ??
    d.quantity_units ??
    0
  );
}

// Re-export for convenience in services
export { of, throwError };
