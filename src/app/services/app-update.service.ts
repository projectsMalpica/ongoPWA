import { ApplicationRef, DestroyRef, Inject, Injectable, computed, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent, take, throttleTime, timer } from 'rxjs';

export type AppUpdateNotice = 'update' | 'unrecoverable' | null;

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly dismissedHashKey = 'ongo_dismissed_update_hash';
  private readonly checkIntervalMs = 6 * 60 * 60 * 1000;
  private readonly noticeState = signal<AppUpdateNotice>(null);
  private readonly updatingState = signal(false);
  private readonly latestHashState = signal<string | null>(null);
  private readonly currentHashState = signal<string | null>(null);

  readonly notice = this.noticeState.asReadonly();
  readonly updateAvailable = computed(() => this.noticeState() === 'update');
  readonly unrecoverable = computed(() => this.noticeState() === 'unrecoverable');
  readonly isUpdating = this.updatingState.asReadonly();
  readonly latestVersionHash = this.latestHashState.asReadonly();
  readonly currentVersionHash = this.currentHashState.asReadonly();

  constructor(
    private readonly swUpdate: SwUpdate,
    private readonly appRef: ApplicationRef,
    private readonly destroyRef: DestroyRef,
    @Inject(DOCUMENT) private readonly document: Document
  ) {
    if (!this.swUpdate.isEnabled) return;

    const readySubscription = this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(event => this.handleVersionReady(event));

    const unrecoverableSubscription = this.swUpdate.unrecoverable.subscribe(() => {
      this.noticeState.set('unrecoverable');
    });

    const stableSubscription = this.appRef.isStable
      .pipe(filter(Boolean), take(1))
      .subscribe(() => {
        void this.checkForUpdate();

        const periodicSubscription = timer(this.checkIntervalMs, this.checkIntervalMs)
          .subscribe(() => void this.checkForUpdate());
        this.destroyRef.onDestroy(() => periodicSubscription.unsubscribe());
      });

    const visibilitySubscription = fromEvent(this.document, 'visibilitychange')
      .pipe(throttleTime(60_000, undefined, { leading: true, trailing: false }))
      .subscribe(() => {
        if (this.document.visibilityState === 'visible') void this.checkForUpdate();
      });

    this.destroyRef.onDestroy(() => {
      readySubscription.unsubscribe();
      unrecoverableSubscription.unsubscribe();
      stableSubscription.unsubscribe();
      visibilitySubscription.unsubscribe();
    });
  }

  dismissUpdate(): void {
    if (this.noticeState() !== 'update') return;
    const hash = this.latestHashState();
    if (hash) sessionStorage.setItem(this.dismissedHashKey, hash);
    this.noticeState.set(null);
  }

  reloadNow(): void {
    if (this.updatingState()) return;
    this.updatingState.set(true);

    try {
      this.reloadPage();
    } catch (error) {
      this.updatingState.set(false);
      console.error('No se pudo recargar la aplicación para actualizarla.', error);
    }
  }

  private reloadPage(): void {
    this.document.location.reload();
  }

  private handleVersionReady(event: VersionReadyEvent): void {
    const latestHash = event.latestVersion.hash;
    this.currentHashState.set(event.currentVersion.hash);
    this.latestHashState.set(latestHash);

    if (sessionStorage.getItem(this.dismissedHashKey) === latestHash) return;
    this.noticeState.set('update');
  }

  private async checkForUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    try {
      await this.swUpdate.checkForUpdate();
    } catch (error) {
      console.warn('No se pudo comprobar si hay una actualización de la PWA.', error);
    }
  }
}
