import { Component, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import PocketBase, { RecordModel } from 'pocketbase';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { CommonModule } from '@angular/common';
import { GlobalService } from '../../services/global.service';
import { environment } from '../../environments/environment';
@Component({
  selector: 'app-maps',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maps.html',
  styleUrl: './maps.scss',
})
export class Maps implements AfterViewInit, OnDestroy {
  @ViewChild('mapRef', { static: false }) mapRef!: ElementRef;

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  private map!: mapboxgl.Map;
  private pb = new PocketBase('https://db.ongomatch.com:8090');
  private markers: Map<string, mapboxgl.Marker> = new Map();
constructor(public global: GlobalService){}
  async ngOnInit() {
    window.addEventListener('resize', () => {
      this.map.resize();
    });   
  }

  async ngAfterViewInit() {
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v11',

      center: [-75.576, 6.244],
      zoom: 13,
      accessToken: environment.MAPBOX_PUBLIC_TOKEN,
      attributionControl: false
    });
  
    this.map.addControl(new mapboxgl.FullscreenControl());
    this.map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }));
  
    this.map.addControl(new mapboxgl.NavigationControl());
    this.map.addControl(new mapboxgl.FullscreenControl());
  
    this.map.on('load', () => {
      this.map.resize();
    
      this.cargarLocales().then(() => {
        this.fitToBounds();
      });
    
      // 🔽 Agregar marcador del perfil actual
      const profile = this.global.profileDataPartner; // o el nombre correcto de tu perfil actual
    
      if (profile?.lat && profile?.lng) {
        const lat = parseFloat(profile.lat);
        const lng = parseFloat(profile.lng);
    
        if (!isNaN(lat) && !isNaN(lng)) {
          new mapboxgl.Marker({ color: '#f70192' }) 
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <strong>Tu ubicación</strong>
            `))
            .addTo(this.map);
    
          // Opcional: centrar mapa en esa ubicación
          this.map.flyTo({ center: [lng, lat], zoom: 14 });
        }
      }
    });
    
  
    this.pb.collection('usuariosPartner').subscribe('*', e => {
      this.actualizarMarcadores(e.record);
      this.fitToBounds();
    });
  
    const geocoder = new MapboxGeocoder({
      accessToken: environment.MAPBOX_PUBLIC_TOKEN,
      mapboxgl,
      marker: false,
      placeholder: 'Buscar lugar'
    });
    this.map.addControl(geocoder, 'top-left');
    geocoder.on('result', e => {
      const [lng, lat] = e.result.center as [number, number];
      this.map.flyTo({ center: [lng, lat], zoom: 14 });
    });
  }
  

  fitToBounds() {
    const bounds = new mapboxgl.LngLatBounds();
    this.markers.forEach(marker => bounds.extend(marker.getLngLat()));
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
  }
  
  async cargarLocales() {
    const locales = await this.pb.collection('usuariosPartner').getFullList();

    locales.forEach((local: any) => {
      this.agregarMarcador(local);
    });
  }


  agregarMarcador(local: RecordModel) {
    const lat = parseFloat(local['lat']);
    const lng = parseFloat(local['lng']);
    if (isNaN(lat) || isNaN(lng)) return;
  
    // Construir la URL del avatar
    const avatarUrl = local['avatar']
      ? this.pb.files.getUrl(local, local['avatar'])
      : 'https://via.placeholder.com/70x70?text=Sin+foto';
  
    const el = document.createElement('div');
    el.className = 'custom-marker';
  
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = local['venueName'] || 'Local';
    /* img.className = 'animated-avatar'; */
    img.className = 'animated-avatar-hover';
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.borderRadius = '50%';
    img.style.objectFit = 'cover';
    img.style.border = '2px solid white';
    img.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.5)';
  
    el.appendChild(img);
  
    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <div class="popup-content text-center" style="min-width:220px;">
          <img src="${avatarUrl}" alt="${local['venueName'] || 'Local'}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:2px solid #f70192;margin-bottom:8px;box-shadow:0 0 6px rgba(0,0,0,0.2);">
          <h5 style="margin:8px 0 4px 0;">${local['venueName'] || ''}</h5>
          ${local['address'] ? `<div style='font-size:13px;color:#666;'>${local['address']}</div>` : ''}
          ${local['email'] ? `<div style='font-size:13px;color:#666;'><b>Email:</b> ${local['email']}</div>` : ''}
          ${local['phone'] ? `<div style='font-size:13px;color:#666;'><b>Tel:</b> ${local['phone']}</div>` : ''}
          <button id="preview-${local.id}" class="btn btn-primary btn-sm mt-2">Ver detalle</button>
        </div>
      `))
      .addTo(this.map);
  
    this.markers.set(local.id, marker);
      
        // Agrega el event listener al botón cuando se abre el popup
        marker.getPopup()?.on('open', () => {
          setTimeout(() => {
            const btn = document.getElementById(`preview-${local.id}`);
            if (btn) {
              btn.addEventListener('click', () => {
                this.global.previewPartner(local);
              });
            }
          }, 0);
        });
      }
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

  ngOnDestroy() {
    this.pb.collection('usuariosPartner').unsubscribe('*');
    this.map.remove();
  }
  
}
