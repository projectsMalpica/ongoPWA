import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Detailprofilelocal } from './detailprofilelocal';

describe('Detailprofilelocal', () => {
  let component: Detailprofilelocal;
  let fixture: ComponentFixture<Detailprofilelocal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Detailprofilelocal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Detailprofilelocal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
