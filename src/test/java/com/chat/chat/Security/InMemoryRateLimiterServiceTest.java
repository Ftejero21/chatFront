package com.chat.chat.Security;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InMemoryRateLimiterServiceTest {

    @Test
    void consume_bloqueaAlSuperarLimiteYSeRecuperaTrasVentana() throws InterruptedException {
        InMemoryRateLimiterService limiter = new InMemoryRateLimiterService();
        String key = "test:key";
        Duration window = Duration.ofMillis(200);

        assertTrue(limiter.consume(key, 2, window).allowed());
        assertTrue(limiter.consume(key, 2, window).allowed());

        RateLimitDecision denied = limiter.consume(key, 2, window);
        assertFalse(denied.allowed());
        assertTrue(denied.retryAfterSeconds() >= 1);

        Thread.sleep(250);
        assertTrue(limiter.consume(key, 2, window).allowed());
    }
}
