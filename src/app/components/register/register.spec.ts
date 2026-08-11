import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RegisterComponent } from './register';
import { vi } from 'vitest';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('new Google OAuth activates profile completion without navigating', async () => {
    const authUser = {
      id: 'user123', email: 'hidden@example.invalid', name: 'Google User', type: 'client'
    };
    const navigate = vi.spyOn(component.router, 'navigate');
    const navigateByUrl = vi.spyOn(component.router, 'navigateByUrl');
    vi.spyOn(component.auth, 'startGoogleOAuth').mockResolvedValue({
      needsRegister: true,
      user: authUser,
      profile: null,
      type: 'client',
      selectedType: 'client'
    });

    await component.registerWithGoogle('client');

    expect(component.googleAuthenticated).toBe(true);
    expect(component.completingGoogleProfile).toBe(true);
    expect(component.currentStep).toBe(2);
    expect(component.clientForm.getRawValue().email).toBe(authUser.email);
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(component.loadingGoogle).toBe(false);
    expect(component.registering).toBe(false);
  });

  it('cancel clears the Google completion state and authentication', async () => {
    (component as any).activateGoogleProfileCompletion(
      { id: 'user123', email: 'hidden@example.invalid', type: 'client' },
      'client',
      null
    );
    const clear = vi.spyOn(component.auth.pb.authStore, 'clear');

    await component.cancelGoogleProfileCompletion();

    expect(clear).toHaveBeenCalled();
    expect(component.completingGoogleProfile).toBe(false);
    expect(component.userType).toBeNull();
    expect(sessionStorage.getItem('ongo_pending_registration_type')).toBeNull();
  });

  it('reload restores an incomplete profile without starting OAuth again', async () => {
    sessionStorage.setItem('ongo_pending_registration_type', 'client');
    const authUser = {
      id: 'user123', email: 'hidden@example.invalid', name: 'Google User', type: 'client'
    };
    (component.auth as any).pb = {
      authStore: { isValid: true, record: authUser }
    };
    vi.spyOn(component.auth, 'findGoogleProfile').mockResolvedValue({
      id: 'profile1', userId: authUser.id, profileComplete: false, name: 'Saved name'
    });
    const oauth = vi.spyOn(component.auth, 'startGoogleOAuth');

    await (component as any).restoreGoogleProfileCompletion();

    expect(component.completingGoogleProfile).toBe(true);
    expect(component.clientForm.getRawValue().name).toBe('Saved name');
    expect(oauth).not.toHaveBeenCalled();
  });

  it('reload navigates a legacy profile without profileComplete', async () => {
    sessionStorage.setItem('ongo_pending_registration_type', 'client');
    const authUser = {
      id: 'user123', email: 'hidden@example.invalid', type: 'client'
    };
    (component.auth as any).pb = {
      authStore: { isValid: true, record: authUser }
    };
    vi.spyOn(component.auth, 'findGoogleProfile').mockResolvedValue({
      id: 'legacy-profile', userId: authUser.id
    });
    const destination = vi.spyOn(component.auth, 'resolveAuthenticatedUserDestination')
      .mockResolvedValue(true);

    await (component as any).restoreGoogleProfileCompletion();

    expect(destination).toHaveBeenCalledWith(expect.objectContaining({
      needsRegister: false,
      type: 'client'
    }));
    expect(component.completingGoogleProfile).toBe(false);
    expect(component.loadingGoogle).toBe(false);
    expect(component.registering).toBe(false);
  });
});
