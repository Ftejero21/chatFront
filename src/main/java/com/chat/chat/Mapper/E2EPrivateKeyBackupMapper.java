package com.chat.chat.Mapper;

import com.chat.chat.DTO.E2EPrivateKeyBackupDTO;
import com.chat.chat.Entity.E2EPrivateKeyBackupEntity;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Locale;

@Component
public class E2EPrivateKeyBackupMapper {

    public E2EPrivateKeyBackupEntity toEntity(Long userId,
                                              E2EPrivateKeyBackupDTO request,
                                              E2EPrivateKeyBackupEntity existing,
                                              LocalDateTime updatedAt) {
        E2EPrivateKeyBackupEntity entity = existing == null ? new E2EPrivateKeyBackupEntity() : existing;
        entity.setUserId(userId);
        entity.setEncryptedPrivateKey(request.getEncryptedPrivateKey());
        entity.setIv(request.getIv());
        entity.setSalt(request.getSalt());
        entity.setKdf(request.getKdf().trim().toUpperCase(Locale.ROOT));
        entity.setKdfHash(request.getKdfHash().trim().toUpperCase(Locale.ROOT));
        entity.setKdfIterations(request.getKdfIterations());
        entity.setKeyLengthBits(request.getKeyLengthBits());
        entity.setPublicKey(request.getPublicKey());
        entity.setPublicKeyFingerprint(request.getPublicKeyFingerprint());
        entity.setUpdatedAt(updatedAt);
        return entity;
    }

    public E2EPrivateKeyBackupDTO toDto(E2EPrivateKeyBackupEntity entity) {
        E2EPrivateKeyBackupDTO dto = new E2EPrivateKeyBackupDTO();
        dto.setEncryptedPrivateKey(entity.getEncryptedPrivateKey());
        dto.setIv(entity.getIv());
        dto.setSalt(entity.getSalt());
        dto.setKdf(entity.getKdf());
        dto.setKdfHash(entity.getKdfHash());
        dto.setKdfIterations(entity.getKdfIterations());
        dto.setKeyLengthBits(entity.getKeyLengthBits());
        dto.setPublicKey(entity.getPublicKey());
        dto.setPublicKeyFingerprint(entity.getPublicKeyFingerprint());
        return dto;
    }
}
