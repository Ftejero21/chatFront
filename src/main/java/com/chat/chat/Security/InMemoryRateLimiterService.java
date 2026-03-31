package com.chat.chat.Security;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class InMemoryRateLimiterService {

    private static final long MIN_RETRY_SECONDS = 1L;
    private static final long CLEANUP_EVERY_OPS = 512L;
    private static final long STALE_ENTRY_MILLIS = Duration.ofHours(24).toMillis();

    private final Map<String, Counter> counters = new ConcurrentHashMap<>();
    private final AtomicLong opCounter = new AtomicLong(0);

    public RateLimitDecision consume(String key, int limit, Duration window) {
        if (key == null || key.isBlank() || limit <= 0 || window == null || window.isZero() || window.isNegative()) {
            return new RateLimitDecision(true, 0L);
        }

        long now = System.currentTimeMillis();
        long windowMs = window.toMillis();
        Counter counter = counters.computeIfAbsent(key, k -> new Counter(now));

        synchronized (counter) {
            if (now - counter.windowStartMs >= windowMs) {
                counter.windowStartMs = now;
                counter.count = 0;
            }
            counter.lastSeenMs = now;

            if (counter.count >= limit) {
                long remainingMs = Math.max(0L, windowMs - (now - counter.windowStartMs));
                long retryAfter = Math.max(MIN_RETRY_SECONDS, (long) Math.ceil(remainingMs / 1000.0));
                maybeCleanup(now);
                return new RateLimitDecision(false, retryAfter);
            }

            counter.count++;
        }

        maybeCleanup(now);
        return new RateLimitDecision(true, 0L);
    }

    private void maybeCleanup(long now) {
        long current = opCounter.incrementAndGet();
        if (current % CLEANUP_EVERY_OPS != 0) {
            return;
        }
        counters.entrySet().removeIf(entry -> now - entry.getValue().lastSeenMs > STALE_ENTRY_MILLIS);
    }

    private static final class Counter {
        long windowStartMs;
        long lastSeenMs;
        int count;

        Counter(long now) {
            this.windowStartMs = now;
            this.lastSeenMs = now;
            this.count = 0;
        }
    }
}
