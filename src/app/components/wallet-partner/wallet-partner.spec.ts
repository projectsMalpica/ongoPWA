import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalletPartner } from './wallet-partner';

describe('WalletPartner', () => {
  let component: WalletPartner;
  let fixture: ComponentFixture<WalletPartner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WalletPartner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WalletPartner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
