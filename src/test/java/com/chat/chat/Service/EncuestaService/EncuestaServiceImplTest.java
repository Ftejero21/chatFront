package com.chat.chat.Service.EncuestaService;

import com.chat.chat.DTO.EncuestaDTO;
import com.chat.chat.DTO.EncuestaOpcionDTO;
import com.chat.chat.DTO.MensajeDTO;
import com.chat.chat.DTO.VotoEncuestaDTO;
import com.chat.chat.Entity.ChatGrupalEntity;
import com.chat.chat.Entity.EncuestaEntity;
import com.chat.chat.Entity.EncuestaOpcionEntity;
import com.chat.chat.Entity.EncuestaVotoEntity;
import com.chat.chat.Entity.MensajeEntity;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.ChatGrupalRepository;
import com.chat.chat.Repository.EncuestaOpcionRepository;
import com.chat.chat.Repository.EncuestaRepository;
import com.chat.chat.Repository.EncuestaVotoRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.Constantes;
import com.chat.chat.Utils.MessageType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EncuestaServiceImplTest {

    @Mock
    private EncuestaRepository encuestaRepository;
    @Mock
    private EncuestaOpcionRepository encuestaOpcionRepository;
    @Mock
    private EncuestaVotoRepository encuestaVotoRepository;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private ChatGrupalRepository chatGrupalRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private EncuestaServiceImpl encuestaService;

    @Test
    void creacionEncuestaPersisteEstructuraBase() {
        UsuarioEntity creador = usuario(11L);
        MensajeEntity mensaje = mensajeEncuesta(700L, 90L, creador);
        MensajeDTO dto = mensajeDtoEncuesta();

        EncuestaEntity encuestaGuardada = new EncuestaEntity();
        encuestaGuardada.setId(500L);
        encuestaGuardada.setMensaje(mensaje);

        when(encuestaRepository.findByMensajeId(700L)).thenReturn(Optional.empty());
        when(encuestaRepository.save(any(EncuestaEntity.class))).thenReturn(encuestaGuardada);

        encuestaService.crearEncuestaParaMensaje(mensaje, dto, creador);

        ArgumentCaptor<List<EncuestaOpcionEntity>> opcionesCaptor = ArgumentCaptor.forClass(List.class);
        verify(encuestaOpcionRepository, times(1)).saveAll(opcionesCaptor.capture());
        List<EncuestaOpcionEntity> opciones = opcionesCaptor.getValue();
        assertEquals(2, opciones.size());
        assertEquals("opt-a", opciones.get(0).getOptionKey());
        assertEquals("opt-b", opciones.get(1).getOptionKey());
        assertEquals("Opcion A", opciones.get(0).getOptionText());
    }

    @Test
    void votoSingleReemplazaOpcionAnterior() {
        Long userId = 11L;
        Long chatId = 90L;
        Long mensajeId = 700L;
        Long encuestaId = 500L;

        UsuarioEntity usuario = usuario(userId);
        UsuarioEntity emisor = usuario(12L);
        MensajeEntity mensaje = mensajeEncuesta(mensajeId, chatId, emisor);
        ChatGrupalEntity chat = chatGrupal(chatId, usuario, emisor);
        EncuestaEntity encuesta = encuesta(encuestaId, mensaje, false, usuario);
        EncuestaOpcionEntity op1 = opcion(encuesta, 1L, "opt-a", "A", 0);
        EncuestaOpcionEntity op2 = opcion(encuesta, 2L, "opt-b", "B", 1);
        EncuestaVotoEntity votoPrevio = voto(encuesta, op1, usuario);
        EncuestaVotoEntity votoNuevo = voto(encuesta, op2, usuario);

        VotoEncuestaDTO request = new VotoEncuestaDTO();
        request.setMensajeId(mensajeId);
        request.setOptionId("opt-b");
        request.setChatId(chatId);

        when(mensajeRepository.findById(mensajeId)).thenReturn(Optional.of(mensaje));
        when(chatGrupalRepository.findByIdWithUsuarios(chatId)).thenReturn(Optional.of(chat));
        when(encuestaRepository.findByMensajeIdForUpdate(mensajeId)).thenReturn(Optional.of(encuesta));
        when(encuestaOpcionRepository.findByEncuestaIdOrderByOrderIndexAscIdAsc(encuestaId)).thenReturn(List.of(op1, op2));
        when(encuestaOpcionRepository.findByEncuestaIdAndOptionKey(encuestaId, "opt-b")).thenReturn(Optional.of(op2));
        when(usuarioRepository.findById(userId)).thenReturn(Optional.of(usuario));
        when(encuestaVotoRepository.findByEncuestaIdAndUsuarioId(encuestaId, userId)).thenReturn(List.of(votoPrevio));
        when(encuestaVotoRepository.countByEncuestaGroupedByOpcion(encuestaId)).thenReturn(List.of(new Object[]{2L, 1L}));
        when(encuestaVotoRepository.findByEncuestaId(encuestaId)).thenReturn(List.of(votoNuevo));

        MensajeDTO resultado = encuestaService.votarEncuesta(request, userId);

        verify(encuestaVotoRepository, times(1)).deleteByEncuestaIdAndUsuarioId(encuestaId, userId);
        verify(encuestaVotoRepository, times(1)).save(any(EncuestaVotoEntity.class));
        assertNotNull(resultado.getPoll());
        assertEquals(1L, resultado.getPoll().getTotalVotes());
        assertEquals(Constantes.TIPO_POLL, resultado.getTipo());
        ArgumentCaptor<MensajeDTO> payloadCaptor = ArgumentCaptor.forClass(MensajeDTO.class);
        verify(messagingTemplate, times(1)).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + chatId), payloadCaptor.capture());
        MensajeDTO payloadBroadcast = payloadCaptor.getValue();
        assertNotNull(payloadBroadcast.getPoll());
        assertNotNull(payloadBroadcast.getPoll().getOptions());
        assertNotNull(payloadBroadcast.getPoll().getOptions().get(1).getVoterIds());
        assertEquals(payloadBroadcast.getPoll().getOptions().get(1).getVoteCount().intValue(),
                payloadBroadcast.getPoll().getOptions().get(1).getVoterIds().size());
    }

    @Test
    void votoMultipleAlternaSeleccion() {
        Long userId = 11L;
        Long chatId = 90L;
        Long mensajeId = 700L;
        Long encuestaId = 500L;

        UsuarioEntity usuario = usuario(userId);
        UsuarioEntity emisor = usuario(12L);
        MensajeEntity mensaje = mensajeEncuesta(mensajeId, chatId, emisor);
        ChatGrupalEntity chat = chatGrupal(chatId, usuario, emisor);
        EncuestaEntity encuesta = encuesta(encuestaId, mensaje, true, usuario);
        EncuestaOpcionEntity op1 = opcion(encuesta, 1L, "opt-a", "A", 0);
        EncuestaVotoEntity votoExistente = voto(encuesta, op1, usuario);

        VotoEncuestaDTO request = new VotoEncuestaDTO();
        request.setMensajeId(mensajeId);
        request.setOptionId("opt-a");

        when(mensajeRepository.findById(mensajeId)).thenReturn(Optional.of(mensaje));
        when(chatGrupalRepository.findByIdWithUsuarios(chatId)).thenReturn(Optional.of(chat));
        when(encuestaRepository.findByMensajeIdForUpdate(mensajeId)).thenReturn(Optional.of(encuesta));
        when(encuestaOpcionRepository.findByEncuestaIdOrderByOrderIndexAscIdAsc(encuestaId)).thenReturn(List.of(op1));
        when(encuestaOpcionRepository.findByEncuestaIdAndOptionKey(encuestaId, "opt-a")).thenReturn(Optional.of(op1));
        when(usuarioRepository.findById(userId)).thenReturn(Optional.of(usuario));
        when(encuestaVotoRepository.findByEncuestaIdAndUsuarioIdAndOpcionId(encuestaId, userId, 1L)).thenReturn(Optional.of(votoExistente));
        when(encuestaVotoRepository.countByEncuestaGroupedByOpcion(encuestaId)).thenReturn(List.of());
        when(encuestaVotoRepository.findByEncuestaId(encuestaId)).thenReturn(List.of());

        encuestaService.votarEncuesta(request, userId);

        verify(encuestaVotoRepository, times(1)).deleteByEncuestaIdAndUsuarioIdAndOpcionId(encuestaId, userId, 1L);
        verify(encuestaVotoRepository, never()).save(any(EncuestaVotoEntity.class));
    }

    @Test
    void votoSingleMismaOpcionDesmarca() {
        Long userId = 11L;
        Long chatId = 90L;
        Long mensajeId = 700L;
        Long encuestaId = 500L;

        UsuarioEntity usuario = usuario(userId);
        UsuarioEntity emisor = usuario(12L);
        MensajeEntity mensaje = mensajeEncuesta(mensajeId, chatId, emisor);
        ChatGrupalEntity chat = chatGrupal(chatId, usuario, emisor);
        EncuestaEntity encuesta = encuesta(encuestaId, mensaje, false, usuario);
        EncuestaOpcionEntity op1 = opcion(encuesta, 1L, "opt-a", "A", 0);
        EncuestaVotoEntity votoExistente = voto(encuesta, op1, usuario);

        VotoEncuestaDTO request = new VotoEncuestaDTO();
        request.setMensajeId(mensajeId);
        request.setOptionId("opt-a");

        when(mensajeRepository.findById(mensajeId)).thenReturn(Optional.of(mensaje));
        when(chatGrupalRepository.findByIdWithUsuarios(chatId)).thenReturn(Optional.of(chat));
        when(encuestaRepository.findByMensajeIdForUpdate(mensajeId)).thenReturn(Optional.of(encuesta));
        when(encuestaOpcionRepository.findByEncuestaIdOrderByOrderIndexAscIdAsc(encuestaId)).thenReturn(List.of(op1));
        when(encuestaOpcionRepository.findByEncuestaIdAndOptionKey(encuestaId, "opt-a")).thenReturn(Optional.of(op1));
        when(usuarioRepository.findById(userId)).thenReturn(Optional.of(usuario));
        when(encuestaVotoRepository.findByEncuestaIdAndUsuarioId(encuestaId, userId)).thenReturn(List.of(votoExistente));
        when(encuestaVotoRepository.countByEncuestaGroupedByOpcion(encuestaId)).thenReturn(List.of());
        when(encuestaVotoRepository.findByEncuestaId(encuestaId)).thenReturn(List.of());

        encuestaService.votarEncuesta(request, userId);

        verify(encuestaVotoRepository, times(1)).deleteByEncuestaIdAndUsuarioIdAndOpcionId(encuestaId, userId, 1L);
        verify(encuestaVotoRepository, never()).deleteByEncuestaIdAndUsuarioId(encuestaId, userId);
    }

    @Test
    void concurrenciaBasicaVotoDuplicadoEsIdempotente() {
        Long userId = 11L;
        Long chatId = 90L;
        Long mensajeId = 700L;
        Long encuestaId = 500L;

        UsuarioEntity usuario = usuario(userId);
        UsuarioEntity emisor = usuario(12L);
        MensajeEntity mensaje = mensajeEncuesta(mensajeId, chatId, emisor);
        ChatGrupalEntity chat = chatGrupal(chatId, usuario, emisor);
        EncuestaEntity encuesta = encuesta(encuestaId, mensaje, true, usuario);
        EncuestaOpcionEntity op1 = opcion(encuesta, 1L, "opt-a", "A", 0);

        VotoEncuestaDTO request = new VotoEncuestaDTO();
        request.setMensajeId(mensajeId);
        request.setOptionId("opt-a");

        when(mensajeRepository.findById(mensajeId)).thenReturn(Optional.of(mensaje));
        when(chatGrupalRepository.findByIdWithUsuarios(chatId)).thenReturn(Optional.of(chat));
        when(encuestaRepository.findByMensajeIdForUpdate(mensajeId)).thenReturn(Optional.of(encuesta));
        when(encuestaOpcionRepository.findByEncuestaIdOrderByOrderIndexAscIdAsc(encuestaId)).thenReturn(List.of(op1));
        when(encuestaOpcionRepository.findByEncuestaIdAndOptionKey(encuestaId, "opt-a")).thenReturn(Optional.of(op1));
        when(usuarioRepository.findById(userId)).thenReturn(Optional.of(usuario));
        when(encuestaVotoRepository.findByEncuestaIdAndUsuarioIdAndOpcionId(encuestaId, userId, 1L)).thenReturn(Optional.empty());
        when(encuestaVotoRepository.save(any(EncuestaVotoEntity.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));
        when(encuestaVotoRepository.countByEncuestaGroupedByOpcion(encuestaId)).thenReturn(List.of());
        when(encuestaVotoRepository.findByEncuestaId(encuestaId)).thenReturn(List.of());

        MensajeDTO result = encuestaService.votarEncuesta(request, userId);

        assertNotNull(result);
        assertTrue(result.getPoll().getTotalVotes() >= 0);
        verify(messagingTemplate, times(1)).convertAndSend(eq(Constantes.TOPIC_CHAT_GRUPAL + chatId), any(MensajeDTO.class));
    }

    private static MensajeDTO mensajeDtoEncuesta() {
        MensajeDTO dto = new MensajeDTO();
        dto.setTipo(Constantes.TIPO_TEXT);
        dto.setContentKind("POLL");
        dto.setPollType("POLL_V1");

        EncuestaOpcionDTO optionA = new EncuestaOpcionDTO();
        optionA.setId("opt-a");
        optionA.setText("Opcion A");
        EncuestaOpcionDTO optionB = new EncuestaOpcionDTO();
        optionB.setId("opt-b");
        optionB.setText("Opcion B");

        EncuestaDTO poll = new EncuestaDTO();
        poll.setType("POLL_V1");
        poll.setQuestion("Pregunta");
        poll.setAllowMultiple(false);
        poll.setOptions(List.of(optionA, optionB));
        dto.setPoll(poll);
        return dto;
    }

    private static UsuarioEntity usuario(Long id) {
        UsuarioEntity user = new UsuarioEntity();
        user.setId(id);
        user.setActivo(true);
        user.setNombre("U" + id);
        user.setApellido("T" + id);
        return user;
    }

    private static ChatGrupalEntity chatGrupal(Long id, UsuarioEntity... usuarios) {
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(id);
        chat.setActivo(true);
        chat.setUsuarios(List.of(usuarios));
        return chat;
    }

    private static MensajeEntity mensajeEncuesta(Long mensajeId, Long chatId, UsuarioEntity emisor) {
        ChatGrupalEntity chat = new ChatGrupalEntity();
        chat.setId(chatId);
        chat.setActivo(true);
        MensajeEntity mensaje = new MensajeEntity();
        mensaje.setId(mensajeId);
        mensaje.setChat(chat);
        mensaje.setEmisor(emisor);
        mensaje.setTipo(MessageType.POLL);
        mensaje.setContenido("{\"type\":\"E2E_GROUP\"}");
        mensaje.setFechaEnvio(LocalDateTime.now());
        mensaje.setActivo(true);
        return mensaje;
    }

    private static EncuestaEntity encuesta(Long encuestaId, MensajeEntity mensaje, boolean allowMultiple, UsuarioEntity createdBy) {
        EncuestaEntity encuesta = new EncuestaEntity();
        encuesta.setId(encuestaId);
        encuesta.setMensaje(mensaje);
        encuesta.setChat(mensaje.getChat());
        encuesta.setQuestion("Pregunta");
        encuesta.setAllowMultiple(allowMultiple);
        encuesta.setCreatedBy(createdBy);
        encuesta.setCreatedAt(LocalDateTime.now());
        encuesta.setActivo(true);
        return encuesta;
    }

    private static EncuestaOpcionEntity opcion(EncuestaEntity encuesta, Long id, String key, String text, int orderIndex) {
        EncuestaOpcionEntity opcion = new EncuestaOpcionEntity();
        opcion.setId(id);
        opcion.setEncuesta(encuesta);
        opcion.setOptionKey(key);
        opcion.setOptionText(text);
        opcion.setOrderIndex(orderIndex);
        opcion.setVoteCount(0L);
        return opcion;
    }

    private static EncuestaVotoEntity voto(EncuestaEntity encuesta, EncuestaOpcionEntity opcion, UsuarioEntity user) {
        EncuestaVotoEntity voto = new EncuestaVotoEntity();
        voto.setId(999L);
        voto.setEncuesta(encuesta);
        voto.setOpcion(opcion);
        voto.setUsuario(user);
        voto.setCreatedAt(LocalDateTime.now());
        return voto;
    }
}
