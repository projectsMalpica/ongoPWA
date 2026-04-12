import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileLocal } from './profile-local';

describe('ProfileLocal', () => {
  let component: ProfileLocal;
  let fixture: ComponentFixture<ProfileLocal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileLocal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileLocal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
