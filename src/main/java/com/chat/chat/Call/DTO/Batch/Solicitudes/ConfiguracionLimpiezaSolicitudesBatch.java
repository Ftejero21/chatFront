package com.chat.chat.Call.DTO.Batch.Solicitudes;

import com.chat.chat.Repository.GroupInviteRepo;
import com.chat.chat.Repository.SolicitudDesbaneoRepository;
import com.chat.chat.Utils.InviteStatus;
import com.chat.chat.Utils.SolicitudDesbaneoEstado;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.StepExecutionListener;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.listener.JobExecutionListenerSupport;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.Chunk;
import org.springframework.batch.item.ItemWriter;
import org.springframework.batch.item.data.RepositoryItemReader;
import org.springframework.batch.item.data.builder.RepositoryItemReaderBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Configuration
public class ConfiguracionLimpiezaSolicitudesBatch {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracionLimpiezaSolicitudesBatch.class);
    private static final String JOB_NAME = "weeklyFlowsCleanupJob";

    private static final String PARAM_WEEK_FROM = "weekFrom";
    private static final String PARAM_WEEK_TO = "weekTo";
    private static final String PARAM_PENDING_CUTOFF = "pendingCutoff";
    private static final String PARAM_EXPIRED_AT = "expiredAt";

    private static final String SORT_ID = "id";

    private static final String STEP_EXPIRE_PENDING = "expireOldPendingInvitesStep";
    private static final String STEP_INVITES = "cleanupAcceptedInvitesStep";
    private static final String STEP_SOLICITUDES = "cleanupClosedUnbanRequestsStep";

    @Bean
    @StepScope
    public RepositoryItemReader<Long> pendingInvitesExpirationReader(
            GroupInviteRepo groupInviteRepo,
            @Value("#{jobParameters['pendingCutoff']}") String pendingCutoffIso,
            @Value("${app.weekly.flows.cleanup.page-size:1000}") int pageSize
    ) {
        LocalDateTime cutoff = parseRequiredIsoDateTime(pendingCutoffIso, PARAM_PENDING_CUTOFF);
        return new RepositoryItemReaderBuilder<Long>()
                .name("pendingInvitesExpirationReader")
                .repository(groupInviteRepo)
                .methodName("findPendingIdsForExpiration")
                .arguments(List.of(InviteStatus.PENDING, cutoff))
                .pageSize(pageSize)
                .sorts(Collections.singletonMap(SORT_ID, Sort.Direction.ASC))
                .saveState(true)
                .build();
    }

    @Bean
    @StepScope
    public ItemWriter<Long> pendingInvitesExpirationWriter(
            GroupInviteRepo groupInviteRepo,
            @Value("#{jobParameters['expiredAt']}") String expiredAtIso
    ) {
        LocalDateTime expiredAt = parseRequiredIsoDateTime(expiredAtIso, PARAM_EXPIRED_AT);
        return new ItemWriter<Long>() {
            @Override
            public void write(Chunk<? extends Long> chunk) {
                List<Long> ids = new ArrayList<>(chunk.getItems());
                if (ids.isEmpty()) {
                    return;
                }
                groupInviteRepo.bulkTransitionStatusByIds(
                        ids,
                        InviteStatus.PENDING,
                        InviteStatus.DECLINED,
                        expiredAt
                );
            }
        };
    }

    @Bean
    public Step expireOldPendingInvitesStep(
            JobRepository jobRepository,
            PlatformTransactionManager tx,
            @Qualifier("pendingInvitesExpirationReader") RepositoryItemReader<Long> pendingInvitesExpirationReader,
            @Qualifier("pendingInvitesExpirationWriter") ItemWriter<Long> pendingInvitesExpirationWriter,
            @Value("${app.weekly.flows.cleanup.chunk-size:500}") int chunkSize,
            @Value("${app.weekly.flows.cleanup.retry-limit:3}") int retryLimit
    ) {
        int safeChunkSize = Math.max(1, chunkSize);
        int safeRetryLimit = Math.max(0, retryLimit);
        return new StepBuilder(STEP_EXPIRE_PENDING, jobRepository)
                .<Long, Long>chunk(safeChunkSize, tx)
                .reader(pendingInvitesExpirationReader)
                .writer(pendingInvitesExpirationWriter)
                .faultTolerant()
                .retryLimit(safeRetryLimit)
                .retry(TransientDataAccessException.class)
                .listener(stepLogListener(STEP_EXPIRE_PENDING))
                .build();
    }

    @Bean
    @StepScope
    public RepositoryItemReader<Long> acceptedInvitesCleanupReader(
            GroupInviteRepo groupInviteRepo,
            @Value("#{jobParameters['weekFrom']}") String weekFromIso,
            @Value("#{jobParameters['weekTo']}") String weekToIso,
            @Value("${app.weekly.flows.cleanup.page-size:1000}") int pageSize
    ) {
        LocalDateTime from = parseRequiredIsoDateTime(weekFromIso, PARAM_WEEK_FROM);
        LocalDateTime to = parseRequiredIsoDateTime(weekToIso, PARAM_WEEK_TO);
        return new RepositoryItemReaderBuilder<Long>()
                .name("acceptedInvitesCleanupReader")
                .repository(groupInviteRepo)
                .methodName("findIdsForWeeklyCleanup")
                .arguments(List.of(InviteStatus.ACCEPTED, from, to))
                .pageSize(pageSize)
                .sorts(Collections.singletonMap(SORT_ID, Sort.Direction.ASC))
                .saveState(true)
                .build();
    }

    @Bean
    public ItemWriter<Long> acceptedInvitesCleanupWriter(GroupInviteRepo groupInviteRepo) {
        return new ItemWriter<Long>() {
            @Override
            public void write(Chunk<? extends Long> chunk) {
                List<Long> ids = new ArrayList<>(chunk.getItems());
                if (ids.isEmpty()) {
                    return;
                }
                groupInviteRepo.deleteAllByIdInBatch(ids);
            }
        };
    }

    @Bean
    public Step cleanupAcceptedInvitesStep(
            JobRepository jobRepository,
            PlatformTransactionManager tx,
            @Qualifier("acceptedInvitesCleanupReader") RepositoryItemReader<Long> acceptedInvitesCleanupReader,
            @Qualifier("acceptedInvitesCleanupWriter") ItemWriter<Long> acceptedInvitesCleanupWriter,
            @Value("${app.weekly.flows.cleanup.chunk-size:500}") int chunkSize,
            @Value("${app.weekly.flows.cleanup.retry-limit:3}") int retryLimit
    ) {
        int safeChunkSize = Math.max(1, chunkSize);
        int safeRetryLimit = Math.max(0, retryLimit);
        return new StepBuilder(STEP_INVITES, jobRepository)
                .<Long, Long>chunk(safeChunkSize, tx)
                .reader(acceptedInvitesCleanupReader)
                .writer(acceptedInvitesCleanupWriter)
                .faultTolerant()
                .retryLimit(safeRetryLimit)
                .retry(TransientDataAccessException.class)
                .listener(stepLogListener(STEP_INVITES))
                .build();
    }

    @Bean
    @StepScope
    public RepositoryItemReader<Long> closedUnbanRequestsCleanupReader(
            SolicitudDesbaneoRepository solicitudDesbaneoRepository,
            @Value("#{jobParameters['weekFrom']}") String weekFromIso,
            @Value("#{jobParameters['weekTo']}") String weekToIso,
            @Value("${app.weekly.flows.cleanup.page-size:1000}") int pageSize
    ) {
        LocalDateTime from = parseRequiredIsoDateTime(weekFromIso, PARAM_WEEK_FROM);
        LocalDateTime to = parseRequiredIsoDateTime(weekToIso, PARAM_WEEK_TO);
        return new RepositoryItemReaderBuilder<Long>()
                .name("closedUnbanRequestsCleanupReader")
                .repository(solicitudDesbaneoRepository)
                .methodName("findIdsForWeeklyCleanup")
                .arguments(List.of(
                        List.of(SolicitudDesbaneoEstado.APROBADA, SolicitudDesbaneoEstado.RECHAZADA),
                        from,
                        to
                ))
                .pageSize(pageSize)
                .sorts(Collections.singletonMap(SORT_ID, Sort.Direction.ASC))
                .saveState(true)
                .build();
    }

    @Bean
    public ItemWriter<Long> closedUnbanRequestsCleanupWriter(SolicitudDesbaneoRepository solicitudDesbaneoRepository) {
        return new ItemWriter<Long>() {
            @Override
            public void write(Chunk<? extends Long> chunk) {
                List<Long> ids = new ArrayList<>(chunk.getItems());
                if (ids.isEmpty()) {
                    return;
                }
                solicitudDesbaneoRepository.deleteAllByIdInBatch(ids);
            }
        };
    }

    @Bean
    public Step cleanupClosedUnbanRequestsStep(
            JobRepository jobRepository,
            PlatformTransactionManager tx,
            @Qualifier("closedUnbanRequestsCleanupReader") RepositoryItemReader<Long> closedUnbanRequestsCleanupReader,
            @Qualifier("closedUnbanRequestsCleanupWriter") ItemWriter<Long> closedUnbanRequestsCleanupWriter,
            @Value("${app.weekly.flows.cleanup.chunk-size:500}") int chunkSize,
            @Value("${app.weekly.flows.cleanup.retry-limit:3}") int retryLimit
    ) {
        int safeChunkSize = Math.max(1, chunkSize);
        int safeRetryLimit = Math.max(0, retryLimit);
        return new StepBuilder(STEP_SOLICITUDES, jobRepository)
                .<Long, Long>chunk(safeChunkSize, tx)
                .reader(closedUnbanRequestsCleanupReader)
                .writer(closedUnbanRequestsCleanupWriter)
                .faultTolerant()
                .retryLimit(safeRetryLimit)
                .retry(TransientDataAccessException.class)
                .listener(stepLogListener(STEP_SOLICITUDES))
                .build();
    }

    @Bean
    public Job weeklyFlowsCleanupJob(
            JobRepository jobRepository,
            @Qualifier("expireOldPendingInvitesStep") Step expireOldPendingInvitesStep,
            @Qualifier("cleanupAcceptedInvitesStep") Step cleanupAcceptedInvitesStep,
            @Qualifier("cleanupClosedUnbanRequestsStep") Step cleanupClosedUnbanRequestsStep,
            GroupInviteRepo groupInviteRepo,
            SolicitudDesbaneoRepository solicitudDesbaneoRepository
    ) {
        return new JobBuilder(JOB_NAME, jobRepository)
                .start(expireOldPendingInvitesStep)
                .next(cleanupAcceptedInvitesStep)
                .next(cleanupClosedUnbanRequestsStep)
                .listener(new JobExecutionListenerSupport() {
                    @Override
                    public void beforeJob(JobExecution jobExecution) {
                        LocalDateTime pendingCutoff = parseRequiredIsoDateTime(
                                jobExecution.getJobParameters().getString(PARAM_PENDING_CUTOFF),
                                PARAM_PENDING_CUTOFF
                        );
                        LocalDateTime from = parseRequiredIsoDateTime(
                                jobExecution.getJobParameters().getString(PARAM_WEEK_FROM),
                                PARAM_WEEK_FROM
                        );
                        LocalDateTime to = parseRequiredIsoDateTime(
                                jobExecution.getJobParameters().getString(PARAM_WEEK_TO),
                                PARAM_WEEK_TO
                        );
                        long pendingCandidates = groupInviteRepo
                                .countByStatusAndCreatedAtBefore(InviteStatus.PENDING, pendingCutoff);
                        long invitesCandidates = groupInviteRepo
                                .countByStatusAndRespondedAtGreaterThanEqualAndRespondedAtLessThan(InviteStatus.ACCEPTED, from, to);
                        long solicitudesCandidates = solicitudDesbaneoRepository
                                .countByEstadoInAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThan(
                                        List.of(SolicitudDesbaneoEstado.APROBADA, SolicitudDesbaneoEstado.RECHAZADA),
                                        from,
                                        to
                                );
                        log.info(
                                "weeklyFlowsCleanupJob pendingCutoff={} | ventana [{} - {}): pendingToDeclined={}, invitesAccepted={}, solicitudesCerradas={}",
                                pendingCutoff, from, to, pendingCandidates, invitesCandidates, solicitudesCandidates
                        );
                    }

                    @Override
                    public void afterJob(JobExecution jobExecution) {
                        log.info("Job {} finalizado con estado {}", JOB_NAME, jobExecution.getStatus());
                    }
                })
                .build();
    }

    private StepExecutionListener stepLogListener(String stepName) {
        return new StepExecutionListener() {
            @Override
            public void beforeStep(StepExecution stepExecution) {
                String from = stepExecution.getJobParameters().getString(PARAM_WEEK_FROM);
                String to = stepExecution.getJobParameters().getString(PARAM_WEEK_TO);
                log.info("Iniciando {} con ventana [{} - {})", stepName, from, to);
            }

            @Override
            public ExitStatus afterStep(StepExecution stepExecution) {
                log.info(
                        "{} finalizado: read={}, write={}, skip={}",
                        stepName,
                        stepExecution.getReadCount(),
                        stepExecution.getWriteCount(),
                        stepExecution.getSkipCount()
                );
                return stepExecution.getExitStatus();
            }
        };
    }

    private LocalDateTime parseRequiredIsoDateTime(String value, String paramName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("job parameter '" + paramName + "' es obligatorio");
        }
        return LocalDateTime.parse(value);
    }
}
