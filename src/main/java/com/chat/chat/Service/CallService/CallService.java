package com.chat.chat.Service.CallService;

import com.chat.chat.Call.CallAnswerWS;
import com.chat.chat.Call.CallEndWS;
import com.chat.chat.Call.CallInviteWS;
import com.chat.chat.Call.DTO.CallAnswerDTO;
import com.chat.chat.Call.DTO.CallEndDTO;
import com.chat.chat.Call.DTO.CallInviteDTO;

public interface CallService {

    /**
     * A → inicia llamada → B
     * Crea la sesión, obtiene nombre/apellidos del caller y
     * emite los mensajes WS (invite para B, "RINGING" para A).
     * @return payload principal enviado al callee (CALL_INVITE)
     */
    CallInviteWS startCall(CallInviteDTO dto);

    /**
     * B → responde (aceptar / rechazar) → A
     * Actualiza estado de la sesión y emite WS a ambos.
     * @return payload de respuesta enviado (CALL_ANSWER)
     */
    CallAnswerWS answerCall(CallAnswerDTO dto);

    /**
     * Cualquiera → cuelga → notifica al otro
     * Finaliza la sesión y emite WS a ambos.
     * @return payload de fin enviado (CALL_ENDED)
     */
    CallEndWS endCall(CallEndDTO dto);
}
