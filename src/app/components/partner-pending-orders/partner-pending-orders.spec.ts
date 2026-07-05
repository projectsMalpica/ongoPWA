import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnerPendingOrders } from './partner-pending-orders';

describe('PartnerPendingOrders', () => {
  let component: PartnerPendingOrders;
  let fixture: ComponentFixture<PartnerPendingOrders>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerPendingOrders]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartnerPendingOrders);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
