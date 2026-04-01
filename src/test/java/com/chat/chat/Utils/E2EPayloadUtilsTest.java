package com.chat.chat.Utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class E2EPayloadUtilsTest {

    @Test
    void normalizeForStorageAgregaAuditStatusCuandoNoHayForAdmin() {
        String input = "{\"type\":\"E2E\",\"iv\":\"abc\",\"ciphertext\":\"xyz\",\"forEmisor\":\"e\",\"forReceptor\":\"r\"}";

        String output = E2EPayloadUtils.normalizeForStorage(input);

        assertTrue(output.contains("\"auditStatus\":\"NO_AUDITABLE\""));
    }
}
