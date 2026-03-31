import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GroupInviteService } from './group-invite.service';

describe('GroupInviteService', () => {
  let service: GroupInviteService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://localhost:8080/api/group-invites';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GroupInviteService],
    });
    service = TestBed.inject(GroupInviteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call create with {groupId, inviteeId}', () => {
    service.create(10, 22).subscribe();

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ groupId: 10, inviteeId: 22 });
    req.flush({});
  });

  it('should call accept with {userId}', () => {
    service.accept(77, 5).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/77/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 5 });
    req.flush({});
  });

  it('should call decline with {userId}', () => {
    service.decline(99, 8).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/99/decline`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 8 });
    req.flush({});
  });
});
