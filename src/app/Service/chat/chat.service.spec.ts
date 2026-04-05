import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { environment } from '../../environments';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.backendBaseUrl}/api/chat`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatService],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call add-users without inviterId and with groupId in path', () => {
    service.agregarUsuariosAGrupo(10, { userIds: [22, 22, 0, -1] }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/10/usuarios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userIds: [22] });
    expect(req.request.body.inviterId).toBeUndefined();
    expect(req.request.body.groupId).toBeUndefined();
    req.flush({});
  });

  it('should use authenticated user id when listing all chats', () => {
    sessionStorage.setItem('usuarioId', '7');

    service.listarTodosLosChats().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/usuario/7/todos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should map 403 in listarTodosLosChats to permission error payload', (done) => {
    sessionStorage.setItem('usuarioId', '7');

    service.listarTodosLosChats().subscribe({
      next: () => fail('Expected permission error'),
      error: (err: any) => {
        expect(err.status).toBe(403);
        expect(err.code).toBe('CHAT_LIST_FORBIDDEN');
        expect(String(err.userMessage || '')).toContain('No tienes permisos');
        done();
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/usuario/7/todos`);
    req.flush(
      { mensaje: 'forbidden' },
      { status: 403, statusText: 'Forbidden' }
    );
  });

  it('should map 403 in listarGrupalesPorUsuario to permission error payload', (done) => {
    sessionStorage.setItem('usuarioId', '7');

    service.listarGrupalesPorUsuario().subscribe({
      next: () => fail('Expected permission error'),
      error: (err: any) => {
        expect(err.status).toBe(403);
        expect(err.code).toBe('CHAT_LIST_FORBIDDEN');
        expect(String(err.userMessage || '')).toContain('No tienes permisos');
        done();
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/grupal/usuario/7`);
    req.flush(
      { mensaje: 'forbidden' },
      { status: 403, statusText: 'Forbidden' }
    );
  });
});
