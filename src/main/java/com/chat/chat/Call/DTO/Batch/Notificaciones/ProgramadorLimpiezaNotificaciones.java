package com.chat.chat.Call.DTO.Batch.Notificaciones;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Configuration
public class ProgramadorLimpiezaNotificaciones {

    private static final Logger log = LoggerFactory.getLogger(ProgramadorLimpiezaNotificaciones.class);
    private static final String PARAM_CUTOFF = "cutoff";
    private static final String PARAM_TIMESTAMP = "timestamp";
    private static final String PARAM_RETENTION_DAYS = "retentionDays";
    private static final String PROP_ENABLED = "${app.notifications.cleanup.enabled:true}";
    private static final String PROP_ZONE = "${app.notifications.cleanup.zone:Europe/Madrid}";
    private static final String PROP_RETENTION_DAYS = "${app.notifications.cleanup.retention-days:30}";
    private static final String PROP_MAX_ATTEMPTS = "${app.notifications.cleanup.max-launch-attempts:3}";
    private static final String PROP_BACKOFF_SECONDS = "${app.notifications.cleanup.launch-backoff-seconds:30}";
    private static final String CRON_SEMANAL_VIERNES = "${app.notifications.cleanup.cron:0 30 2 ? * FRI}";

    private final JobLauncher jobLauncher;
    private final Job cleanupNotificationsJob;

    @Value(PROP_ENABLED)
    private boolean enabled;

    @Value(PROP_ZONE)
    private String cleanupZoneId;

    @Value(PROP_RETENTION_DAYS)
    private int retentionDays;

    @Value(PROP_MAX_ATTEMPTS)
    private int maxLaunchAttempts;

    @Value(PROP_BACKOFF_SECONDS)
    private int launchBackoffSeconds;

    public ProgramadorLimpiezaNotificaciones(
            JobLauncher jobLauncher,
            @Qualifier("cleanupNotificationsJob") Job cleanupNotificationsJob
    ) {
        this.jobLauncher = jobLauncher;
        this.cleanupNotificationsJob = cleanupNotificationsJob;
    }

    @Scheduled(cron = CRON_SEMANAL_VIERNES, zone = PROP_ZONE)
    public void semanalViernes() throws Exception {
        if (!enabled) {
            return;
        }
        lanzarConReintento();
    }

    public void lanzar() throws Exception {
        lanzarConReintento();
    }

    private void lanzarConReintento() throws Exception {
        ZoneId schedulerZone = resolveZone(cleanupZoneId);
        ZoneId serverZone = ZoneId.systemDefault();
        int safeRetentionDays = Math.max(1, retentionDays);
        int safeMaxAttempts = Math.max(1, maxLaunchAttempts);
        int safeBackoffSeconds = Math.max(0, launchBackoffSeconds);

        // Corta al inicio del dia en la zona del scheduler para tener limpieza determinista por fecha.
        ZonedDateTime startOfRetentionDayInSchedulerZone = ZonedDateTime.now(schedulerZone)
                .minusDays(safeRetentionDays)
                .toLocalDate()
                .atStartOfDay(schedulerZone);
        LocalDateTime cutoffServerZone = startOfRetentionDayInSchedulerZone
                .withZoneSameInstant(serverZone)
                .toLocalDateTime();

        JobParameters params = new JobParametersBuilder()
                .addString(PARAM_CUTOFF, cutoffServerZone.toString())
                .addLong(PARAM_RETENTION_DAYS, (long) safeRetentionDays)
                .addLong(PARAM_TIMESTAMP, System.currentTimeMillis())
                .toJobParameters();

        Exception lastFailure = null;
        for (int attempt = 1; attempt <= safeMaxAttempts; attempt++) {
            try {
                log.info(
                        "Lanzando cleanupNotificationsJob intento {}/{} con cutoff={} (retentionDays={}, schedulerZone={}, serverZone={})",
                        attempt,
                        safeMaxAttempts,
                        cutoffServerZone,
                        safeRetentionDays,
                        schedulerZone,
                        serverZone
                );
                JobExecution execution = jobLauncher.run(cleanupNotificationsJob, params);
                if (execution.getStatus().isUnsuccessful()) {
                    throw new IllegalStateException("cleanupNotificationsJob finalizo en estado " + execution.getStatus());
                }
                return;
            } catch (Exception ex) {
                lastFailure = ex;
                if (attempt >= safeMaxAttempts) {
                    break;
                }
                log.warn(
                        "Fallo intento {}/{} de cleanupNotificationsJob. Reintento en {}s. Causa: {}",
                        attempt,
                        safeMaxAttempts,
                        safeBackoffSeconds,
                        ex.getClass().getSimpleName()
                );
                if (safeBackoffSeconds > 0) {
                    try {
                        Thread.sleep(safeBackoffSeconds * 1000L);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        throw new IllegalStateException("Interrumpido esperando reintento de cleanupNotificationsJob", interrupted);
                    }
                }
            }
        }
        throw new IllegalStateException("cleanupNotificationsJob fallo tras " + safeMaxAttempts + " intentos", lastFailure);
    }

    private ZoneId resolveZone(String raw) {
        if (raw == null || raw.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(raw.trim());
        } catch (Exception ex) {
            log.warn("Zona invalida '{}', usando zone por defecto del servidor", raw);
            return ZoneId.systemDefault();
        }
    }
}
