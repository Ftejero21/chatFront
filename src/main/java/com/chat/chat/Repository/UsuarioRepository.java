package com.chat.chat.Repository;

import com.chat.chat.Entity.UsuarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.QueryHint;

@Repository
public interface UsuarioRepository extends JpaRepository<UsuarioEntity, Long> {

    Optional<UsuarioEntity> findByEmail(String email);

    List<UsuarioEntity> findByActivoTrueAndIdNot(Long id);

    @Query("SELECT u FROM UsuarioEntity u WHERE u.id = :id")
    @QueryHints(@QueryHint(name = "org.hibernate.cacheable", value = "false"))
    Optional<UsuarioEntity> findFreshById(@Param("id") Long id);

    @Query("SELECT u " +
            "FROM UsuarioEntity u " +
            "WHERE  " +
            "     ( " +
            "         LOWER(u.nombre) LIKE LOWER(CONCAT('%', :q, '%')) " +
            "      OR LOWER(u.apellido) LIKE LOWER(CONCAT('%', :q, '%')) " +
            "      OR LOWER(CONCAT(u.nombre, ' ', u.apellido)) LIKE LOWER(CONCAT('%', :q, '%')) " +
            "     ) " +
            "ORDER BY u.nombre ASC, u.apellido ASC")
    List<UsuarioEntity> searchActivosByNombre(@Param("q") String q);

    public long countByActivoTrue();

    @Query("SELECT COUNT(u) FROM UsuarioEntity u WHERE u.fechaCreacion >= :inicio AND u.fechaCreacion < :fin")
    long countUsuariosRegistradosEntreFechas(@Param("inicio") java.time.LocalDateTime inicio,
            @Param("fin") java.time.LocalDateTime fin);

    @Query("SELECT COUNT(u) FROM UsuarioEntity u WHERE u.fechaCreacion < :hasta")
    long countUsuariosTotalesHasta(@Param("hasta") java.time.LocalDateTime hasta);

    @Query("SELECT u FROM UsuarioEntity u ORDER BY u.fechaCreacion DESC")
    List<UsuarioEntity> findTop10Recientes(Pageable pageable);

    @Query("SELECT u FROM UsuarioEntity u WHERE :role NOT MEMBER OF u.roles ORDER BY u.fechaCreacion DESC")
    Page<UsuarioEntity> findRecientesSinRol(Pageable pageable, @Param("role") String role);

}
