package com.chat.chat.Service.CallService;

import com.chat.chat.Call.*;
import com.chat.chat.Call.DTO.CallAnswerDTO;
import com.chat.chat.Call.DTO.CallEndDTO;
import com.chat.chat.Call.DTO.CallInviteDTO;
import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Utils.Constantes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class CallServiceImpl implements CallService {
    private static final Logger LOGGER = LoggerFactory.getLogger(CallServiceImpl.class);

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CallManager callManager;

    @Override
    public CallInviteWS startCall(CallInviteDTO dto) {
        LOGGER.info("[CALL] startCall callerId={} calleeId={} chatId={}",
                dto == null ? null : dto.getCallerId(),
                dto == null ? null : dto.getCalleeId(),
                dto == null ? null : dto.getChatId());
        if (dto == null || dto.getCallerId() == null || dto.getCalleeId() == null) return null;

        CallSession session = callManager.create(dto.getCallerId(), dto.getCalleeId());

        // Obtener datos del caller (nombre/apellido)
        String nombre = Constantes.DEFAULT_CALLER_NAME;
        String apellido = "";
        try {
            UsuarioEntity u = usuarioRepository.findById(dto.getCallerId()).orElse(null);
            if (u != null) {
                if (u.getNombre() != null) nombre = u.getNombre();
                if (u.getApellido() != null) apellido = u.getApellido();
            }
        } catch (Exception ignored) {}

        CallInviteWS invite = new CallInviteWS();
        invite.setCallId(session.getCallId());
        invite.setCallerId(dto.getCallerId());
        invite.setCallerNombre(nombre);
        invite.setCallerApellido(apellido);
        invite.setCalleeId(dto.getCalleeId());
        invite.setChatId(dto.getChatId());

        // Notificar al CALLEE
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_INVITE + dto.getCalleeId(), invite);

        // Feedback al CALLER: "RINGING"
        CallAnswerWS ringing = new CallAnswerWS();
        ringing.setCallId(session.getCallId());
        ringing.setAccepted(false);
        ringing.setFromUserId(dto.getCalleeId());
        ringing.setToUserId(dto.getCallerId());
        ringing.setReason(Constantes.RINGING);
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_ANSWER + dto.getCallerId(), ringing);

        return invite;
    }

    @Override
    public CallAnswerWS answerCall(CallAnswerDTO dto) {
        LOGGER.info("[CALL] answerCall callId={} callerId={} calleeId={} accepted={}",
                dto == null ? null : dto.getCallId(),
                dto == null ? null : dto.getCallerId(),
                dto == null ? null : dto.getCalleeId(),
                dto != null && dto.isAccepted());
        if (dto == null || dto.getCallId() == null) return null;

        CallSession session = callManager.get(dto.getCallId());
        if (session == null) return null;

        // Actualizar estado
        callManager.setStatus(dto.getCallId(),
                dto.isAccepted() ? CallSession.Status.ACTIVE : CallSession.Status.ENDED);

        CallAnswerWS answer = new CallAnswerWS();
        answer.setCallId(dto.getCallId());
        answer.setAccepted(dto.isAccepted());
        answer.setFromUserId(dto.getCalleeId());  // quien responde
        answer.setToUserId(dto.getCallerId());    // a quien se notifica
        answer.setReason(dto.getReason());

        // Notificar al CALLER (iniciador)
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_ANSWER + dto.getCallerId(), answer);
        // (Eco) Notificar al CALLEE
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_ANSWER + dto.getCalleeId(), answer);

        return answer;
    }

    @Override
    public CallEndWS endCall(CallEndDTO dto) {
        LOGGER.info("[CALL] endCall callId={} byUserId={}",
                dto == null ? null : dto.getCallId(),
                dto == null ? null : dto.getByUserId());
        if (dto == null || dto.getCallId() == null || dto.getByUserId() == null) return null;

        CallSession session = callManager.get(dto.getCallId());
        if (session == null) return null;

        callManager.end(dto.getCallId());

        Long notifyUserId = dto.getByUserId().equals(session.getCallerId())
                ? session.getCalleeId()
                : session.getCallerId();

        CallEndWS end = new CallEndWS();
        end.setCallId(dto.getCallId());
        end.setByUserId(dto.getByUserId());
        end.setNotifyUserId(notifyUserId);

        // Notificar a la otra parte
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_END + notifyUserId, end);
        // (Eco) Notificar al que cuelga
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_END + dto.getByUserId(), end);

        return end;
    }
}
