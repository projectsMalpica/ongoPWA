import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Detailpromo } from './detailpromo';

describe('Detailpromo', () => {
  let component: Detailpromo;
  let fixture: ComponentFixture<Detailpromo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Detailpromo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Detailpromo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
