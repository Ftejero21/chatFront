import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearGrupoModalComponent } from './crear-grupo-modal.component';

describe('CrearGrupoModalComponent', () => {
  let component: CrearGrupoModalComponent;
  let fixture: ComponentFixture<CrearGrupoModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CrearGrupoModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CrearGrupoModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
