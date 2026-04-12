import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalletHistory } from './wallet-history';

describe('WalletHistory', () => {
  let component: WalletHistory;
  let fixture: ComponentFixture<WalletHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WalletHistory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WalletHistory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
