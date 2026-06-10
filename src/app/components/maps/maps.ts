import { Component, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import PocketBase, { RecordModel } from 'pocketbase';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { CommonModule } from '@angular/common';
import { GlobalService } from '../../services/global.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
@Component({
  selector: 'app-maps',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maps.html',
  styleUrl: './maps.scss',
})
export class Maps implements AfterViewInit, OnDestroy {

  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef;

  private map!: mapboxgl.Map;

  private pb = new PocketBase('https://db.ongomatch.com:8090');

  private markers: Map<string, mapboxgl.Marker> = new Map();

  totalActiveUsers = 0;
  activeUsersPreview: any[] = [];
  extraUsers = 0;

  matchesNow = 0;
  newUsers = 0;
  viewsToday = 0;

  userLat: number | null = null;
  userLng: number | null = null;

  locales: any[] = [];
  nearbyUsers: any[] = [];
  personas: any[] = [];       // usuariosClient
  nearbyLocales: any[] = [];  // locales cercanos
  constructor(
    public global: GlobalService,
    public router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {

    window.addEventListener('resize', () => {

      if (this.map) {
        this.map.resize();
      }

    });

  }

  async ngAfterViewInit() {

    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,

      style: 'mapbox://styles/mapbox/dark-v11',

      // 🌍 Vista mundial inicial
      center: [0, 20],

      // 🌍 Zoom mundial
      zoom: 1.3,

      accessToken: environment.MAPBOX_PUBLIC_TOKEN,

      attributionControl: false
    });

    // 🔲 Fullscreen
    this.map.addControl(
      new mapboxgl.FullscreenControl()
    );

    // 🧭 Navegación
    this.map.addControl(
      new mapboxgl.NavigationControl()
    );

    // 📍 Geolocalización
    this.map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true,
      })
    );

    // 🔎 Buscador
    const geocoder = new MapboxGeocoder({
      accessToken: environment.MAPBOX_PUBLIC_TOKEN,
      mapboxgl,
      marker: false,
      placeholder: 'Buscar lugar'
    });

    this.map.addControl(geocoder, 'top-left');

    geocoder.on('result', e => {

      const [lng, lat] = e.result.center as [number, number];

      this.map.flyTo({
        center: [lng, lat],
        zoom: 14,
        speed: 0.8,
        essential: true
      });

    });

    // 🚀 Cuando el mapa carga
    this.map.on('load', async () => {

      this.map.resize();

      await Promise.all([
        this.cargarLocales(),
        this.cargarPersonas()
      ]);

      navigator.geolocation.getCurrentPosition(
        position => {

          const userLng = position.coords.longitude;
          const userLat = position.coords.latitude;

          this.userLng = userLng;
          this.userLat = userLat;

          this.actualizarStatsMapa();
          this.cdr.detectChanges();

          new mapboxgl.Marker({
            color: '#f70192'
          })
            .setLngLat([userLng, userLat])
            .setPopup(
              new mapboxgl.Popup().setHTML(`
            <strong>Tu ubicación</strong>
          `)
            )
            .addTo(this.map);

          this.map.flyTo({
            center: [userLng, userLat],
            zoom: 12,
            speed: 0.8,
            curve: 1.4,
            essential: true
          });

        },
        error => {
          console.warn('No se pudo obtener ubicación', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000
        }
      );

    });
    // 🔄 Tiempo real
    this.pb.collection('usuariosPartner')
      .subscribe('*', e => {
        this.actualizarMarcadores(e.record);
      });

  }
  async cargarPersonas() {
    try {
      const personas = await this.pb
        .collection('usuariosClient')
        .getFullList({
          sort: '-created'
        });

      this.personas = personas;

      this.actualizarStatsMapa();
      this.cdr.detectChanges();

    } catch (error) {
      console.error('Error cargando personas:', error);
    }
  }
  // ============================================
  // 📍 CARGAR LOCALES
  // ============================================

  async cargarLocales() {
    try {
      const locales = await this.pb
        .collection('usuariosPartner')
        .getFullList({
          sort: '-created'
        });

      this.locales = locales;

      locales.forEach((local: any) => {
        this.agregarMarcador(local);
      });

      this.actualizarStatsMapa();
      this.cdr.detectChanges();

    } catch (error) {
      console.error('Error cargando locales:', error);
    }
  }

  // ============================================
  // 📍 AGREGAR MARCADOR
  // ============================================

  agregarMarcador(local: RecordModel) {

    const lat = parseFloat(local['lat']);
    const lng = parseFloat(local['lng']);

    if (isNaN(lat) || isNaN(lng)) return;

    // 🖼 Avatar
    const avatarUrl = local['avatar']
      ? this.pb.files.getUrl(local, local['avatar'])
      : 'https://via.placeholder.com/70x70?text=Sin+foto';

    // 🎯 Contenedor marker
    const el = document.createElement('div');

    el.className = 'custom-marker';

    // 🖼 Imagen
    const img = document.createElement('img');

    img.src = avatarUrl;

    img.alt = local['venueName'] || 'Local';

    img.className = 'animated-avatar-hover';

    img.style.width = '40px';
    img.style.height = '40px';
    img.style.borderRadius = '50%';
    img.style.objectFit = 'cover';
    img.style.border = '2px solid white';
    img.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';

    el.appendChild(img);

    // 📍 Marker
    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])

      .setPopup(

        new mapboxgl.Popup().setHTML(`

          <div class="popup-content text-center" style="min-width:220px;">

            <img
              src="${avatarUrl}"
              alt="${local['venueName'] || 'Local'}"
              style="
                width:70px;
                height:70px;
                border-radius:50%;
                object-fit:cover;
                border:2px solid #f70192;
                margin-bottom:8px;
                box-shadow:0 0 6px rgba(0,0,0,0.2);
              "
            >

            <h5 style="margin:8px 0 4px 0;">
              ${local['venueName'] || ''}
            </h5>

            ${local['address']
            ? `
                  <div style="font-size:13px;color:#666;">
                    ${local['address']}
                  </div>
                `
            : ''
          }
            ${this.userLat !== null && this.userLng !== null
            ? `
      <div style="font-size:13px;color:#f70192;font-weight:600;margin-top:4px;">
        A ${this.calcularDistanciaKm(
              this.userLat,
              this.userLng,
              lat,
              lng
            ).toFixed(1)} km de ti
      </div>
    `
            : ''
          }

            ${local['venueName']
            ? `
                  <div style="font-size:13px;color:#666;">
                    ${local['venueName']}
                  </div>
                `
            : ''
          }
          ${local['ambientLevel']
            ? `
            <div style="
              margin-top:8px;
              display:inline-flex;
              align-items:center;
              gap:6px;
              padding:5px 12px;
              border-radius:20px;
              color:white;
              font-size:12px;
              font-weight:700;
              background:
              ${local['ambientLevel'] === 'Full'
              ? '#ff007a'
              :
              local['ambientLevel'] === 'Activo'
                ? '#0066ff'
                :
                '#343a40'
            };
            ">
              <i class="fa-solid fa-music"></i>
              ${local['ambientLevel']}
            </div>
            `
            : ''
          }
            ${local['phone']
            ? `
                  <div style="font-size:13px;color:#666;">
                    <b>Tel:</b> ${local['phone']}
                  </div>
                `
            : ''
          }

            <div
              style="
                display:flex;
                gap:8px;
                justify-content:center;
                flex-wrap:wrap;
                margin-top:10px;
              "
            >

              <button
                id="preview-${local.id}"
                class="btn btn-primary btn-sm"
              >
                Ver detalle
              </button>

              <a
                href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}"
                target="_blank"
                class="btn btn-success btn-sm"
                style="text-decoration:none;"
              >
                Cómo llegar
              </a>

              <a
                href="https://waze.com/ul?ll=${lat},${lng}&navigate=yes"
                target="_blank"
                class="btn btn-dark btn-sm"
                style="text-decoration:none;"
              >
                Waze
              </a>

            </div>

          </div>

        `)

      )

      .addTo(this.map);

    // 💾 Guardar marker
    this.markers.set(local.id, marker);

    // 👆 Evento popup
    marker.getPopup()?.on('open', () => {

      setTimeout(() => {

        const btn = document.getElementById(
          `preview-${local.id}`
        );

        if (btn) {

          btn.addEventListener('click', () => {

            // 💾 Guardar local seleccionado
            this.global.previewPartner(local);

            // 🚀 Navegar detalle
            this.router.navigate([
              '/detailprofilelocal',
              local.id
            ]);

          });

        }

      }, 0);

    });

  }

  // ============================================
  // 🔄 TIEMPO REAL
  // ============================================

  /* actualizarMarcadores(local: RecordModel) {

    const lat = parseFloat(local['lat']);
    const lng = parseFloat(local['lng']);

    const existingMarker = this.markers.get(local.id);

    if (existingMarker) {

      existingMarker.setLngLat([lng, lat]);

    } else {

      this.agregarMarcador(local);

    }

  } */
  actualizarMarcadores(local: RecordModel) {

    const lat = parseFloat(local['lat']);
    const lng = parseFloat(local['lng']);

    const existingMarker = this.markers.get(local.id);

    if (existingMarker) {

      existingMarker.remove();

      this.agregarMarcador(local);

    } else {

      this.agregarMarcador(local);

    }

  }
  // ============================================
  // 🔥 BOTÓN RADAR
  // ============================================

  goRadar() {

    this.router.navigate(['/home']);

  }

  // ============================================
  // 🧹 DESTROY
  // ============================================

  ngOnDestroy() {

    this.pb.collection('usuariosPartner')
      .unsubscribe('*');

    this.map.remove();

  }
  private calcularDistanciaKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371;

    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRad(value: number): number {
    return value * Math.PI / 180;
  }
  actualizarStatsMapa() {
    if (!this.personas?.length) {
      this.totalActiveUsers = 0;
      this.activeUsersPreview = [];
      this.extraUsers = 0;
      this.nearbyUsers = [];
      return;
    }

    let personasConDistancia = this.personas.map((persona: any) => {
      const lat = parseFloat(persona.lat);
      const lng = parseFloat(persona.lng);

      let distanceKm: number | null = null;

      if (
        this.userLat !== null &&
        this.userLng !== null &&
        !isNaN(lat) &&
        !isNaN(lng)
      ) {
        distanceKm = this.calcularDistanciaKm(
          this.userLat,
          this.userLng,
          lat,
          lng
        );
      }

      return {
        ...persona,
        distanceKm,
        avatarUrl: persona.avatar
          ? this.pb.files.getUrl(persona, persona.avatar)
          : 'assets/images/user.png'
      };
    });

    if (this.userLat !== null && this.userLng !== null) {
      personasConDistancia = personasConDistancia
        .filter((persona: any) => persona.distanceKm !== null)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
    }

    this.nearbyUsers = personasConDistancia;

    // Personas cercanas en radio de 10 km
    const personasCerca = personasConDistancia.filter((persona: any) => {
      return persona.distanceKm !== null && persona.distanceKm <= 10;
    });

    this.totalActiveUsers = personasCerca.length;

    this.activeUsersPreview = personasCerca.slice(0, 3).map((persona: any) => ({
      avatar: persona.avatarUrl,
      name: persona.name || persona.fullName || 'Usuario',
      distanceKm: persona.distanceKm
    }));

    this.extraUsers = Math.max(this.totalActiveUsers - this.activeUsersPreview.length, 0);

    this.matchesNow = personasCerca.length;

    this.newUsers = personasCerca.filter((persona: any) => {
      const created = new Date(persona.created).getTime();
      const now = Date.now();
      const diffHours = (now - created) / (1000 * 60 * 60);

      return diffHours <= 24;
    }).length;

    this.viewsToday = 0;
  }

}