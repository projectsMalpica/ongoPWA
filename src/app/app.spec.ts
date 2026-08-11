import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AppUpdateService } from './services/app-update.service';
import { vi } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AppUpdateService,
          useValue: {
            notice: signal(null),
            updateAvailable: signal(false),
            unrecoverable: signal(false),
            isUpdating: signal(false),
            reloadNow: () => undefined,
            dismissUpdate: () => undefined
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('does not render the former permanent cleanup action', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Limpiar app');
    expect(compiled.querySelector('.clean-app-btn')).toBeNull();
  });
});
