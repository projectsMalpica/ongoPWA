import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrdersPartner } from './orders-partner';

describe('OrdersPartner', () => {
  let component: OrdersPartner;
  let fixture: ComponentFixture<OrdersPartner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersPartner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrdersPartner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
