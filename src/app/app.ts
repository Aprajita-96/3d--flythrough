import { Component, signal } from '@angular/core';
import { MissileViewerComponent } from './missile-viewer/missile-viewer.component';

@Component({
  selector: 'app-root',
  imports: [MissileViewerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('missile-visual');
}
