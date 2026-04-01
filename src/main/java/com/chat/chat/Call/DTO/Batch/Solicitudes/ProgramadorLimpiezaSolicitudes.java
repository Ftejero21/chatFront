package com.chat.chat.Call.DTO.Batch.Solicitudes;

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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

@Configuration
public class ProgramadorLimpiezaSolicitudes {

    private static final Logger log = LoggerFactory.getLogger(ProgramadorLimpiezaSolicitudes.class);

    private static final String PARAM_WEEK_FROM = "weekFrom";
    private static final String PARAM_WEEK_TO = "weekTo";
    private static final String PARAM_PENDING_CUTOFF = "pendingCutoff";
    private static final String PARAM_EXPIRED_AT = "expiredAt";
    private static final String PARAM_TIMESTAMP = "timestamp";

    private static final String PROP_ENABLED = "${app.weekly.flows.cleanup.enabled:true}";
    private static final String PROP_ZONE = "${app.weekly.flows.cleanup.zone:Europe/Madrid}";
    private static final String PROP_PENDING_EXPIRE_MONTHS = "${app.weekly.flows.cleanup.pending-expire-months:3}";
    private static final String PROP_MAX_ATTEMPTS = "${app.weekly.flows.cleanup.max-launch-attempts:3}";
    private static final String PROP_BACKOFF_SECONDS = "${app.weekly.flows.cleanup.launch-backoff-seconds:30}";
    private static final String CRON_SEMANAL_VIERNES = "${app.weekly.flows.cleanup.cron:0 45 2 ? * FRI}";

    private final JobLauncher jobLauncher;
    private final Job weeklyFlowsCleanupJob;

    @Value(PROP_ENABLED)
    private boolean enabled;

    @Value(PROP_ZONE)
    private String cleanupZoneId;

    @Value(PROP_MAX_ATTEMPTS)
    private int maxLaunchAttempts;

    @Value(PROP_PENDING_EXPIRE_MONTHS)
    private int pendingExpireMonths;

    @Value(PROP_BACKOFF_SECONDS)
    private int launchBackoffSeconds;

    public ProgramadorLimpiezaSolicitudes(
            JobLauncher jobLauncher,
            @Qualifier("weeklyFlowsCleanupJob") Job weeklyFlowsCleanupJob
    ) {
        this.jobLauncher = jobLauncher;
        this.weeklyFlowsCleanupJob = weeklyFlowsCleanupJob;
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
        int safeMaxAttempts = Math.max(1, maxLaunchAttempts);
        int safePendingExpireMonths = Math.max(1, pendingExpireMonths);
        int safeBackoffSeconds = Math.max(0, launchBackoffSeconds);

        ZonedDateTime nowSchedulerZone = ZonedDateTime.now(schedulerZone);
        ZonedDateTime pendingCutoffSchedulerZone = nowSchedulerZone
                .minusMonths(safePendingExpireMonths)
                .toLocalDate()
                .atStartOfDay(schedulerZone);
        LocalDate mondayCurrentWeek = nowSchedulerZone.toLocalDate()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate mondayPreviousWeek = mondayCurrentWeek.minusWeeks(1);

        ZonedDateTime startPreviousWeekSchedulerZone = mondayPreviousWeek.atStartOfDay(schedulerZone);
        ZonedDateTime startCurrentWeekSchedulerZone = mondayCurrentWeek.atStartOfDay(schedulerZone);

        LocalDateTime weekFromServerZone = startPreviousWeekSchedulerZone.withZoneSameInstant(serverZone).toLocalDateTime();
        LocalDateTime weekToServerZone = startCurrentWeekSchedulerZone.withZoneSameInstant(serverZone).toLocalDateTime();
        LocalDateTime pendingCutoffServerZone = pendingCutoffSchedulerZone.withZoneSameInstant(serverZone).toLocalDateTime();
        LocalDateTime expiredAtServerZone = nowSchedulerZone.withZoneSameInstant(serverZone).toLocalDateTime();

        JobParameters params = new JobParametersBuilder()
                .addString(PARAM_PENDING_CUTOFF, pendingCutoffServerZone.toString())
                .addString(PARAM_EXPIRED_AT, expiredAtServerZone.toString())
                .addString(PARAM_WEEK_FROM, weekFromServerZone.toString())
                .addString(PARAM_WEEK_TO, weekToServerZone.toString())
                .addLong(PARAM_TIMESTAMP, System.currentTimeMillis())
                .toJobParameters();

        Exception lastFailure = null;
        for (int attempt = 1; attempt <= safeMaxAttempts; attempt++) {
            try {
                log.info(
                        "Lanzando weeklyFlowsCleanupJob intento {}/{} pendingCutoff={} ({} meses) ventana [{} - {}) schedulerZone={} serverZone={}",
                        attempt,
                        safeMaxAttempts,
                        pendingCutoffServerZone,
                        safePendingExpireMonths,
                        weekFromServerZone,
                        weekToServerZone,
                        schedulerZone,
                        serverZone
                );
                JobExecution execution = jobLauncher.run(weeklyFlowsCleanupJob, params);
                if (execution.getStatus().isUnsuccessful()) {
                    throw new IllegalStateException("weeklyFlowsCleanupJob finalizo en estado " + execution.getStatus());
                }
                return;
            } catch (Exception ex) {
                lastFailure = ex;
                if (attempt >= safeMaxAttempts) {
                    break;
                }
                log.warn(
                        "Fallo intento {}/{} de weeklyFlowsCleanupJob. Reintento en {}s. Causa: {}",
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
                        throw new IllegalStateException("Interrumpido esperando reintento de weeklyFlowsCleanupJob", interrupted);
                    }
                }
            }
        }
        throw new IllegalStateException("weeklyFlowsCleanupJob fallo tras " + safeMaxAttempts + " intentos", lastFailure);
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
