package com.chat.chat.Repository;

import com.chat.chat.Entity.E2EPrivateKeyBackupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface E2EPrivateKeyBackupRepository extends JpaRepository<E2EPrivateKeyBackupEntity, Long> {
    Optional<E2EPrivateKeyBackupEntity> findByUserId(Long userId);
}
