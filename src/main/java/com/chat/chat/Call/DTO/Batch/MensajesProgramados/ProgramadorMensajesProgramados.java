package com.chat.chat.Call.DTO.Batch.MensajesProgramados;

import com.chat.chat.Service.MensajeProgramadoService.MensajeProgramadoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class ProgramadorMensajesProgramados {

    private static final Logger LOGGER = LoggerFactory.getLogger(ProgramadorMensajesProgramados.class);

    private final MensajeProgramadoService mensajeProgramadoService;

    @Value("${app.chat.scheduled.enabled:true}")
    private boolean habilitado;

    @Value("${app.chat.scheduled.batch-size:100}")
    private int batchSize;

    @Value("${app.chat.scheduled.lock-seconds:120}")
    private int lockSeconds;

    public ProgramadorMensajesProgramados(MensajeProgramadoService mensajeProgramadoService) {
        this.mensajeProgramadoService = mensajeProgramadoService;
    }

    @Scheduled(
            fixedDelayString = "${app.chat.scheduled.fixed-delay-ms:30000}",
            initialDelayString = "${app.chat.scheduled.initial-delay-ms:15000}"
    )
    public void ejecutarLoteMensajesProgramados() {
        if (!habilitado) {
            return;
        }
        Instant nowUtc = Instant.now();
        String lockToken = UUID.randomUUID().toString();
        List<Long> ids = mensajeProgramadoService.reclamarMensajesVencidos(
                nowUtc,
                lockToken,
                Math.max(1, batchSize),
                Math.max(10, lockSeconds));
        long procesados = 0;
        for (Long id : ids) {
            try {
                mensajeProgramadoService.procesarMensajeProgramado(id, lockToken);
                procesados++;
            } catch (Exception ex) {
                LOGGER.warn("[SCHEDULED_MESSAGE] fallo procesando id={} error={}", id, ex.getClass().getSimpleName());
            }
        }
        LOGGER.info("[SCHEDULED_MESSAGE_CYCLE] nowUTC={} cantidadPendientesSeleccionados={} cantidadProcesados={} token={}",
                nowUtc,
                ids.size(),
                procesados,
                lockToken);
    }
}
