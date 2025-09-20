import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MensajeriaService {
  constructor(private http: HttpClient) {}

  marcarMensajesComoLeidos(ids: number[]): Observable<void> {
    return this.http.post<void>(
      `http://localhost:8080/api/mensajeria/mensajes/marcar-leidos`,
      ids
    );
  }

  uploadAudio(file: Blob, durMs: number) {
    const fd = new FormData();
    fd.append('file', file, 'voice.webm'); // el nombre no importa mucho
    fd.append('durMs', String(durMs));

    return this.http.post<{ url: string; mime: string; durMs: number }>(
      'http://localhost:8080/api/uploads/audio',
      fd
    );
  }
}
