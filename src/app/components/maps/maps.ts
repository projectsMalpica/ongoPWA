import { Component, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
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

  totalActiveUsers = 128;

  activeUsersPreview = [
    { avatar: 'https://randomuser.me/api/portraits/women/1.jpg' },
    { avatar: 'https://randomuser.me/api/portraits/men/2.jpg' },
    { avatar: 'https://randomuser.me/api/portraits/women/3.jpg' }
  ];

  extraUsers = 25;

  matchesNow = 23;
  newUsers = 5;
  viewsToday = 12;

  constructor(
    public global: GlobalService,
    public router: Router
  ) {}

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

      // 📍 Cargar locales
      await this.cargarLocales();

      // ⏳ Mantener mapa mundial unos segundos
      setTimeout(() => {

        navigator.geolocation.getCurrentPosition(

          // ✅ Usuario encontrado
          position => {

            const userLng = position.coords.longitude;
            const userLat = position.coords.latitude;

            // 📍 Marker usuario
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

            // ✈️ Vuelo cinematográfico
            this.map.flyTo({
              center: [userLng, userLat],
              zoom: 6,
              speed: 0.35,
              curve: 1.8,
              essential: true
            });

          },

          // ❌ Error geolocalización
          error => {

            console.warn(
              'No se pudo obtener ubicación',
              error
            );

            // 🇨🇴 Fallback Colombia
            this.map.flyTo({
              center: [-74.0721, 4.7110],
              zoom: 5,
              speed: 0.35,
              curve: 1.8,
              essential: true
            });

          }

        );

      }, 5500);

    });

    // 🔄 Tiempo real
    this.pb.collection('usuariosPartner')
      .subscribe('*', e => {

        this.actualizarMarcadores(e.record);

      });

  }

  // ============================================
  // 📍 CARGAR LOCALES
  // ============================================

  async cargarLocales() {

    try {

      const locales = await this.pb
        .collection('usuariosPartner')
        .getFullList();

      locales.forEach((local: any) => {

        this.agregarMarcador(local);

      });

    } catch (error) {

      console.error(
        'Error cargando locales:',
        error
      );

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

            ${
              local['address']
                ? `
                  <div style="font-size:13px;color:#666;">
                    ${local['address']}
                  </div>
                `
                : ''
            }

            ${
              local['venueName']
                ? `
                  <div style="font-size:13px;color:#666;">
                    ${local['venueName']}
                  </div>
                `
                : ''
            }

            /* ${
              local['email']
                ? `
                  <div style="font-size:13px;color:#666;">
                    <b>Email:</b> ${local['email']}
                  </div>
                `
                : ''
            } */

            ${
              local['phone']
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

  actualizarMarcadores(local: RecordModel) {

    const lat = parseFloat(local['lat']);
    const lng = parseFloat(local['lng']);

    const existingMarker = this.markers.get(local.id);

    if (existingMarker) {

      existingMarker.setLngLat([lng, lat]);

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

}