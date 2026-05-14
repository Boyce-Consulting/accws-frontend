import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product, ProductCategory } from '../models/product.model';
import { API_BASE_URL } from './api.config';
import { environment } from '../../../environments/environment';
import { PilotDataService } from './pilot-data.service';
import { Envelope, ProductDto, mapProductFromDto, unwrapItem, unwrapList } from './adapters';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private base = inject(API_BASE_URL);
  private pilot = inject(PilotDataService);

  list(category?: ProductCategory): Observable<Product[]> {
    if (environment.useStaticData) return this.pilot.listProducts(category);
    const params = category ? new HttpParams().set('category', category) : undefined;
    return this.http
      .get<Envelope<ProductDto[]>>(`${this.base}/products`, { params })
      .pipe(unwrapList(mapProductFromDto));
  }

  get(id: string): Observable<Product> {
    if (environment.useStaticData) return this.pilot.getProduct(id);
    return this.http
      .get<Envelope<ProductDto>>(`${this.base}/products/${id}`)
      .pipe(unwrapItem(mapProductFromDto));
  }

  /** Admin-only: create a product. */
  create(body: {
    name: string;
    category: ProductCategory;
    description: string;
    unit: string;
    price_cents: number;
    active_ingredient?: string;
    applications: string[];
    temperature_range?: string;
    image_url?: string;
  }): Observable<Product> {
    return this.http
      .post<Envelope<ProductDto>>(`${this.base}/admin/products`, body)
      .pipe(unwrapItem(mapProductFromDto));
  }

  /** Admin-only: update a product. */
  update(
    id: string,
    body: Partial<{
      name: string;
      category: ProductCategory;
      description: string;
      unit: string;
      price_cents: number;
      active_ingredient: string;
      applications: string[];
      temperature_range: string;
      image_url: string;
    }>,
  ): Observable<Product> {
    return this.http
      .patch<Envelope<ProductDto>>(`${this.base}/admin/products/${id}`, body)
      .pipe(unwrapItem(mapProductFromDto));
  }

  /** Admin-only: delete a product. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/products/${id}`);
  }
}
