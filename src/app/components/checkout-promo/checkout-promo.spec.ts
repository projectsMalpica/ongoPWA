import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CheckoutPromo } from './checkout-promo';

describe('CheckoutPromo', () => {
  let component: CheckoutPromo;
  let fixture: ComponentFixture<CheckoutPromo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutPromo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckoutPromo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
