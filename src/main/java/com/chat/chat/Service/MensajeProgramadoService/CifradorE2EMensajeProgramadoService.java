package com.chat.chat.Service.MensajeProgramadoService;

import com.chat.chat.Entity.UsuarioEntity;
import com.chat.chat.Utils.AdminAuditCrypto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class CifradorE2EMensajeProgramadoService {
    private static final Logger LOGGER = LoggerFactory.getLogger(CifradorE2EMensajeProgramadoService.class);

    private static final String TRANSFORM_AES_GCM = "AES/GCM/NoPadding";
    private static final String TRANSFORM_RSA_OAEP_SHA256 = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";
    private static final OAEPParameterSpec OAEP_SHA256_SPEC = new OAEPParameterSpec(
            "SHA-256",
            "MGF1",
            MGF1ParameterSpec.SHA256,
            PSource.PSpecified.DEFAULT
    );
    private static final int IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int AES_KEY_SIZE_BITS = 256;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AdminAuditCrypto adminAuditCrypto;

    public CifradorE2EMensajeProgramadoService(AdminAuditCrypto adminAuditCrypto) {
        this.adminAuditCrypto = adminAuditCrypto;
        LOGGER.info("[SCHEDULED_E2E] CifradorE2EMensajeProgramadoService inicializado");
    }

    public ResultadoCifradoProgramado cifrarTextoIndividual(String textoPlano,
                                                            UsuarioEntity emisor,
                                                            UsuarioEntity receptor) {
        LOGGER.info("[SCHEDULED_E2E] cifrarTextoIndividual emisorId={} receptorId={} hasTexto={}",
                emisor == null ? null : emisor.getId(),
                receptor == null ? null : receptor.getId(),
                textoPlano != null && !textoPlano.isBlank());
        if (textoPlano == null || textoPlano.isBlank()) {
            throw new ExcepcionCifradoProgramado("message_content vacio para cifrado individual", false);
        }
        PublicKey keyEmisor = parsearClavePublicaUsuario(emisor, "emisor");
        PublicKey keyReceptor = parsearClavePublicaUsuario(receptor, "receptor");
        MaterialCifrado material = cifrarTextoPlanoConAes(textoPlano);

        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "E2E");
        payload.put("iv", material.ivBase64());
        payload.put("ciphertext", material.ciphertextBase64());
        ResultadoEnvelopeRsa envelopeEmisor = cifrarConRsaOaep(material.claveAes(), keyEmisor, "forEmisor");
        ResultadoEnvelopeRsa envelopeReceptor = cifrarConRsaOaep(material.claveAes(), keyReceptor, "forReceptor");
        payload.put("forEmisor", envelopeEmisor.envelopeBase64());
        payload.put("forReceptor", envelopeReceptor.envelopeBase64());

        String forAdmin = construirForAdmin(textoPlano);
        if (forAdmin != null) {
            payload.put("forAdmin", forAdmin);
        }
        return new ResultadoCifradoProgramado(aJson(payload), "E2E", envelopeEmisor.algorithmRuntime());
    }

    public ResultadoCifradoProgramado cifrarTextoGrupal(String textoPlano,
                                                        UsuarioEntity emisor,
                                                        List<UsuarioEntity> receptoresActivos) {
        LOGGER.info("[SCHEDULED_E2E] cifrarTextoGrupal emisorId={} receptores={} hasTexto={}",
                emisor == null ? null : emisor.getId(),
                receptoresActivos == null ? 0 : receptoresActivos.size(),
                textoPlano != null && !textoPlano.isBlank());
        if (textoPlano == null || textoPlano.isBlank()) {
            throw new ExcepcionCifradoProgramado("message_content vacio para cifrado grupal", false);
        }
        PublicKey keyEmisor = parsearClavePublicaUsuario(emisor, "emisor");
        MaterialCifrado material = cifrarTextoPlanoConAes(textoPlano);

        LinkedHashMap<String, String> forReceptores = new LinkedHashMap<>();
        if (receptoresActivos != null) {
            receptoresActivos.stream()
                    .filter(Objects::nonNull)
                    .filter(u -> u.getId() != null)
                    .sorted((a, b) -> {
                        Long idA = a.getId();
                        Long idB = b.getId();
                        if (idA == null && idB == null) {
                            return 0;
                        }
                        if (idA == null) {
                            return -1;
                        }
                        if (idB == null) {
                            return 1;
                        }
                        return Long.compare(idA, idB);
                    })
                    .forEach(receptor -> {
                        PublicKey keyReceptor = parsearClavePublicaUsuario(receptor, "receptor_grupal");
                        ResultadoEnvelopeRsa envelope = cifrarConRsaOaep(material.claveAes(), keyReceptor,
                                "forReceptores[" + receptor.getId() + "]");
                        forReceptores.put(String.valueOf(receptor.getId()), envelope.envelopeBase64());
                    });
        }

        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "E2E_GROUP");
        payload.put("iv", material.ivBase64());
        payload.put("ciphertext", material.ciphertextBase64());
        ResultadoEnvelopeRsa envelopeEmisor = cifrarConRsaOaep(material.claveAes(), keyEmisor, "forEmisor");
        payload.put("forEmisor", envelopeEmisor.envelopeBase64());
        payload.put("forReceptores", forReceptores);

        String forAdmin = construirForAdmin(textoPlano);
        if (forAdmin != null) {
            payload.put("forAdmin", forAdmin);
        }
        return new ResultadoCifradoProgramado(aJson(payload), "E2E_GROUP", envelopeEmisor.algorithmRuntime());
    }

    private MaterialCifrado cifrarTextoPlanoConAes(String textoPlano) {
        try {
            KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
            keyGenerator.init(AES_KEY_SIZE_BITS);
            SecretKey secretKey = keyGenerator.generateKey();

            byte[] iv = new byte[IV_LENGTH_BYTES];
            SECURE_RANDOM.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORM_AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(textoPlano.getBytes(StandardCharsets.UTF_8));

            return new MaterialCifrado(secretKey.getEncoded(), base64(iv), base64(ciphertext));
        } catch (Exception ex) {
            throw new ExcepcionCifradoProgramado("fallo cifrado AES-GCM para mensaje programado", ex, false);
        }
    }

    private String construirForAdmin(String textoPlano) {
        String adminPublicKey = adminAuditCrypto.getAuditPublicKeySpkiBase64();
        if (adminPublicKey == null || adminPublicKey.isBlank()) {
            return null;
        }
        PublicKey keyAdmin = parsearClavePublicaBase64(adminPublicKey, "admin_audit", false);
        return cifrarConRsaOaep(textoPlano.getBytes(StandardCharsets.UTF_8), keyAdmin, "forAdmin").envelopeBase64();
    }

    private ResultadoEnvelopeRsa cifrarConRsaOaep(byte[] data, PublicKey publicKey, String contexto) {
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORM_RSA_OAEP_SHA256);
            cipher.init(Cipher.ENCRYPT_MODE, publicKey, OAEP_SHA256_SPEC);
            return new ResultadoEnvelopeRsa(
                    base64(cipher.doFinal(data)),
                    cipher.getAlgorithm());
        } catch (Exception ex) {
            throw new ExcepcionCifradoProgramado("fallo cifrado RSA-OAEP en " + contexto, ex, true);
        }
    }

    private PublicKey parsearClavePublicaUsuario(UsuarioEntity usuario, String contexto) {
        if (usuario == null || usuario.getId() == null) {
            throw new ExcepcionCifradoProgramado("usuario invalido para " + contexto, false);
        }
        String raw = usuario.getPublicKey();
        if (raw == null || raw.isBlank()) {
            throw new ExcepcionCifradoProgramado(
                    "clave publica ausente para usuarioId=" + usuario.getId() + " en " + contexto,
                    true);
        }
        return parsearClavePublicaBase64(raw, contexto + "_user_" + usuario.getId(), true);
    }

    private PublicKey parsearClavePublicaBase64(String rawKey,
                                                String contexto,
                                                boolean recuperable) {
        try {
            String normalized = rawKey
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(normalized);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(der);
            return KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception ex) {
            throw new ExcepcionCifradoProgramado(
                    "clave publica invalida para " + contexto,
                    ex,
                    recuperable);
        }
    }

    private String aJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new ExcepcionCifradoProgramado("fallo serializando payload E2E", ex, false);
        }
    }

    private String base64(byte[] value) {
        return Base64.getEncoder().encodeToString(value);
    }

    public record ResultadoCifradoProgramado(String payloadJson, String e2eType, String rsaRuntimeAlgorithm) {
    }

    private record MaterialCifrado(byte[] claveAes, String ivBase64, String ciphertextBase64) {
    }

    private record ResultadoEnvelopeRsa(String envelopeBase64, String algorithmRuntime) {
    }
}
