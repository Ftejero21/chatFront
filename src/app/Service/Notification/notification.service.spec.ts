import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080/api/notifications';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationService],
    });
    service = TestBed.inject(NotificationService);
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

  it('should call unseenCount without query params', () => {
    service.unseenCount().subscribe((count) => {
      expect(count).toBe(4);
    });

    const req = httpMock.expectOne(`${baseUrl}/count`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ unseenCount: 4 });
  });

  it('should call markAllSeen with empty object body', () => {
    service.markAllSeen().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/seen-all`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.keys().length).toBe(0);
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('should call markSeen with empty object body', () => {
    service.markSeen(123).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/123/seen`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

});
