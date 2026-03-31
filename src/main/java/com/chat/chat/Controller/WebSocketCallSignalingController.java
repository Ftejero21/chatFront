package com.chat.chat.Controller;

import com.chat.chat.Call.DTO.IceCandidateDTO;
import com.chat.chat.Call.DTO.SdpAnswerDTO;
import com.chat.chat.Call.DTO.SdpOfferDTO;
import com.chat.chat.Utils.Constantes;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
public class WebSocketCallSignalingController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // Caller -> Offer -> Callee
    @MessageMapping(Constantes.WS_APP_CALL_SDP_OFFER)
    public void sdpOffer(@Payload SdpOfferDTO dto) {
        if (dto == null || dto.getToUserId() == null) return;
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_SDP_OFFER + dto.getToUserId(), dto);
    }

    // Callee -> Answer -> Caller
    @MessageMapping(Constantes.WS_APP_CALL_SDP_ANSWER)
    public void sdpAnswer(@Payload SdpAnswerDTO dto) {
        if (dto == null || dto.getToUserId() == null) return;
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_SDP_ANSWER + dto.getToUserId(), dto);
    }

    // ICE candidates (ambos sentidos)
    @MessageMapping(Constantes.WS_APP_CALL_ICE)
    public void ice(@Payload IceCandidateDTO dto) {
        if (dto == null || dto.getToUserId() == null) return;
        messagingTemplate.convertAndSend(Constantes.TOPIC_CALL_ICE + dto.getToUserId(), dto);
    }
}
