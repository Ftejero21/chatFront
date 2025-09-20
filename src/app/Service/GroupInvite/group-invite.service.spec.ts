import { TestBed } from '@angular/core/testing';

import { GroupInviteService } from './group-invite.service';

describe('GroupInviteService', () => {
  let service: GroupInviteService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GroupInviteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
