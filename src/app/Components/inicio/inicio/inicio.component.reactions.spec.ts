import { NgZone } from '@angular/core';
import { of } from 'rxjs';
import { InicioComponent } from './inicio.component';

describe('InicioComponent reactions dropdown', () => {
  const makeComponent = () => {
    const component = new InicioComponent(
      {} as any,
      {} as any,
      {} as any,
      new NgZone({ enableLongStackTrace: false }),
      { markForCheck: jasmine.createSpy('markForCheck') } as any,
      {} as any,
      {} as any,
      {} as any,
      {
        accept: jasmine.createSpy('accept').and.returnValue(of(void 0)),
        decline: jasmine.createSpy('decline').and.returnValue(of(void 0)),
      } as any,
      {} as any,
      {} as any
    );

    component.usuarioActualId = 1;
    component.chatActual = {
      id: 99,
      esGrupo: true,
      usuarios: [
        { id: 2, nombre: 'Ana', apellido: 'Lopez', foto: 'ana.png' },
        { id: 3, nombre: 'Luis', apellido: 'Martin', foto: null },
      ],
    };
    component.chats = [
      {
        id: 99,
        esGrupo: true,
        usuarios: component.chatActual.usuarios,
      },
    ];

    return component;
  };

  it('debe deduplicar por userId y ordenar por createdAt desc', () => {
    const component = makeComponent();
    const mensaje: any = {
      id: 10,
      chatId: 99,
      contenido: 'hola',
      emisorId: 2,
      receptorId: 1,
      reacciones: [
        { userId: 2, emoji: '👍', createdAt: '2026-03-01T10:00:00Z' },
        { userId: 3, emoji: '😂', createdAt: '2026-03-01T12:00:00Z' },
        { userId: 2, emoji: '❤️', createdAt: '2026-03-01T13:00:00Z' },
      ],
    };

    (component as any).seedIncomingReactionsFromMessages([mensaje]);

    expect(component.incomingQuickReaction(mensaje)).toBe('❤️');
    const details = component.messageReactionDetails(mensaje);
    expect(details.length).toBe(2);
    expect(details[0].userId).toBe(2);
    expect(details[0].emoji).toBe('❤️');
    expect(details[1].userId).toBe(3);
  });

  it('debe actualizar estado con WS SET y REMOVE', () => {
    const component = makeComponent();
    const mensaje: any = {
      id: 20,
      chatId: 99,
      contenido: 'm1',
      emisorId: 2,
      receptorId: 1,
    };

    (component as any).applyIncomingReactionEvent(
      {
        event: 'MESSAGE_REACTION',
        messageId: 20,
        chatId: 99,
        esGrupo: true,
        reactorUserId: 2,
        emoji: '😮',
        action: 'SET',
        createdAt: '2026-03-01T15:00:00Z',
      },
      'test'
    );
    expect(component.incomingQuickReaction(mensaje)).toBe('😮');
    expect(component.hasReactionDetails(mensaje)).toBeTrue();

    (component as any).applyIncomingReactionEvent(
      {
        event: 'MESSAGE_REACTION',
        messageId: 20,
        chatId: 99,
        esGrupo: true,
        reactorUserId: 2,
        emoji: null,
        action: 'REMOVE',
      },
      'test'
    );
    expect(component.incomingQuickReaction(mensaje)).toBe('');
    expect(component.hasReactionDetails(mensaje)).toBeFalse();
  });

  it('debe abrir/cerrar un solo desplegable y cerrar con click fuera', () => {
    const component = makeComponent();
    const m1: any = {
      id: 31,
      chatId: 99,
      contenido: 'a',
      emisorId: 2,
      receptorId: 1,
      reaccionEmoji: '👍',
      reaccionUsuarioId: 2,
    };
    const m2: any = {
      id: 32,
      chatId: 99,
      contenido: 'b',
      emisorId: 3,
      receptorId: 1,
      reaccionEmoji: '😂',
      reaccionUsuarioId: 3,
    };
    (component as any).seedIncomingReactionsFromMessages([m1, m2]);

    const eventMock = {
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    } as any;

    component.toggleMessageReactionDetails(m1, eventMock);
    expect(component.openReactionDetailsMessageId).toBe(31);
    expect(component.isMessageReactionDetailsOpen(m1)).toBeTrue();

    component.toggleMessageReactionDetails(m2, eventMock);
    expect(component.openReactionDetailsMessageId).toBe(32);
    expect(component.isMessageReactionDetailsOpen(m1)).toBeFalse();
    expect(component.isMessageReactionDetailsOpen(m2)).toBeTrue();

    component.closeMensajeMenuOnOutsideClick({
      target: document.createElement('div'),
    } as any);
    expect(component.openReactionDetailsMessageId).toBeNull();
  });
});
