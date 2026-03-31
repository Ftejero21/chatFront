package com.chat.chat.Call.DTO.Batch.Notificaciones;

import com.chat.chat.Repository.NotificationRepo;
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
public class ConfiguracionLimpiezaNotificacionesBatch {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracionLimpiezaNotificacionesBatch.class);
    private static final String JOB_NAME = "cleanupNotificationsJob";
    private static final String STEP_NAME = "cleanupNotificationsStep";
    private static final String READER_NAME = "cleanupNotificationsReader";
    private static final String REPO_METHOD_FIND_IDS = "findIdsForCleanup";
    private static final String PARAM_CUTOFF = "cutoff";
    private static final String SORT_ID = "id";

    @Bean
    @StepScope
    public RepositoryItemReader<Long> cleanupNotificationsReader(
            NotificationRepo notificationRepo,
            @Value("#{jobParameters['cutoff']}") String cutoffIso,
            @Value("${app.notifications.cleanup.page-size:1000}") int pageSize
    ) {
        if (cutoffIso == null || cutoffIso.isBlank()) {
            throw new IllegalArgumentException("job parameter 'cutoff' es obligatorio");
        }
        LocalDateTime cutoff = LocalDateTime.parse(cutoffIso);
        return new RepositoryItemReaderBuilder<Long>()
                .name(READER_NAME)
                .repository(notificationRepo)
                .methodName(REPO_METHOD_FIND_IDS)
                .arguments(List.of(cutoff))
                .pageSize(pageSize)
                .sorts(Collections.singletonMap(SORT_ID, Sort.Direction.ASC))
                .saveState(true)
                .build();
    }

    @Bean
    public ItemWriter<Long> cleanupNotificationsWriter(NotificationRepo notificationRepo) {
        return new ItemWriter<Long>() {
            @Override
            public void write(Chunk<? extends Long> chunk) {
                List<Long> ids = new ArrayList<>(chunk.getItems());
                if (ids == null || ids.isEmpty()) {
                    return;
                }
                notificationRepo.deleteAllByIdInBatch(ids);
            }
        };
    }

    @Bean
    public Step cleanupNotificationsStep(
            JobRepository jobRepository,
            PlatformTransactionManager tx,
            @Qualifier("cleanupNotificationsReader")
            RepositoryItemReader<Long> cleanupNotificationsReader,
            @Qualifier("cleanupNotificationsWriter")
            ItemWriter<Long> cleanupNotificationsWriter,
            @Value("${app.notifications.cleanup.chunk-size:500}") int chunkSize,
            @Value("${app.notifications.cleanup.retry-limit:3}") int retryLimit
    ) {
        int safeChunkSize = Math.max(1, chunkSize);
        int safeRetryLimit = Math.max(0, retryLimit);
        return new StepBuilder(STEP_NAME, jobRepository)
                .<Long, Long>chunk(safeChunkSize, tx)
                .reader(cleanupNotificationsReader)
                .writer(cleanupNotificationsWriter)
                .faultTolerant()
                .retryLimit(safeRetryLimit)
                .retry(TransientDataAccessException.class)
                .listener((StepExecutionListener) new StepExecutionListener() {
                    @Override
                    public void beforeStep(StepExecution stepExecution) {
                        String cutoff = stepExecution.getJobParameters().getString(PARAM_CUTOFF);
                        log.info("Iniciando limpieza de notificaciones con cutoff={}", cutoff);
                    }

                    @Override
                    public ExitStatus afterStep(StepExecution stepExecution) {
                        log.info(
                                "Limpieza notificaciones finalizada: read={}, write={}, skip={}",
                                stepExecution.getReadCount(),
                                stepExecution.getWriteCount(),
                                stepExecution.getSkipCount()
                        );
                        return stepExecution.getExitStatus();
                    }
                })
                .build();
    }

    @Bean
    public Job cleanupNotificationsJob(
            JobRepository jobRepository,
            @Qualifier("cleanupNotificationsStep")
            Step cleanupNotificationsStep,
            NotificationRepo notificationRepo
    ) {
        return new JobBuilder(JOB_NAME, jobRepository)
                .start(cleanupNotificationsStep)
                .listener(new JobExecutionListenerSupport() {
                    @Override
                    public void beforeJob(JobExecution jobExecution) {
                        String cutoffIso = jobExecution.getJobParameters().getString(PARAM_CUTOFF);
                        if (cutoffIso == null || cutoffIso.isBlank()) {
                            return;
                        }
                        LocalDateTime cutoff = LocalDateTime.parse(cutoffIso);
                        long candidates = notificationRepo.countBySeenTrueAndResolvedTrueAndCreatedAtBefore(cutoff);
                        log.info("Candidates para limpieza (seen=true,resolved=true,createdAt<{}): {}", cutoff, candidates);
                    }

                    @Override
                    public void afterJob(JobExecution jobExecution) {
                        log.info("Job {} finalizado con estado {}", JOB_NAME, jobExecution.getStatus());
                    }
                })
                .build();
    }
}
