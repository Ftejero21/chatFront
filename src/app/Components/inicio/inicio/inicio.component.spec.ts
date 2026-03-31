import { NgZone } from '@angular/core';
import { of, throwError } from 'rxjs';
import { GroupInviteWS } from '../../../Interface/GroupInviteWS';
import { InicioComponent } from './inicio.component';

describe('InicioComponent invite flows', () => {
  const makeComponent = () => {
    const groupInviteService = {
      accept: jasmine.createSpy('accept').and.returnValue(of(void 0)),
      decline: jasmine.createSpy('decline').and.returnValue(of(void 0)),
    };

    const component = new InicioComponent(
      {} as any,
      {} as any,
      {} as any,
      new NgZone({ enableLongStackTrace: false }),
      { markForCheck: jasmine.createSpy('markForCheck') } as any,
      {} as any,
      {} as any,
      {} as any,
      groupInviteService as any,
      {} as any,
      {} as any
    );

    component.usuarioActualId = 5;
    component.notifInvites = [
      {
        inviteId: 10,
        groupId: 3,
        groupName: 'Equipo',
        inviterId: 2,
        inviterNombre: 'Ana',
        unseenCount: 1,
        kind: 'INVITE',
      },
    ];

    spyOn(component as any, 'listarTodosLosChats');
    spyOn(component as any, 'showToast');
    localStorage.clear();

    return { component, groupInviteService };
  };

  it('should accept invite and remove it from local pending list', () => {
    const { component, groupInviteService } = makeComponent();
    const invite = component.notifInvites[0] as GroupInviteWS;

    component.aceptarInvitacion(invite);

    expect(groupInviteService.accept).toHaveBeenCalledWith(10, 5);
    expect(component.notifInvites.length).toBe(0);
    expect((component as any).listarTodosLosChats).toHaveBeenCalled();
  });

  it('should show warning on 403 when accepting invite', () => {
    const { component, groupInviteService } = makeComponent();
    groupInviteService.accept.and.returnValue(throwError(() => ({ status: 403 })));
    const invite = component.notifInvites[0] as GroupInviteWS;

    component.aceptarInvitacion(invite);

    expect(component.notifInvites.length).toBe(1);
    expect((component as any).showToast).toHaveBeenCalled();
  });

  it('should decline invite and remove it from local pending list', () => {
    const { component, groupInviteService } = makeComponent();
    const invite = component.notifInvites[0] as GroupInviteWS;

    component.rechazarInvitacion(invite);

    expect(groupInviteService.decline).toHaveBeenCalledWith(10, 5);
    expect(component.notifInvites.length).toBe(0);
  });
});
