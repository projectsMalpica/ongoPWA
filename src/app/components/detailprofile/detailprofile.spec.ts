import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Detailprofile } from './detailprofile';

describe('Detailprofile', () => {
  let component: Detailprofile;
  let fixture: ComponentFixture<Detailprofile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Detailprofile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Detailprofile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
