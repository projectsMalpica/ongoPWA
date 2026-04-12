import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeLocal } from './home-local';

describe('HomeLocal', () => {
  let component: HomeLocal;
  let fixture: ComponentFixture<HomeLocal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeLocal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeLocal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
