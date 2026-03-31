package com.chat.chat.Service.MensajeProgramadoService;

import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Utils.AdminAuditCrypto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CifradorE2EMensajeProgramadoServiceCompatTest {

    private static final OAEPParameterSpec OAEP_SHA256_SPEC = new OAEPParameterSpec(
            "SHA-256",
            "MGF1",
            MGF1ParameterSpec.SHA256,
            PSource.PSpecified.DEFAULT
    );

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock
    private AdminAuditCrypto adminAuditCrypto;

    private CifradorE2EMensajeProgramadoService service;

    @BeforeEach
    void setUp() {
        service = new CifradorE2EMensajeProgramadoService(adminAuditCrypto);
    }

    @Test
    void individual_es_descifrable_por_emisor_y_receptor_con_formato_webcrypto() throws Exception {
        KeyPair senderKeyPair = generateRsa();
        KeyPair receiverKeyPair = generateRsa();
        when(adminAuditCrypto.getAuditPublicKeySpkiBase64()).thenReturn(null);

        UsuarioEntity emisor = usuario(11L, senderKeyPair);
        UsuarioEntity receptor = usuario(22L, receiverKeyPair);
        String plain = "mensaje programado individual";

        CifradorE2EMensajeProgramadoService.ResultadoCifradoProgramado result =
                service.cifrarTextoIndividual(plain, emisor, receptor);

        JsonNode payload = OBJECT_MAPPER.readTree(result.payloadJson());
        assertEquals("E2E", payload.path("type").asText());
        assertNotNull(payload.get("iv"));
        assertNotNull(payload.get("ciphertext"));
        assertNotNull(payload.get("forEmisor"));
        assertNotNull(payload.get("forReceptor"));
        assertNull(payload.get("forAdmin"));

        byte[] aesKeyFromSenderEnvelope = decryptEnvelope(payload.path("forEmisor").asText(), senderKeyPair.getPrivate());
        byte[] aesKeyFromReceiverEnvelope = decryptEnvelope(payload.path("forReceptor").asText(), receiverKeyPair.getPrivate());
        assertArrayEquals(aesKeyFromSenderEnvelope, aesKeyFromReceiverEnvelope);

        String decrypted = decryptCiphertext(
                aesKeyFromSenderEnvelope,
                payload.path("iv").asText(),
                payload.path("ciphertext").asText());
        assertEquals(plain, decrypted);
    }

    @Test
    void grupal_es_descifrable_por_receptores_con_formato_webcrypto() throws Exception {
        KeyPair senderKeyPair = generateRsa();
        KeyPair receiver1KeyPair = generateRsa();
        KeyPair receiver2KeyPair = generateRsa();
        when(adminAuditCrypto.getAuditPublicKeySpkiBase64()).thenReturn(null);

        UsuarioEntity emisor = usuario(11L, senderKeyPair);
        UsuarioEntity receptor1 = usuario(22L, receiver1KeyPair);
        UsuarioEntity receptor2 = usuario(33L, receiver2KeyPair);
        String plain = "mensaje programado grupal";

        CifradorE2EMensajeProgramadoService.ResultadoCifradoProgramado result =
                service.cifrarTextoGrupal(plain, emisor, List.of(receptor1, receptor2));

        JsonNode payload = OBJECT_MAPPER.readTree(result.payloadJson());
        assertEquals("E2E_GROUP", payload.path("type").asText());
        assertNotNull(payload.get("forEmisor"));
        assertNotNull(payload.get("forReceptores"));
        assertEquals(2, payload.path("forReceptores").size());

        byte[] aesKeyReceiver1 = decryptEnvelope(payload.path("forReceptores").path("22").asText(), receiver1KeyPair.getPrivate());
        byte[] aesKeyReceiver2 = decryptEnvelope(payload.path("forReceptores").path("33").asText(), receiver2KeyPair.getPrivate());
        assertArrayEquals(aesKeyReceiver1, aesKeyReceiver2);

        String decrypted = decryptCiphertext(
                aesKeyReceiver1,
                payload.path("iv").asText(),
                payload.path("ciphertext").asText());
        assertEquals(plain, decrypted);
    }

    @Test
    void forAdmin_opcional_no_contamina_envelopes_principales() throws Exception {
        KeyPair senderKeyPair = generateRsa();
        KeyPair receiverKeyPair = generateRsa();
        KeyPair adminKeyPair = generateRsa();

        when(adminAuditCrypto.getAuditPublicKeySpkiBase64())
                .thenReturn(Base64.getEncoder().encodeToString(adminKeyPair.getPublic().getEncoded()));

        UsuarioEntity emisor = usuario(11L, senderKeyPair);
        UsuarioEntity receptor = usuario(22L, receiverKeyPair);
        String plain = "mensaje con forAdmin";

        CifradorE2EMensajeProgramadoService.ResultadoCifradoProgramado result =
                service.cifrarTextoIndividual(plain, emisor, receptor);

        JsonNode payload = OBJECT_MAPPER.readTree(result.payloadJson());
        assertNotNull(payload.get("forAdmin"));

        byte[] aesFromSender = decryptEnvelope(payload.path("forEmisor").asText(), senderKeyPair.getPrivate());
        byte[] aesFromReceiver = decryptEnvelope(payload.path("forReceptor").asText(), receiverKeyPair.getPrivate());
        assertArrayEquals(aesFromSender, aesFromReceiver);

        byte[] adminPlainBytes = decryptEnvelope(payload.path("forAdmin").asText(), adminKeyPair.getPrivate());
        assertEquals(plain, new String(adminPlainBytes, StandardCharsets.UTF_8));
    }

    private static UsuarioEntity usuario(Long id, KeyPair keyPair) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setActivo(true);
        u.setPublicKey(Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded()));
        return u;
    }

    private static KeyPair generateRsa() throws Exception {
        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
        keyPairGenerator.initialize(2048);
        return keyPairGenerator.generateKeyPair();
    }

    private static byte[] decryptEnvelope(String envelopeBase64, PrivateKey privateKey) throws Exception {
        Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        rsa.init(Cipher.DECRYPT_MODE, privateKey, OAEP_SHA256_SPEC);
        return rsa.doFinal(Base64.getDecoder().decode(envelopeBase64));
    }

    private static String decryptCiphertext(byte[] aesKey,
                                            String ivBase64,
                                            String ciphertextBase64) throws Exception {
        byte[] iv = Base64.getDecoder().decode(ivBase64);
        byte[] ciphertext = Base64.getDecoder().decode(ciphertextBase64);

        javax.crypto.spec.SecretKeySpec secretKeySpec = new javax.crypto.spec.SecretKeySpec(aesKey, "AES");
        Cipher aes = Cipher.getInstance("AES/GCM/NoPadding");
        aes.init(Cipher.DECRYPT_MODE, secretKeySpec, new GCMParameterSpec(128, iv));
        byte[] plainBytes = aes.doFinal(ciphertext);
        return new String(plainBytes, StandardCharsets.UTF_8);
    }
}
