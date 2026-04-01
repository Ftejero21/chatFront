package com.chat.chat.Security;

public record RateLimitDecision(boolean allowed, long retryAfterSeconds) {
}
