import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MissileViewer } from './missile-viewer';

describe('MissileViewer', () => {
  let component: MissileViewer;
  let fixture: ComponentFixture<MissileViewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MissileViewer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MissileViewer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
