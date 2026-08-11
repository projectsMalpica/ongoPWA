import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminClientes } from './admin-clientes';

describe('AdminClientes', () => {
  let component: AdminClientes;
  let fixture: ComponentFixture<AdminClientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminClientes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminClientes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
