import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import PocketBase from 'pocketbase';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  private pb = new PocketBase('https://db.ongomatch.com:8090');

  hotZones: any[] = [];
  loadingHotZones = false;
  savingHotZone = false;
  editingHotZoneId: string | null = null;
  newHotZone = {
    name: '',
    description: '',
    city: 'Cúcuta',
    lat: null as number | null,
    lng: null as number | null,
    radiusMeters: 300,
    isActive: true,
    requiresPlan: true,
    minPlan: 'premium'
  };

  stats = {
    hotZones: 0,
    locales: 0,
    clientes: 0,
    promos: 0,
    ventas: 0
  };

  async ngOnInit(): Promise<void> {
    await this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    await Promise.all([
      this.loadHotZones(),
      this.loadStats()
    ]);
  }

  async loadStats(): Promise<void> {
    try {
      const [locales, clientes, promos] = await Promise.all([
        this.pb.collection('usuariosPartner').getList(1, 1),
        this.pb.collection('usuariosClient').getList(1, 1),
        this.pb.collection('promos').getList(1, 1).catch(() => ({ totalItems: 0 }))
      ]);

      this.stats.locales = locales.totalItems || 0;
      this.stats.clientes = clientes.totalItems || 0;
      this.stats.promos = promos.totalItems || 0;
    } catch (error) {
      console.error('Error cargando métricas:', error);
    }
  }

  async loadHotZones(): Promise<void> {
    this.loadingHotZones = true;

    try {
      this.hotZones = await this.pb.collection('hotZones').getFullList({
        sort: '-created',
        requestKey: null
      });

      this.stats.hotZones = this.hotZones.length;
    } catch (error) {
      console.error('Error cargando zonas calientes:', error);
      this.hotZones = [];
    } finally {
      this.loadingHotZones = false;
    }
  }

async saveHotZone(): Promise<void> {
  if (this.savingHotZone) return;

  if (
    !this.newHotZone.name ||
    this.newHotZone.lat === null ||
    this.newHotZone.lng === null
  ) {
    Swal.fire({
      icon: 'warning',
      title: 'Faltan datos',
      text: 'Nombre, latitud y longitud son obligatorios.'
    });
    return;
  }

  this.savingHotZone = true;

  const wasEditing = !!this.editingHotZoneId;

  try {
    const userId = this.pb.authStore.record?.id || '';

    const data: any = {
      name: this.newHotZone.name,
      description: this.newHotZone.description,
      city: this.newHotZone.city,
      lat: Number(this.newHotZone.lat),
      lng: Number(this.newHotZone.lng),
      radiusMeters: Number(this.newHotZone.radiusMeters || 300),
      isActive: this.newHotZone.isActive,
      requiresPlan: this.newHotZone.requiresPlan,
      minPlan: this.newHotZone.minPlan
    };

    if (userId) {
      data.createdBy = userId;
    }

    if (this.editingHotZoneId) {
      const updated = await this.pb.collection('hotZones').update(
        this.editingHotZoneId,
        data,
        { requestKey: null }
      );

      this.hotZones = this.hotZones.map(zone =>
        zone.id === updated.id ? updated : zone
      );

    } else {
      const created = await this.pb.collection('hotZones').create(
        data,
        { requestKey: null }
      );

      this.hotZones = [created, ...this.hotZones];
    }

    this.stats.hotZones = this.hotZones.length;

    this.resetHotZoneForm();

    Swal.fire({
      icon: 'success',
      title: wasEditing ? 'Zona actualizada' : 'Zona creada',
      timer: 1300,
      showConfirmButton: false
    });

    setTimeout(() => {
      this.loadHotZones();
    }, 500);

  } catch (error) {
    console.error('Error guardando zona:', error);

    Swal.fire({
      icon: 'error',
      title: 'No se pudo guardar',
      text: 'Revisa permisos y campos de la colección hotZones.'
    });

  } finally {
    this.savingHotZone = false;
  }
}
editHotZone(zone: any): void {
  this.editingHotZoneId = zone.id;

  this.newHotZone = {
    name: zone.name || '',
    description: zone.description || '',
    city: zone.city || 'Cúcuta',
    lat: Number(zone.lat || 0),
    lng: Number(zone.lng || 0),
    radiusMeters: Number(zone.radiusMeters || 300),
    isActive: !!zone.isActive,
    requiresPlan: !!zone.requiresPlan,
    minPlan: zone.minPlan || 'premium'
  };

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

resetHotZoneForm(): void {
  this.editingHotZoneId = null;

  this.newHotZone = {
    name: '',
    description: '',
    city: 'Cúcuta',
    lat: null,
    lng: null,
    radiusMeters: 300,
    isActive: true,
    requiresPlan: true,
    minPlan: 'premium'
  };
}

  async toggleHotZone(zone: any): Promise<void> {
    try {
      await this.pb.collection('hotZones').update(zone.id, {
        isActive: !zone.isActive
      }, { requestKey: null });

      await this.loadHotZones();
    } catch (error) {
      console.error('Error actualizando zona:', error);
    }
  }

  async deleteHotZone(zone: any): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar zona',
      text: `¿Eliminar ${zone.name}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    await this.pb.collection('hotZones').delete(zone.id, { requestKey: null });
    await this.loadHotZones();
  }

  setCucutaPreset(type: 'malecon' | 'ventura' | 'mercedes'): void {
    const presets: any = {
      malecon: {
        name: 'Malecón de Cúcuta',
        description: 'Zona activa cerca de restaurantes, bares y espacios sociales del Malecón.',
        city: 'Cúcuta',
        lat: 7.9075,
        lng: -72.4878,
        radiusMeters: 500
      },
      ventura: {
        name: 'Ventura Plaza / Milla de Oro',
        description: 'Zona comercial y social de alta circulación cerca de Ventura Plaza.',
        city: 'Cúcuta',
        lat: 7.88783,
        lng: -72.49636,
        radiusMeters: 350
      },
      mercedes: {
        name: 'Parque Mercedes Ábrego',
        description: 'Zona céntrica con flujo de personas, comercio y punto de encuentro urbano.',
        city: 'Cúcuta',
        lat: 7.8897,
        lng: -72.5039,
        radiusMeters: 300
      }
    };

    this.newHotZone = {
      ...this.newHotZone,
      ...presets[type],
      isActive: true,
      requiresPlan: true,
      minPlan: 'premium'
    };
  }
}